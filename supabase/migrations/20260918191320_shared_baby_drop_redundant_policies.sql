-- Politikat e vjetra lejonin vetem `user_id = auth.uid()`. E reja
-- (`can_access_baby_data`) e permban plotesisht ate rast, prandaj te vjetrat
-- nuk shtojne asgje — vetem ngaterrojne ke i lexon me vone.
--
-- APLIKUAR TASHME ne projekt (version 20260918191320).

drop policy if exists "Users can manage their own baby records" on public.baby_records;
drop policy if exists "Users manage their own baby profile" on public.baby_profiles;
