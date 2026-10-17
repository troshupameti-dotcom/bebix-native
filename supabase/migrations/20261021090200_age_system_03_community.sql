-- =====================================================================
-- Sistemi i moshës, pjesa 3: komuniteti për familjen (shtatzëni deri 12 vjeç).
--
--  - Grupe të reja moshe (kind = 'age', auto_key në muaj, si ato ekzistuese):
--      age:24-36 (2–3 vjeç; deri sot boshllëk), age:36-72 (3–5 vjeç),
--      age:72-120 (6–9 vjeç), age:120-156 (10–12 vjeç), dhe 'pregnancy'
--      ("Presim bebe") për shtatzënat.
--  - Sugjerimi dhe bashkimi ndjekin FËMIJËN AKTIV të personit (jo më vetëm
--    bebin e `baby_profiles`). 13+ vjeç (arkivi): asnjë grup.
--  - Privatësia mbetet si te 20261015090000_auto_groups.sql: klientit i
--    kthehen vetëm çelësat, kurrë data.
--
-- Rendi: pas 20261021090000_age_system_01_children.sql. I sigurt për dy
-- ekzekutime; grupet ekzistuese s'preken.
-- PA EKZEKUTUAR: ekzekutoje te Supabase → SQL Editor.
-- =====================================================================

-- --- 1) Grupet e reja -------------------------------------------------------
insert into public.community_groups (name, description, icon, accent, kind, auto_key) values
  ('Fëmijët 2–3 vjeç',
   'Fjalët e para të bashkuara, "jo"-të e para dhe kureshtja pa fund. Prindër që po kalojnë të njëjtën fazë.',
   'family', 'olive', 'age', 'age:24-36'),
  ('Fëmijët 3–5 vjeç',
   'Kopshti, miqtë e parë dhe pyetjet "pse?". Këshilla dhe përvoja nga prindër si ju.',
   'family', 'olive', 'age', 'age:36-72'),
  ('Fëmijët 6–9 vjeç',
   'Shkolla, detyrat, sporti dhe ndjenjat e mëdha. Një vend për prindërit e fëmijëve të shkollës.',
   'family', 'orange', 'age', 'age:72-120'),
  ('Fëmijët 10–12 vjeç',
   'Pavarësia, telefonat, shoqëria dhe ndryshimet e para. Prindër që ndihmojnë njëri-tjetrin.',
   'family', 'orange', 'age', 'age:120-156'),
  ('Presim bebe',
   'Javët e shtatzënisë, përgatitjet dhe pyetjet para lindjes. Nëna dhe baballarë që presin bebin.',
   'heart', 'olive', 'age', 'pregnancy')
on conflict (auto_key) do nothing;

-- --- 2) Mosha → çelësat ------------------------------------------------------
-- Muaj të plotë: [0,3) [3,6) [6,12) [12,24) [24,36) [36,72) [72,120) [120,156).
-- Grupi i kohës së lindjes mbetet deri në 13 vjeç; nga 13 vjeç asgjë.
create or replace function public.community_auto_keys_for(p_dob date, p_today date)
returns text[]
language plpgsql
immutable
set search_path = public
as $$
declare
  v_months int;
  v_keys text[] := '{}';
begin
  if p_dob is null or p_today is null or p_dob > p_today then
    return v_keys;
  end if;
  v_months := (extract(year from age(p_today, p_dob)) * 12 + extract(month from age(p_today, p_dob)))::int;
  if v_months >= 156 then
    return v_keys;
  end if;
  if v_months < 3 then v_keys := v_keys || 'age:0-3'::text;
  elsif v_months < 6 then v_keys := v_keys || 'age:3-6'::text;
  elsif v_months < 12 then v_keys := v_keys || 'age:6-12'::text;
  elsif v_months < 24 then v_keys := v_keys || 'age:12-24'::text;
  elsif v_months < 36 then v_keys := v_keys || 'age:24-36'::text;
  elsif v_months < 72 then v_keys := v_keys || 'age:36-72'::text;
  elsif v_months < 120 then v_keys := v_keys || 'age:72-120'::text;
  else v_keys := v_keys || 'age:120-156'::text;
  end if;
  v_keys := v_keys || ('birth:' || extract(year from p_dob)::int || '-Q' || extract(quarter from p_dob)::int);
  return v_keys;
