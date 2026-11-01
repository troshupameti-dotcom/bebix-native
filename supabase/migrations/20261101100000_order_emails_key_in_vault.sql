-- Auditimi #36 (1 nëntor 2026): çelësi "service_role" nuk rri më i shkruar brenda punës së cron-it që dërgon
-- email-et e porosive. Kalon te Supabase Vault (i enkriptuar) dhe puna e lexon prej andej në çdo thirrje.
--
-- Çelësi s'shkruhet askund në këtë skedar: merret nga komanda ekzistuese e cron-it dhe futet drejt e në Vault.
-- Puna bën saktësisht të njëjtën gjë si më parë (thërret send-order-emails kur ka email në pritje).
-- Punët e njoftimeve push (daily-birthday-check, drain-notifications, reminders-every-30m) s'preken: ajo pjesë
-- mbetet e pauzuar dhe e paprekur.
--
-- E sigurt për t'u ekzekutuar dy herë: herën e dytë sekreti ekziston dhe komanda thjesht rishkruhet njësoj.

do $$
declare
  v_job bigint;
  v_key text;
begin
  select jobid into v_job from cron.job where jobname = 'drain-order-emails';
  if v_job is null then
    raise notice 'Puna drain-order-emails s''ekziston; s''ka çfarë të ndryshohet.';
    return;
  end if;

  if not exists (select 1 from vault.secrets where name = 'cron_service_role_key') then
    select (regexp_match(command, 'Bearer ([A-Za-z0-9._-]+)'))[1] into v_key from cron.job where jobid = v_job;
    if v_key is null then
      raise exception 'Çelësi s''u gjet as te cron-i as te Vault-i: shtoje te Vault me emrin cron_service_role_key.';
    end if;
    perform vault.create_secret(v_key, 'cron_service_role_key', 'Çelësi service_role për punët e cron-it (email-et e porosive)');
  end if;

  perform cron.alter_job(
    job_id := v_job,
    command := $cmd$select net.http_post(url := 'https://mkpayczhqmbpqwwxjtjf.supabase.co/functions/v1/send-order-emails', headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_service_role_key'))) where exists (select 1 from public.email_outbox where sent_at is null and attempts < 5 and created_at > now() - interval '3 days')$cmd$
  );
end
$$;
