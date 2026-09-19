-- Numerimi i provave duhet te rritet, jo te vendoset. Pa kete, nje njoftim
-- qe deshton perjetesisht do te riprovohej pergjithmone.
-- APLIKUAR TASHME (version 20260919010508).

create or replace function public.mark_notifications_failed(p_ids bigint[], p_error text)
returns void language sql security definer set search_path = public as $$
  update public.notification_outbox
  set attempts = attempts + 1,
      error = left(coalesce(p_error, 'gabim i panjohur'), 300)
  where id = any(p_ids) and sent_at is null;
$$;

revoke execute on function public.mark_notifications_failed(bigint[], text) from public, anon, authenticated;
