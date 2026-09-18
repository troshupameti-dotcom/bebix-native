-- =====================================================================
-- Bebi i perbashket me prindin tjeter.
--
-- Deri tani cdo gje ishte e lidhur me nje llogari: nese nena regjistronte
-- ushqyerjet, babai nuk i shihte. E vetmja rruge ishte te ndanin fjalekalimin.
--
-- Modeli: nje "shtepi" e identifikuar nga pronari (ai qe e krijoi bebin).
-- Anetaret lexojne dhe shkruajne te dhenat E PRONARIT — jo te vetat — pra
-- te dy shohin te njejtin historik, pa dubluar asgje.
--
-- APLIKUAR TASHME ne projekt (version 20260918191249).
-- =====================================================================

create table if not exists public.baby_household_members (
  owner_id   uuid not null references auth.users(id) on delete cascade,
  member_id  uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (owner_id, member_id),
  -- Pronari nuk eshte "anetar" i vetvetes; kjo do te krijonte cikle.
  constraint member_is_not_owner check (owner_id <> member_id)
);

-- Nje person i perket vetem nje shtepie: pa kete, "te dhenat e kujt po shoh"
-- nuk ka pergjigje te vetme.
create unique index if not exists baby_household_one_per_member
  on public.baby_household_members (member_id);

create table if not exists public.baby_household_invites (
  code       text primary key,
  owner_id   uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at    timestamptz,
  used_by    uuid references auth.users(id) on delete set null
);

create index if not exists baby_household_invites_owner_idx
  on public.baby_household_invites (owner_id, created_at desc);

alter table public.baby_household_members enable row level security;
alter table public.baby_household_invites enable row level security;

drop policy if exists "household_members_visible" on public.baby_household_members;
create policy "household_members_visible"
  on public.baby_household_members for select to authenticated
  using (owner_id = (select auth.uid()) or member_id = (select auth.uid()));

drop policy if exists "household_members_remove" on public.baby_household_members;
create policy "household_members_remove"
  on public.baby_household_members for delete to authenticated
  using (owner_id = (select auth.uid()) or member_id = (select auth.uid()));

drop policy if exists "household_invites_owner" on public.baby_household_invites;
create policy "household_invites_owner"
  on public.baby_household_invites for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

-- --- Kush i sheh te dhenat e kujt --------------------------------------
create or replace function public.can_access_baby_data(p_owner uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_owner = (select auth.uid())
      or exists (
           select 1 from public.baby_household_members m
           where m.owner_id = p_owner and m.member_id = (select auth.uid())
         );
$$;

revoke execute on function public.can_access_baby_data(uuid) from public;
grant execute on function public.can_access_baby_data(uuid) to authenticated;

drop policy if exists "baby_records_household" on public.baby_records;
create policy "baby_records_household"
  on public.baby_records for all to authenticated
  using (public.can_access_baby_data(user_id))
  with check (public.can_access_baby_data(user_id));

drop policy if exists "baby_profiles_household" on public.baby_profiles;
create policy "baby_profiles_household"
  on public.baby_profiles for all to authenticated
  using (public.can_access_baby_data(user_id))
  with check (public.can_access_baby_data(user_id));

-- --- Ftesa ------------------------------------------------------------
-- Kodi: 6 shenja pa zanore, qe te mos dale fjale, dhe pa 0/O/1/I qe
-- ngaterrohen kur lexohet me ze.
create or replace function public.create_household_invite()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  new_code text;
  uid uuid := (select auth.uid());
begin
  if uid is null then
    raise exception 'Duhet te jesh i kycur.';
  end if;

  if exists (select 1 from public.baby_household_members where member_id = uid) then
    raise exception 'Je pjese e nje familjeje ekzistuese. Ftesen e ben pronari i te dhenave.';
  end if;

  for i in 1..10 loop
    new_code := '';
    for j in 1..6 loop
      new_code := new_code || substr(alphabet, floor(random() * length(alphabet) + 1)::int, 1);
    end loop;
    exit when not exists (select 1 from public.baby_household_invites where code = new_code);
    new_code := null;
  end loop;

  if new_code is null then
    raise exception 'S''u gjenerua dot kod. Provo perseri.';
  end if;

  insert into public.baby_household_invites (code, owner_id, expires_at)
  values (new_code, uid, now() + interval '7 days');

  return new_code;
end;
$$;

revoke execute on function public.create_household_invite() from public;
grant execute on function public.create_household_invite() to authenticated;

create or replace function public.join_household(p_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := (select auth.uid());
  invite public.baby_household_invites;
begin
  if uid is null then
    raise exception 'Duhet te jesh i kycur.';
  end if;

  select * into invite
  from public.baby_household_invites
  where code = upper(trim(p_code))
  for update;

  if invite.code is null then
    raise exception 'Kodi nuk u gjet.';
  end if;
  if invite.used_at is not null then
    raise exception 'Ky kod eshte perdorur tashme.';
  end if;
  if invite.expires_at < now() then
    raise exception 'Kodi ka skaduar. Kerko nje te ri.';
  end if;
  if invite.owner_id = uid then
    raise exception 'Ky eshte kodi yt.';
  end if;
  if exists (select 1 from public.baby_household_members where member_id = uid) then
    raise exception 'Je tashme pjese e nje familjeje. Dil prej saj para se te bashkohesh me nje tjeter.';
  end if;
  if exists (select 1 from public.baby_household_members where owner_id = uid) then
    raise exception 'Ke tashme nje familje me anetare. Hiqi ata para se te bashkohesh diku tjeter.';
  end if;

  insert into public.baby_household_members (owner_id, member_id)
  values (invite.owner_id, uid);

  update public.baby_household_invites
  set used_at = now(), used_by = uid
  where code = invite.code;

  return invite.owner_id;
end;
$$;

revoke execute on function public.join_household(text) from public;
grant execute on function public.join_household(text) to authenticated;

create or replace function public.my_data_owner()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select owner_id from public.baby_household_members where member_id = (select auth.uid()) limit 1),
    (select auth.uid())
  );
$$;

revoke execute on function public.my_data_owner() from public;
grant execute on function public.my_data_owner() to authenticated;