end;
$$;

revoke execute on function public.community_auto_keys_for(date, date) from public, anon, authenticated;

-- Fëmija aktiv i personit (datëlindja dhe data e pritur), vetëm për prindërit.
-- E brendshme: s'i jepet klientit.
create or replace function public.community_my_child()
returns table (birth_date date, due_date date)
language sql
stable
security definer
set search_path = public
as $$
  select c.birth_date, c.due_date
  from public.children c
  where (select auth.uid()) is not null
    and public.can_access_baby_data(public.my_data_owner())
    and c.id = public.active_child_id((select auth.uid()));
$$;

revoke execute on function public.community_my_child() from public, anon, authenticated;

-- Çelësat e fëmijës aktiv. Pa fëmijë te tabela e re (familje e vjetër): bebi i
-- `baby_profiles`, si më parë. Shtatzënia: vetëm 'pregnancy'.
create or replace function public.community_my_auto_keys()
returns text[]
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_birth date;
  v_due date;
  v_found boolean := false;
begin
  select birth_date, due_date, true into v_birth, v_due, v_found from public.community_my_child();
  if not coalesce(v_found, false) then
    v_birth := public.community_my_baby_dob();
  end if;
  if v_birth is null and v_due is not null then
    return array['pregnancy']::text[];
  end if;
  return public.community_auto_keys_for(v_birth, public.community_today());
end;
$$;

revoke execute on function public.community_my_auto_keys() from public, anon, authenticated;

-- --- 3) Sugjerimet dhe bashkimi, sipas fëmijës aktiv -------------------------
create or replace function public.suggest_community_groups()
returns table (auto_key text, action text)
language sql
stable
security definer
set search_path = public
as $$
  with keys as (
    select unnest(public.community_my_auto_keys()) as k
  ),
  mine as (
    select g.auto_key, g.kind
    from public.community_group_members m
    join public.community_groups g on g.id = m.group_id
    where m.user_id = (select auth.uid()) and g.kind <> 'topic'
  )
  select k, 'join'::text from keys where k not in (select mine.auto_key from mine)
  union all
  select mine.auto_key, 'leave'::text from mine
  where mine.kind in ('age', 'birth_cohort')
    and exists (select 1 from keys)
    and mine.auto_key not in (select k from keys);
$$;

revoke execute on function public.suggest_community_groups() from public, anon;
grant execute on function public.suggest_community_groups() to authenticated;

create or replace function public.join_suggested_group(p_key text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := (select auth.uid());
  v_dob date;
  v_keys text[];
  v_group uuid;
  v_q int;
  v_range text;
begin
  if v_me is null then
    raise exception 'not_authenticated';
  end if;
  v_keys := public.community_my_auto_keys();
  if p_key is null or not (p_key = any(v_keys)) then
    raise exception 'not_your_group';
  end if;

  select id into v_group from public.community_groups where auto_key = p_key;

  if v_group is null and p_key like 'birth:%' then
    select birth_date into v_dob from public.community_my_child();
    v_dob := coalesce(v_dob, public.community_my_baby_dob());
    v_q := extract(quarter from v_dob)::int;
    v_range := (array['janar–mars', 'prill–qershor', 'korrik–shtator', 'tetor–dhjetor'])[v_q];
    insert into public.community_groups (name, description, icon, accent, kind, auto_key)
    values (
      'Lindur në ' || v_range || ' ' || extract(year from v_dob)::int,
      'Prindër që i mirëpritën bebet në të njëjtat muaj. Rriteni bashkë, hap pas hapi.',
      'family', 'orange', 'birth_cohort', p_key
    )
    on conflict (auto_key) do nothing;
    select id into v_group from public.community_groups where auto_key = p_key;
  end if;

  if v_group is null then
    raise exception 'group_missing';
  end if;

  insert into public.community_group_members (group_id, user_id)
  values (v_group, v_me)
  on conflict (group_id, user_id) do nothing;
  return v_group;
end;
$$;

revoke execute on function public.join_suggested_group(text) from public, anon;
grant execute on function public.join_suggested_group(text) to authenticated;
