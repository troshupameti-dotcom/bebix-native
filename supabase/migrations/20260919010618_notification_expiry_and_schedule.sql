-- Njoftimet e castit humbin kuptimin nese vonohen: "4 ore pa ushqyerje" e
-- mbajtur nga oret e qeta dhe e derguar ne mengjes eshte zhurme, jo ndihme.
-- APLIKUAR TASHME (version 20260919010618).

alter table public.notification_outbox
  add column if not exists expires_at timestamptz;

create or replace function public.pending_notifications(p_limit int default 200)
returns table (id bigint, user_id uuid, key text, title text, body text, data jsonb)
language sql security definer set search_path = public as $$
  select o.id, o.user_id, o.key, o.title, o.body, o.data
  from public.notification_outbox o
  where o.sent_at is null
    and o.attempts < 5
    and o.send_after <= now()
    and (o.expires_at is null or o.expires_at > now())
    and not public.in_quiet_hours(o.user_id)
  order by o.created_at
  limit greatest(1, least(p_limit, 500));
$$;

revoke execute on function public.pending_notifications(int) from public, anon, authenticated;

create or replace function public.expire_stale_notifications()
returns void language sql security definer set search_path = public as $$
  update public.notification_outbox
  set sent_at = now(), error = 'skadoi pa u derguar'
  where sent_at is null and expires_at is not null and expires_at <= now();
$$;

revoke execute on function public.expire_stale_notifications() from public, anon, authenticated;

create or replace function public.enqueue_notification(
  p_user uuid, p_key text, p_title text, p_body text,
  p_data jsonb default '{}'::jsonb, p_dedupe text default null,
  p_send_after timestamptz default now(), p_expires_at timestamptz default null
)
returns void language plpgsql security definer set search_path = public as $fn$
begin
  if p_user is null then return; end if;
  if not public.notification_allowed(p_user, p_key) then return; end if;

  insert into public.notification_outbox (user_id, key, title, body, data, dedupe_key, send_after, expires_at)
  values (p_user, p_key, p_title, p_body, coalesce(p_data, '{}'::jsonb), p_dedupe,
          coalesce(p_send_after, now()), p_expires_at)
  on conflict do nothing;
end
$fn$;

revoke execute on function public.enqueue_notification(uuid, text, text, text, jsonb, text, timestamptz, timestamptz) from public, anon, authenticated;

-- Kujtesat kalojne ne cdo 30 minuta: boshllequt (ushqyerje, gjume, pelena)
-- nuk kane kuptim nese kontrollohen nje here ne dite.
do $outer$
declare svc text; base text := 'https://mkpayczhqmbpqwwxjtjf.supabase.co/functions/v1/';
begin
  select substring(command from 'Bearer <?([A-Za-z0-9._-]{20,})>?') into svc
  from cron.job where jobname = 'daily-birthday-check' limit 1;

  perform cron.unschedule('daily-reminders');

  perform cron.schedule('reminders-every-30m', '*/30 * * * *',
    format($j$select net.http_post(url := %L, headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer %s'));$j$,
           base || 'send-reminders', svc));

  perform cron.schedule('expire-stale-notifications', '15 * * * *',
    $j$select public.expire_stale_notifications();$j$);
end
$outer$;
