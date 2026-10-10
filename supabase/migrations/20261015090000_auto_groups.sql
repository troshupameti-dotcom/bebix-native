-- =====================================================================
-- Grupet sipas moshës së bebit dhe kohës së lindjes.
--
-- SUGJERIM, jo anëtarësim i fshehtë: app-i ia sugjeron prindit grupin, dhe
-- prindi bashkohet vetë me një prekje (anëtarësia zbulon moshën e përafërt
-- të bebit, ndaj kërkon pëlqim).
--
-- Privatësia:
--  - mosha llogaritet KËTU, për auth.uid(); klientit i kthehen vetëm çelësat
--    e grupeve ("age:3-6", "birth:2026-Q4") — kurrë data, emri apo mosha;
--  - kush është anëtar s'e sheh askush (politika ekzistuese: vetëm vetja);
--  - grupet e moshës s'hyhen me kërkesë direkte: vetëm me
--    join_suggested_group(), që e kontrollon çelësin kundër bebit tënd.
--    Edhe postimi në to kërkon anëtarësi.
--  - vetëm prindërit e bebit (can_access_baby_data); gjyshërit jo.
-- Grupet e moshës s'të heqin vetë kur bebi rritet: sugjerohet grupi tjetër
-- dhe ofrohet "Dil" nga i vjetri.
--
-- Rendi: ky skedar vetëm. Grupet ekzistuese mbeten 'topic', pa ndryshim.
-- PA EKZEKUTUAR: ekzekutoje te Supabase → SQL Editor.
-- =====================================================================

begin;

-- --- 1) Kolonat e reja ----------------------------------------------------
alter table public.community_groups add column if not exists kind text not null default 'topic';
alter table public.community_groups add column if not exists auto_key text;

do $$ begin
  alter table public.community_groups add constraint community_groups_kind_check check (kind in ('topic', 'age', 'birth_cohort'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.community_groups add constraint community_groups_auto_key_key unique (auto_key);
exception when duplicate_object or duplicate_table then null; end $$;

do $$ begin
  alter table public.community_groups add constraint community_groups_auto_key_kind check ((kind = 'topic') = (auto_key is null));
exception when duplicate_object then null; end $$;

-- --- 2) Katër grupet e moshës ----------------------------------------------
insert into public.community_groups (name, description, icon, accent, kind, auto_key) values
  ('Bebat 0–3 muaj',
   'Javët e para: gjumi i shkurtër, ushqyerjet e shpeshta dhe shumë dashuri. Këtu takohen prindërit që po kalojnë të njëjtën gjë.',
   'baby', 'olive', 'age', 'age:0-3'),
  ('Bebat 3–6 muaj',
   'Buzëqeshjet, rrotullimet e para dhe netët që ndonjëherë zgjaten. Ndani përvojat me prindër në të njëjtën fazë.',
   'baby', 'olive', 'age', 'age:3-6'),
  ('Bebat 6–12 muaj',
   'Ushqimet e para, dhëmbët dhe zvarritja. Pyetje, këshilla dhe kurajë nga prindër si ju.',
   'baby', 'orange', 'age', 'age:6-12'),
  ('Bebat 12–24 muaj',
   'Hapat dhe fjalët e para, kureshtja pa fund. Një vend për prindërit e fëmijëve të vegjël.',
   'baby', 'orange', 'age', 'age:12-24')
on conflict (auto_key) do nothing;

-- --- 3) Mosha → çelësat (e pastër) -----------------------------------------
-- Muaj të plotë. [0,3) [3,6) [6,12) [12,24); mbi 24 muaj vetëm grupi i lindjes.
-- Datë në të ardhmen ose mungesë: asgjë.
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
  if v_months < 3 then v_keys := v_keys || 'age:0-3'::text;
  elsif v_months < 6 then v_keys := v_keys || 'age:3-6'::text;
  elsif v_months < 12 then v_keys := v_keys || 'age:6-12'::text;
  elsif v_months < 24 then v_keys := v_keys || 'age:12-24'::text;
  end if;
  v_keys := v_keys || ('birth:' || extract(year from p_dob)::int || '-Q' || extract(quarter from p_dob)::int);
  return v_keys;
