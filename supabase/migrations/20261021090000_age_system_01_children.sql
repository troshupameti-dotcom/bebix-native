-- =====================================================================
-- Sistemi i moshës, pjesa 1: disa fëmijë për familje, plani (falas/premium)
-- dhe fëmija aktiv.
--
-- Modeli:
--  - `children`: çdo fëmijë i një familjeje. Pronari (`owner_id`) është i
--    njëjti si te `baby_profiles`/`baby_records` (ai që e krijoi bebin); anëtarët
--    e familjes e shohin përmes `can_view_baby_data` / `can_access_baby_data`.
--  - Fëmija i parë është falas (`is_free`). Çdo fëmijë shtesë kërkon Premium.
--    Kur Premium skadon, fëmijët shtesë kyçen (s'zgjidhen dot si aktiv), por
--    asgjë s'fshihet.
--  - `child_selection`: fëmija aktiv i çdo personi (mami mund të shohë njërin,
--    babi tjetrin). Serveri e di, që njoftimet dhe sugjerimet e mëvonshme të
--    ndjekin fëmijën e duhur.
--  - `user_plans` + `is_premium()`: vetëm baza; pagesat s'ekzistojnë ende.
--
-- Përputhja me versionet e vjetra (app-i në telefonat e njerëzve, webi):
--  - `baby_profiles` mbetet; pasqyron fëmijën FALAS në të dy drejtimet.
--  - `baby_records.baby_id` bosh plotësohet vetë me fëmijën falas.
--
-- Rendi: ky skedar i pari. I sigurt për t'u ekzekutuar dy herë; s'fshin asgjë.
-- PA EKZEKUTUAR: ekzekutoje te Supabase → SQL Editor.
-- =====================================================================

-- --- 1) Tabelat -----------------------------------------------------------

create table if not exists public.children (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users(id) on delete cascade,
  name        text,
  birth_date  date,
  -- Data e pritur e lindjes (shtatzënia): vetëm kur s'ka ende datëlindje.
  due_date    date,
  photo_path  text,
  details     jsonb not null default '{}'::jsonb,
  is_free     boolean not null default false,
  -- Kur u bë falas; ndërrimi i fëmijës falas lejohet një herë në 30 ditë.
  free_since  timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists children_owner_idx on public.children (owner_id, created_at);
-- Një fëmijë falas për familje.
create unique index if not exists children_one_free_per_owner on public.children (owner_id) where is_free;

create table if not exists public.user_plans (
  user_id        uuid primary key references auth.users(id) on delete cascade,
  plan           text not null default 'free',
  premium_until  timestamptz,
  updated_at     timestamptz not null default now()
);

do $$ begin
  alter table public.user_plans add constraint user_plans_plan_check check (plan in ('free', 'premium'));
exception when duplicate_object then null; end $$;

create table if not exists public.child_selection (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  child_id    uuid not null references public.children(id) on delete cascade,
  updated_at  timestamptz not null default now()
);

create index if not exists child_selection_child_idx on public.child_selection (child_id);

-- --- 2) Kush sheh dhe kush shkruan ------------------------------------------

alter table public.children enable row level security;
alter table public.user_plans enable row level security;
alter table public.child_selection enable row level security;

-- Fëmijët: i sheh e gjithë familja (edhe gjyshërit), si profili i bebit.
drop policy if exists "children_household_read" on public.children;
create policy "children_household_read"
  on public.children for select to authenticated
  using (public.can_view_baby_data(owner_id));

-- Ndryshimi (emri, datat, fotoja, detajet): vetëm prindërit.
drop policy if exists "children_parents_update" on public.children;
create policy "children_parents_update"
  on public.children for update to authenticated
  using (public.can_access_baby_data(owner_id))
  with check (public.can_access_baby_data(owner_id));

-- Shtimi vetëm me add_child() (kontrolli i Premium-it); fshirja s'ekziston.
-- `is_free`, `owner_id` dhe `free_since` s'ndryshohen nga klienti.
revoke insert, update, delete on public.children from anon, authenticated;
grant select on public.children to authenticated;
grant update (name, birth_date, due_date, photo_path, details, updated_at) on public.children to authenticated;

drop policy if exists "user_plans_own_read" on public.user_plans;
create policy "user_plans_own_read"
  on public.user_plans for select to authenticated
  using (user_id = (select auth.uid()));
revoke insert, update, delete on public.user_plans from anon, authenticated;

drop policy if exists "child_selection_own_read" on public.child_selection;
create policy "child_selection_own_read"
  on public.child_selection for select to authenticated
  using (user_id = (select auth.uid()));
revoke insert, update, delete on public.child_selection from anon, authenticated;

