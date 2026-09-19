-- Njoftimet per oferta dergohen nga paneli, jo nga kodi. Shkojne VETEM te
-- ata qe e kane ndezur vete `shop_offers` — parazgjedhja eshte e fikur.
-- APLIKUAR TASHME (version 20260919011642).

create or replace function public.count_offer_recipients()
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not exists (select 1 from public.admins where user_id = (select auth.uid())) then
    raise exception 'Vetem administratoret.';
  end if;

  select count(distinct t.user_id) into n
  from public.push_tokens t
  where public.notification_allowed(t.user_id, 'shop_offers');

  return coalesce(n, 0);
end;
$$;

create or replace function public.broadcast_offer(p_title text, p_body text)
returns int language plpgsql security definer set search_path = public as $$
declare
  n int;
  stamp text := to_char(now(), 'YYYYMMDDHH24MI');
begin
  if not exists (select 1 from public.admins where user_id = (select auth.uid())) then
    raise exception 'Vetem administratoret.';
  end if;
  if char_length(trim(coalesce(p_title, ''))) < 3 or char_length(trim(coalesce(p_body, ''))) < 3 then
    raise exception 'Titulli dhe teksti duhen shkruar.';
  end if;
  if char_length(p_title) > 60 or char_length(p_body) > 180 then
    raise exception 'Titulli deri 60 shenja, teksti deri 180.';
  end if;

  insert into public.notification_outbox (user_id, key, title, body, data, dedupe_key, expires_at)
  select distinct t.user_id, 'shop_offers', trim(p_title), trim(p_body),
         jsonb_build_object('type', 'offer'),
         -- Nje dergese per minute: mbrojtje nga shtypja dy here.
         'offer:' || stamp || ':' || t.user_id,
         now() + interval '3 days'
  from public.push_tokens t
  where public.notification_allowed(t.user_id, 'shop_offers');

  get diagnostics n = row_count;
  return n;
end;
$$;

revoke execute on function public.broadcast_offer(text, text) from public, anon;
revoke execute on function public.count_offer_recipients() from public, anon;