end;
$$;

revoke execute on function public.community_auto_keys_for(date, date) from public, anon, authenticated;

-- Data e lindjes së bebit tim (bebi i familjes), vetëm për prindërit.
-- E brendshme: s'i jepet klientit.
create or replace function public.community_my_baby_dob()
returns date
language sql
stable
security definer
set search_path = public
as $$
  select case
    when (select auth.uid()) is not null and public.can_access_baby_data(public.my_data_owner())
      then (select baby_dob from public.baby_profiles where user_id = public.my_data_owner())
  end;
$$;

revoke execute on function public.community_my_baby_dob() from public, anon, authenticated;

-- "Sot" në Kosovë (njësoj për të gjithë, edhe në diasporë).
create or replace function public.community_today()
returns date
language sql
stable
set search_path = public
as $$
  select (now() at time zone 'Europe/Belgrade')::date;
$$;

revoke execute on function public.community_today() from public, anon, authenticated;

-- --- 4) Sugjerimet ----------------------------------------------------------
-- 'join': grupet që i përkasin bebit tim dhe s'jam ende aty.
-- 'leave': grupet e moshës ku jam, por që bebi i ka kaluar; ose grupi i lindjes
-- kur data e lindjes u korrigjua (vetëm kur dihet mosha).
create or replace function public.suggest_community_groups()
returns table (auto_key text, action text)
language sql
stable
security definer
set search_path = public
as $$
  with keys as (
    select unnest(public.community_auto_keys_for(public.community_my_baby_dob(), public.community_today())) as k
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

-- --- 5) Bashkimi ------------------------------------------------------------
-- Vetëm me një çelës që i përket vërtet bebit tim. Grupi i kohës së lindjes
-- krijohet herën e parë që dikush bashkohet (idempotent, pa kron).
create or replace function public.join_suggested_group(p_key text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := (select auth.uid());
  v_dob date := public.community_my_baby_dob();
  v_keys text[];
  v_group uuid;
  v_q int;
  v_range text;
begin
  if v_me is null then
    raise exception 'not_authenticated';
  end if;
  v_keys := public.community_auto_keys_for(v_dob, public.community_today());
  if p_key is null or not (p_key = any(v_keys)) then
    raise exception 'not_your_group';
  end if;

  select id into v_group from public.community_groups where auto_key = p_key;

  if v_group is null and p_key like 'birth:%' then
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

-- --- 6) Hyrja direkte vetëm te grupet e temave ------------------------------
-- Dalja (delete) mbetet e lirë për çdo grup.
drop policy if exists "community_group_members_self_insert" on public.community_group_members;
create policy "community_group_members_self_insert"
  on public.community_group_members for insert
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.community_groups g where g.id = group_id and g.kind = 'topic')
  );

-- --- 7) Postimi në grupet e moshës/lindjes kërkon anëtarësi -----------------
create or replace function public.community_posts_auto_group_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.group_id is not null
     and exists (select 1 from public.community_groups g where g.id = new.group_id and g.kind <> 'topic')
     and not exists (select 1 from public.community_group_members m where m.group_id = new.group_id and m.user_id = new.author_id)
  then
    raise exception 'Për të postuar në këtë grup, bashkohu më parë nga sugjerimi në Komunitet.';
  end if;
  return new;
end;
$$;

revoke execute on function public.community_posts_auto_group_guard() from public, anon, authenticated;

drop trigger if exists community_posts_auto_group_guard on public.community_posts;
create trigger community_posts_auto_group_guard before insert or update of group_id on public.community_posts
  for each row execute function public.community_posts_auto_group_guard();

commit;
