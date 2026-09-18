-- =====================================================================
-- Njoftimet qe dalin vertet nga app-i.
--
-- Deri tani: token-at regjistroheshin, por asgje s'dergonte. Zilja te
-- faqja kryesore llogaritej ne telefon, pra askush s'e mesonte pa e hapur
-- app-in. Statusi i porosise shkruhej nga paneli dhe klienti s'e shihte.
--
-- GJETJE: cron job-i `daily-birthday-check` e dergonte header-in si
-- `Bearer <eyJ...>` — me kllapat kendore te shabllonit brenda vleres. Ai
-- header eshte i pavlefshem, pra njoftimet e ditelindjeve s'kane punuar
-- kurre. Rregullohet ketu.
--
-- APLIKUAR TASHME ne projekt (version 20260918190033).
-- =====================================================================

create table if not exists public.notification_settings (
  user_id           uuid primary key references auth.users(id) on delete cascade,
  vaccine_reminders boolean not null default true,
  order_updates     boolean not null default true,
  updated_at        timestamptz not null default now()
);

alter table public.notification_settings enable row level security;

drop policy if exists "notification_settings_own" on public.notification_settings;
create policy "notification_settings_own"
  on public.notification_settings for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Pa kete, i njejti kujtim do te dergohej cdo dite derisa vaksina te behej.
create table if not exists public.notification_log (
  id      bigserial primary key,
  user_id uuid not null,
  kind    text not null,
  ref     text not null,
  sent_at timestamptz not null default now(),
  unique (user_id, kind, ref)
);

-- Pa politika me qellim: vetem service_role (edge functions) e prek.
alter table public.notification_log enable row level security;
create index if not exists notification_log_sent_idx on public.notification_log (sent_at desc);

-- --- Porosi e re -> njoftim te paneli --------------------------------
create or replace function public.notify_admin_new_order()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  insert into public.admin_notifications (type, title, body, payload)
  values (
    'new_order',
    'Porosi e re',
    coalesce(new.full_name, 'Klient') || ' · ' || to_char(new.total_price, 'FM999990.00') || ' € · ' || coalesce(new.city, ''),
    jsonb_build_object('order_id', new.id, 'city', new.city, 'total', new.total_price)
  );
  return new;
end
$fn$;

drop trigger if exists orders_notify_admin on public.orders;
create trigger orders_notify_admin
  after insert on public.orders
  for each row execute function public.notify_admin_new_order();

-- --- Celesi i sherbimit merret nga cron-i ekzistues -------------------
-- Keshtu nuk shkruhet askund ne tekst, dhe kllapat kendore pastrohen.
do $outer$
declare
  svc  text;
  base text := 'https://mkpayczhqmbpqwwxjtjf.supabase.co/functions/v1/';
begin
  select substring(command from 'Bearer <?([A-Za-z0-9._-]{20,})>?')
    into svc
  from cron.job
  where jobname = 'daily-birthday-check'
  limit 1;

  if svc is null then
    raise exception 'S''u gjet celesi i sherbimit te cron.job (daily-birthday-check).';
  end if;

  execute format($body$
    create or replace function public.notify_customer_order_status()
    returns trigger
    language plpgsql
    security definer
    set search_path = public
    as $fn$
    begin
      -- Vetem ndryshim i vertete statusi, dhe vetem nese porosia ka pronar
      -- (porosite e anonimizuara pas fshirjes se llogarise s'kane ku shkojne).
      if new.status is distinct from old.status and new.user_id is not null then
        perform net.http_post(
          url     := %L,
          headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer %s'),
          body    := jsonb_build_object('order_id', new.id)
        );
      end if;
      return new;
    end
    $fn$;
  $body$, base || 'notify-order', svc);

  perform cron.schedule(
    'daily-reminders',
    '0 5 * * *',
    format(
      $j$select net.http_post(url := %L, headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer %s'));$j$,
      base || 'send-reminders', svc
    )
  );

  perform cron.schedule(
    'daily-birthday-check',
    '0 22 * * *',
    format(
      $j$select net.http_post(url := %L, headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer %s'));$j$,
      base || 'check-birthdays', svc
    )
  );
end
$outer$;

drop trigger if exists orders_notify_customer on public.orders;
create trigger orders_notify_customer
  after update on public.orders
  for each row execute function public.notify_customer_order_status();