-- Lejet e API-së të shkruara shprehimisht: nga 30 tetori 2026 Supabase s'u jep më vetë leje tabelave të reja te
-- "public" (pa to app-i merr "permission denied"). Leximi vetëm për të kyçurit (RLS e kufizon te të vetat);
-- shkrimi vetëm përmes funksioneve. service_role (funksionet në server) i ka të gjitha, si tabelat e tjera.
revoke all on public.children, public.user_plans, public.child_selection from anon;
grant select on public.user_plans, public.child_selection to authenticated;
grant all on public.children, public.user_plans, public.child_selection to service_role;

-- --- 3) Plani ---------------------------------------------------------------

-- Premium pa datë skadimi = pa afat.
create or replace function public.is_premium(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select p.plan = 'premium' and (p.premium_until is null or p.premium_until > now())
    from public.user_plans p
    where p.user_id = p_user
  ), false);
$$;

revoke execute on function public.is_premium(uuid) from public, anon;
grant execute on function public.is_premium(uuid) to authenticated;

-- Plani i familjes: ai i pronarit të të dhënave (anëtarët ndajnë planin e tij).
create or replace function public.my_plan()
returns table (plan text, premium_until timestamptz, is_premium boolean)
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(p.plan, 'free'), p.premium_until, public.is_premium(o.id)
  from (select public.my_data_owner() as id) o
  left join public.user_plans p on p.user_id = o.id
  where (select auth.uid()) is not null;
$$;

revoke execute on function public.my_plan() from public, anon;
grant execute on function public.my_plan() to authenticated;

-- --- 4) Ndihmës të brendshëm ----------------------------------------------

