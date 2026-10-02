-- Njoftimet me email për porosinë. VETËM SHTESA: funksioni i porosisë
-- (place_order_core) nuk preket fare.
--
-- 1. Klienti me llogari merr email konfirmimi kur porosia pranohet (në email-in e
--    llogarisë). Mysafiri e jep email-in (opsional) pas porosisë, përmes
--    `set_order_email`, dhe merr konfirmimin atëherë.
-- 2. Klienti merr email kur ndryshon statusi (konfirmuar, nisur, dorëzuar, anuluar).
-- 3. Admini merr email sa herë vjen një porosi e re.
--
-- Triggerat vetëm SHKRUAJNË te `email_outbox` dhe e përpunojnë çdo gabim brenda
-- tyre: një problem me email-et s'bën kurrë që një porosi të dështojë. Dërgimin
-- e bën funksioni send-order-emails (Resend), çdo minutë.

-- ------------------------------------------------------------------ strukturat
alter table public.orders add column if not exists email text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'orders_email_len') then
    alter table public.orders add constraint orders_email_len check (email is null or char_length(email) <= 200);
  end if;
end $$;

create table if not exists public.email_outbox (
  id         bigint generated always as identity primary key,
  kind       text not null,
  order_id   uuid references public.orders (id) on delete cascade,
  audience   text not null check (audience in ('customer', 'admin')),
  to_email   text,
  dedupe_key text,
  created_at timestamptz not null default now(),
  claimed_at timestamptz,
  sent_at    timestamptz,
  attempts   int not null default 0,
  error      text
);

create unique index if not exists email_outbox_dedupe_idx on public.email_outbox (dedupe_key) where dedupe_key is not null;
create index if not exists email_outbox_pending_idx on public.email_outbox (created_at) where sent_at is null;

-- Vetëm service_role (funksioni i dërgimit) e prek; asnjë klient s'e lexon.
alter table public.email_outbox enable row level security;
revoke all on public.email_outbox from anon, authenticated;

-- ------------------------------------------------------------------ triggerat
create or replace function public.enqueue_order_emails()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_email text;
begin
  begin
    v_email := lower(coalesce(nullif(btrim(new.email), ''), (select u.email from auth.users u where u.id = new.user_id)));

    if tg_op = 'INSERT' then
      -- Klienti me llogari: konfirmim në email-in e llogarisë. Mysafiri e merr
      -- më vonë, kur e jep email-in (set_order_email).
      if v_email is not null then
        insert into public.email_outbox (kind, order_id, audience, to_email, dedupe_key)
        values ('order_placed', new.id, 'customer', v_email, 'order_placed:' || new.id)
        on conflict do nothing;
      end if;
      insert into public.email_outbox (kind, order_id, audience, dedupe_key)
      values ('admin_new_order', new.id, 'admin', 'admin_new_order:' || new.id)
      on conflict do nothing;
    elsif new.status is distinct from old.status and new.status in ('confirmed', 'shipped', 'delivered', 'cancelled') then
      if v_email is not null then
        insert into public.email_outbox (kind, order_id, audience, to_email, dedupe_key)
        values ('status_' || new.status, new.id, 'customer', v_email, 'status:' || new.id || ':' || new.status)
        on conflict do nothing;
      end if;
    end if;
  exception when others then
    -- Email-i s'duhet të rrëzojë kurrë porosinë.
    null;
  end;
  return new;
end;
$$;

revoke execute on function public.enqueue_order_emails() from public, anon, authenticated;

drop trigger if exists orders_enqueue_emails_insert on public.orders;
create trigger orders_enqueue_emails_insert after insert on public.orders
  for each row execute function public.enqueue_order_emails();

drop trigger if exists orders_enqueue_emails_status on public.orders;
create trigger orders_enqueue_emails_status after update of status on public.orders
  for each row execute function public.enqueue_order_emails();

-- Kur llogaria fshihet, porosia anonimizohet (user_id bëhet null): email-i i saj
-- hiqet nga porosia dhe nga radha, që të mos mbetet asnjë gjurmë personale.
create or replace function public.scrub_order_email_on_anonymise()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.user_id is null and old.user_id is not null then
    new.email := null;
    begin
      delete from public.email_outbox where order_id = new.id and audience = 'customer' and sent_at is null;
      update public.email_outbox set to_email = null where order_id = new.id and audience = 'customer';
    exception when others then
      null;
    end;
  end if;
  return new;
end;
$$;

revoke execute on function public.scrub_order_email_on_anonymise() from public, anon, authenticated;

drop trigger if exists orders_scrub_email_on_anonymise on public.orders;
create trigger orders_scrub_email_on_anonymise before update of user_id on public.orders
  for each row execute function public.scrub_order_email_on_anonymise();

-- --------------------------------------------- email-i i mysafirit (pas porosisë)
-- Mysafiri e njeh numrin e porosisë dhe referencën e vet (client_ref, e
-- gjeneruar te pajisja). Vetëm porosi pa llogari, vetëm brenda 15 minutave,
-- vetëm një herë: kështu s'mund t'i vendoset email i huaj një porosie ekzistuese.
create or replace function public.set_order_email(p_order_id uuid, p_client_ref uuid, p_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(nullif(btrim(coalesce(p_email, '')), ''));
  v_id    uuid;
begin
  if v_email is null then
    return;
  end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(v_email) > 200 then
    raise exception 'Email-i nuk është i vlefshëm.';
  end if;

  update public.orders set email = v_email
  where id = p_order_id and client_ref = p_client_ref and user_id is null
    and email is null and created_at > now() - interval '15 minutes'
  returning id into v_id;

  if v_id is null then
    return;
  end if;

  insert into public.email_outbox (kind, order_id, audience, to_email, dedupe_key)
  values ('order_placed', v_id, 'customer', v_email, 'order_placed:' || v_id)
  on conflict do nothing;
end;
$$;

revoke execute on function public.set_order_email(uuid, uuid, text) from public;
grant execute on function public.set_order_email(uuid, uuid, text) to anon, authenticated, service_role;

-- --------------------------------------------------------------- radha e dërgimit
create or replace function public.claim_pending_emails(p_limit int default 20)
returns setof public.email_outbox
language sql
security definer
set search_path = public
as $$
  update public.email_outbox e
  set claimed_at = now(), attempts = e.attempts + 1
  where e.id in (
    select id from public.email_outbox
    where sent_at is null
      and attempts < 5
      and created_at > now() - interval '3 days'
      and (claimed_at is null or claimed_at < now() - interval '5 minutes')
    order by created_at
    limit least(greatest(p_limit, 1), 50)
    for update skip locked
  )
  returning e.*;
$$;

revoke execute on function public.claim_pending_emails(int) from public, anon, authenticated;
grant execute on function public.claim_pending_emails(int) to service_role;

create or replace function public.purge_old_emails()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.email_outbox
  where (sent_at is not null and sent_at < now() - interval '30 days')
     or (sent_at is null and created_at < now() - interval '7 days');
$$;

revoke execute on function public.purge_old_emails() from public, anon, authenticated;
