-- Cfare eshte gati per t'u derguar TANI. Filtrimi behet ne SQL qe funksioni
-- i dergimit te mos e rindertoje ate logjike.
-- APLIKUAR TASHME (version 20260919010417). Shiko edhe migrimin
-- 20260919010618, qe e zevendeson kete funksion me nje qe njeh skadencen.

create or replace function public.pending_notifications(p_limit int default 200)
returns table (id bigint, user_id uuid, key text, title text, body text, data jsonb)
language sql security definer set search_path = public as $$
  select o.id, o.user_id, o.key, o.title, o.body, o.data
  from public.notification_outbox o
  where o.sent_at is null
    and o.attempts < 5
    and o.send_after <= now()
    and not public.in_quiet_hours(o.user_id)
  order by o.created_at
  limit greatest(1, least(p_limit, 500));
$$;

revoke execute on function public.pending_notifications(int) from public, anon, authenticated;

-- Radha nuk duhet te rritet pa fund.
create or replace function public.purge_sent_notifications()
returns void language sql security definer set search_path = public as $$
  delete from public.notification_outbox
  where sent_at is not null and sent_at < now() - interval '30 days';
$$;

revoke execute on function public.purge_sent_notifications() from public, anon, authenticated;

do $outer$
declare svc text; base text := 'https://mkpayczhqmbpqwwxjtjf.supabase.co/functions/v1/';
begin
  select substring(command from 'Bearer <?([A-Za-z0-9._-]{20,})>?') into svc
  from cron.job where jobname = 'daily-birthday-check' limit 1;
  if svc is null then raise exception 'S''u gjet celesi i sherbimit te cron.job.'; end if;

  perform cron.schedule('drain-notifications', '*/2 * * * *',
    format($j$select net.http_post(url := %L, headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer %s'));$j$,
           base || 'send-notifications', svc));

  perform cron.schedule('purge-sent-notifications', '30 4 * * *',
    $j$select public.purge_sent_notifications();$j$);
end
$outer$;