-- Fëmija falas i pronarit; krijohet kur s'ka asnjë (përdorues i ri, app i vjetër).
create or replace function public.ensure_free_child(p_owner uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  select id into v_id from public.children where owner_id = p_owner and is_free limit 1;
  if v_id is not null then
    return v_id;
  end if;
  select id into v_id from public.children where owner_id = p_owner order by created_at limit 1;
  if v_id is not null then
    update public.children set is_free = true where id = v_id;
    return v_id;
  end if;
  insert into public.children (owner_id, is_free) values (p_owner, true) returning id into v_id;
  return v_id;
end;
$$;

revoke execute on function public.ensure_free_child(uuid) from public, anon, authenticated;

-- Fëmija aktiv i një personi: zgjedhja e tij kur është e lejuar (i familjes së tij,
-- jo i kyçur), përndryshe fëmija falas, përndryshe i pari.
create or replace function public.active_child_id(p_user uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  with o as (
    select coalesce(
      (select m.owner_id from public.baby_household_members m where m.member_id = p_user limit 1),
      p_user
    ) as id
  )
  select coalesce(
    (select s.child_id
       from public.child_selection s
       join public.children c on c.id = s.child_id
      where s.user_id = p_user
        and c.owner_id = (select id from o)
        and (c.is_free or public.is_premium(c.owner_id))),
    (select c.id from public.children c where c.owner_id = (select id from o) and c.is_free limit 1),
    (select c.id from public.children c where c.owner_id = (select id from o) order by c.created_at limit 1)
  );
$$;

revoke execute on function public.active_child_id(uuid) from public, anon, authenticated;

-- --- 5) Funksionet për app-in ---------------------------------------------

-- Fëmijët e familjes sime, me gjendjen (falas, i kyçur, aktiv).
create or replace function public.my_children()
returns table (
  id uuid, owner_id uuid, name text, birth_date date, due_date date, photo_path text, details jsonb,
  is_free boolean, is_locked boolean, is_active boolean, created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  with me as (
    select (select auth.uid()) as uid, public.my_data_owner() as owner
  ), act as (
    select public.active_child_id((select uid from me)) as id
  )
  select c.id, c.owner_id, c.name, c.birth_date, c.due_date, c.photo_path, c.details, c.is_free,
         not (c.is_free or public.is_premium(c.owner_id)) as is_locked,
         coalesce(c.id = (select id from act), false) as is_active,
         c.created_at
  from public.children c, me
  where me.uid is not null
    and c.owner_id = me.owner
    and public.can_view_baby_data(c.owner_id)
  order by c.is_free desc, c.created_at;
$$;

revoke execute on function public.my_children() from public, anon;
grant execute on function public.my_children() to authenticated;

-- Shtimi i një fëmije. I pari është falas; çdo fëmijë shtesë kërkon Premium
-- (gabimi PREMIUM_REQUIRED, që app-i e njeh). Vetëm prindërit, jo gjyshërit.
create or replace function public.add_child(p_name text, p_birth_date date default null, p_due_date date default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := (select auth.uid());
  v_owner uuid;
  v_count int;
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'NOT_SIGNED_IN';
  end if;
  v_owner := public.my_data_owner();
  if not public.can_access_baby_data(v_owner) then
    raise exception 'NOT_ALLOWED';
  end if;
  if p_birth_date is null and p_due_date is null then
    raise exception 'DATE_REQUIRED';
  end if;
  if p_birth_date is not null and p_birth_date > current_date + 1 then
    raise exception 'INVALID_DATE';
  end if;

  -- Dy shtime njëkohësisht nga e njëjta familje s'e kalojnë dot kufirin.
  perform pg_advisory_xact_lock(hashtext('add_child:' || v_owner::text));
  select count(*) into v_count from public.children where owner_id = v_owner;
  if v_count >= 1 and not public.is_premium(v_owner) then
    raise exception 'PREMIUM_REQUIRED';
  end if;

  insert into public.children (owner_id, name, birth_date, due_date, is_free)
  values (
    v_owner,
    nullif(trim(coalesce(p_name, '')), ''),
    p_birth_date,
    case when p_birth_date is null then p_due_date end,
    v_count = 0
  )
  returning id into v_id;
  return v_id;
end;
$$;

revoke execute on function public.add_child(text, date, date) from public, anon;
grant execute on function public.add_child(text, date, date) to authenticated;

-- Zgjedhja e fëmijës aktiv (për veten). I kyçuri s'zgjidhet: PREMIUM_REQUIRED.
create or replace function public.set_active_child(p_child uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := (select auth.uid());
  v_child public.children;
begin
  if v_uid is null then
    raise exception 'NOT_SIGNED_IN';
  end if;
  select * into v_child from public.children where id = p_child;
  if v_child.id is null or v_child.owner_id <> public.my_data_owner() or not public.can_view_baby_data(v_child.owner_id) then
    raise exception 'NOT_ALLOWED';
  end if;
  if not (v_child.is_free or public.is_premium(v_child.owner_id)) then
    raise exception 'PREMIUM_REQUIRED';
  end if;
  insert into public.child_selection (user_id, child_id) values (v_uid, p_child)
  on conflict (user_id) do update set child_id = excluded.child_id, updated_at = now();
end;
$$;

revoke execute on function public.set_active_child(uuid) from public, anon;
grant execute on function public.set_active_child(uuid) to authenticated;

-- Ndërrimi i fëmijës falas (kur prindi ka gabuar). Vetëm pronari i llogarisë.
-- Pa Premium: një herë në 30 ditë (FREE_CHANGE_COOLDOWN), që një llogari falas
-- të mos i përdorë dy fëmijë duke ndërruar çdo ditë. Herën e parë lejohet menjëherë.
create or replace function public.set_free_child(p_child uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := (select auth.uid());
  v_child public.children;
  v_current public.children;
begin
  if v_uid is null then
    raise exception 'NOT_SIGNED_IN';
  end if;
  select * into v_child from public.children where id = p_child;
  if v_child.id is null or v_child.owner_id <> v_uid then
    raise exception 'NOT_ALLOWED';
  end if;
  if v_child.is_free then
    return;
  end if;

  perform pg_advisory_xact_lock(hashtext('add_child:' || v_uid::text));
  select * into v_current from public.children where owner_id = v_uid and is_free limit 1;
  if v_current.id is not null
     and v_current.free_since is not null
     and v_current.free_since > now() - interval '30 days'
     and not public.is_premium(v_uid) then
    raise exception 'FREE_CHANGE_COOLDOWN';
  end if;

  update public.children set is_free = false, updated_at = now() where owner_id = v_uid and is_free;
  update public.children set is_free = true, free_since = now(), updated_at = now() where id = p_child;
end;
$$;

revoke execute on function public.set_free_child(uuid) from public, anon;
grant execute on function public.set_free_child(uuid) to authenticated;

-- --- 6) Bebi ekzistues → fëmija i parë (falas) ------------------------------
-- Vetëm pronarët (jo rreshtat e anëtarëve të familjes, që mbajnë vetëm emrin e
-- prindit) dhe vetëm kur ka diçka për bebin. `baby_profiles` s'preket.

insert into public.children (owner_id, name, birth_date, photo_path, details, is_free, created_at)
select bp.user_id, bp.baby_name, bp.baby_dob, bp.baby_photo_path, coalesce(bp.details, '{}'::jsonb), true,
       coalesce(bp.updated_at, now())
from public.baby_profiles bp
where not exists (select 1 from public.children c where c.owner_id = bp.user_id)
  and not exists (select 1 from public.baby_household_members m where m.member_id = bp.user_id)
  and (bp.baby_name is not null or bp.baby_dob is not null or bp.baby_photo_path is not null
       or exists (select 1 from public.baby_records r where r.user_id = bp.user_id));

-- Kush ka shënime, por s'ka profil.
insert into public.children (owner_id, is_free)
select distinct r.user_id, true
from public.baby_records r
where not exists (select 1 from public.children c where c.owner_id = r.user_id);

-- Shënimet ekzistuese i përkasin fëmijës falas.
update public.baby_records r
set baby_id = c.id::text
from public.children c
where r.baby_id is null and c.owner_id = r.user_id and c.is_free;

-- --- 7) Përputhja me versionet e vjetra -------------------------------------

-- Shënimet pa fëmijë (app-i i vjetër, webi) shkojnë te fëmija falas. Një
-- përditësim pa `baby_id` e ruan atë që kishte. Një `baby_id` që s'është i
-- kësaj familjeje refuzohet.
create or replace function public.baby_records_fill_child()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.baby_id is null and tg_op = 'UPDATE' then
    new.baby_id := old.baby_id;
  end if;
  if new.baby_id is null then
    new.baby_id := public.ensure_free_child(new.user_id)::text;
  elsif not exists (select 1 from public.children c where c.id::text = new.baby_id and c.owner_id = new.user_id) then
    raise exception 'CHILD_NOT_FOUND';
  end if;
  return new;
end;
$$;

revoke execute on function public.baby_records_fill_child() from public, anon, authenticated;

drop trigger if exists baby_records_fill_child on public.baby_records;
create trigger baby_records_fill_child before insert or update on public.baby_records
  for each row execute function public.baby_records_fill_child();

-- App-i i vjetër shkruan emrin/datën/foton/detajet te `baby_profiles`: kalojnë
-- te fëmija falas. (Rreshti i një anëtari të familjes mban vetëm të dhënat e
-- tij si prind, ndaj s'preket.)
create or replace function public.baby_profiles_mirror_to_child()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if pg_trigger_depth() > 1 then
    return new;
  end if;
  if exists (select 1 from public.baby_household_members m where m.member_id = new.user_id) then
    return new;
  end if;
  if new.baby_name is null and new.baby_dob is null and new.baby_photo_path is null
     and not exists (select 1 from public.children c where c.owner_id = new.user_id) then
    return new;
  end if;
  v_id := public.ensure_free_child(new.user_id);
  update public.children c
  set name = new.baby_name,
      birth_date = new.baby_dob,
      photo_path = new.baby_photo_path,
      details = coalesce(new.details, c.details),
      updated_at = now()
  where c.id = v_id
    and (c.name, c.birth_date, c.photo_path, c.details)
        is distinct from (new.baby_name, new.baby_dob, new.baby_photo_path, coalesce(new.details, c.details));
  return new;
end;
$$;

revoke execute on function public.baby_profiles_mirror_to_child() from public, anon, authenticated;

drop trigger if exists baby_profiles_mirror_to_child on public.baby_profiles;
create trigger baby_profiles_mirror_to_child
  after insert or update of baby_name, baby_dob, baby_photo_path, details on public.baby_profiles
  for each row execute function public.baby_profiles_mirror_to_child();

-- App-i i ri shkruan te `children`: fëmija falas pasqyrohet te `baby_profiles`,
-- që app-i i vjetër, webi dhe funksionet e serverit (kujtesat, ditëlindjet,
-- grupet) të vazhdojnë të punojnë.
create or replace function public.children_mirror_to_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if pg_trigger_depth() > 1 or not new.is_free then
    return new;
  end if;
  insert into public.baby_profiles as bp (user_id, baby_name, baby_dob, baby_photo_path, details, updated_at)
  values (new.owner_id, new.name, new.birth_date, new.photo_path, new.details, now())
  on conflict (user_id) do update
    set baby_name = excluded.baby_name,
        baby_dob = excluded.baby_dob,
        baby_photo_path = excluded.baby_photo_path,
        details = excluded.details,
        updated_at = now()
    where (bp.baby_name, bp.baby_dob, bp.baby_photo_path, bp.details)
          is distinct from (excluded.baby_name, excluded.baby_dob, excluded.baby_photo_path, excluded.details);
  return new;
end;
$$;

revoke execute on function public.children_mirror_to_profile() from public, anon, authenticated;

drop trigger if exists children_mirror_to_profile on public.children;
create trigger children_mirror_to_profile
  after insert or update of name, birth_date, photo_path, details, is_free on public.children
  for each row execute function public.children_mirror_to_profile();
