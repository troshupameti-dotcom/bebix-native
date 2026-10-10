-- =====================================================================
-- Prindërit si ekip + gjyshërit.
--
-- 1) Rolet në familje: "parent" (lexon dhe shkruan gjithçka, si deri tani)
--    dhe "viewer" (gjyshërit / të afërmit: vetëm shikim). Shikuesi sheh
--    momentet, arritjet dhe rritjen; ushqimin, gjumin dhe pelenat vetëm kur
--    prindërit e lejojnë. Kurrë vaksinat dhe kartelën mjekësore.
--    `can_access_baby_data` mbetet vetëm për prindërit, pra çdo tabelë
--    ekzistuese (ilaçet, kapsula e kohës, profili për shkrim) s'i hapet
--    shikuesit pa e vendosur këtu me emër.
-- 2) Kush e shkroi shënimin (`baby_records.created_by`) — për "Babi ndërroi
--    6 pelena sot 💪".
-- 3) Emri/lidhja e secilit anëtar (Mami, Babi, Gjyshja) dhe gjuha e tij.
-- 4) "Faleminderit ❤️" — njoftim te partneri, më së shumti 3 në ditë.
-- 5) Turnet e natës: kush zgjohet sonte, me kujtesë në 20:30 sipas orës së tij.
--
-- PA EKZEKUTUAR: ekzekutoje te Supabase → SQL Editor.
-- =====================================================================

-- --- 1) Rolet ----------------------------------------------------------
alter table public.baby_household_members
  add column if not exists role text not null default 'parent';
alter table public.baby_household_invites
  add column if not exists role text not null default 'parent';

do $$ begin
  alter table public.baby_household_members add constraint baby_household_members_role_check check (role in ('parent', 'viewer'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.baby_household_invites add constraint baby_household_invites_role_check check (role in ('parent', 'viewer'));
exception when duplicate_object then null; end $$;

-- Vetëm prindërit (pronari + anëtarët "parent"): shkrim dhe lexim i plotë.
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
           where m.owner_id = p_owner and m.member_id = (select auth.uid()) and m.role = 'parent'
         );
$$;

-- Kushdo në familje, edhe shikuesit: vetëm për leximet e lejuara më poshtë.
create or replace function public.can_view_baby_data(p_owner uuid)
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

revoke execute on function public.can_view_baby_data(uuid) from public, anon;
grant execute on function public.can_view_baby_data(uuid) to authenticated;

create table if not exists public.household_settings (
  owner_id                uuid primary key references auth.users(id) on delete cascade,
  share_care_with_viewers boolean not null default false,
  updated_at              timestamptz not null default now()
);

alter table public.household_settings enable row level security;

drop policy if exists "household_settings_read" on public.household_settings;
create policy "household_settings_read"
  on public.household_settings for select to authenticated
  using (public.can_view_baby_data(owner_id));

drop policy if exists "household_settings_parents_write" on public.household_settings;
create policy "household_settings_parents_write"
  on public.household_settings for insert to authenticated
  with check (public.can_access_baby_data(owner_id));

drop policy if exists "household_settings_parents_update" on public.household_settings;
create policy "household_settings_parents_update"
  on public.household_settings for update to authenticated
  using (public.can_access_baby_data(owner_id))
  with check (public.can_access_baby_data(owner_id));

create or replace function public.viewers_see_care(p_owner uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select share_care_with_viewers from public.household_settings where owner_id = p_owner), false);
$$;

revoke execute on function public.viewers_see_care(uuid) from public, anon;
grant execute on function public.viewers_see_care(uuid) to authenticated;

-- Shikuesi: vetëm lexim, vetëm llojet e lejuara.
drop policy if exists "baby_records_viewers_read" on public.baby_records;
create policy "baby_records_viewers_read"
  on public.baby_records for select to authenticated
  using (
    public.can_view_baby_data(user_id)
    and (
      kind in ('moment', 'growth', 'timeline')
      or (kind in ('feeding', 'sleep', 'diaper') and public.viewers_see_care(user_id))
    )
  );

-- Emri, mosha dhe fotoja e bebit.
drop policy if exists "baby_profiles_viewers_read" on public.baby_profiles;
create policy "baby_profiles_viewers_read"
  on public.baby_profiles for select to authenticated
  using (public.can_view_baby_data(user_id));

-- Fotot e momenteve dhe të profilit (i njëjti bucket privat).
create or replace function public.can_view_baby_folder(p_folder text)
returns boolean
language sql
stable
set search_path = public
as $$
  select case
    when p_folder ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then public.can_view_baby_data(p_folder::uuid)
    else false
  end;
$$;

revoke execute on function public.can_view_baby_folder(text) from public, anon;
grant execute on function public.can_view_baby_folder(text) to authenticated;

drop policy if exists "Family viewers read moment files" on storage.objects;
create policy "Family viewers read moment files" on storage.objects
  for select to authenticated
  using (bucket_id = 'baby-moments' and public.can_view_baby_folder((storage.foldername(name))[1]));

-- Ftesa me rol. Funksioni i vjetër (pa argument) zëvendësohet: thirrja pa
-- argument vazhdon të japë ftesë prindi.
drop function if exists public.create_household_invite();
create or replace function public.create_household_invite(p_role text default 'parent')
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
  if coalesce(p_role, 'parent') not in ('parent', 'viewer') then
    raise exception 'Rol i panjohur.';
  end if;
  if exists (select 1 from public.baby_household_members where member_id = uid) then
    raise exception 'Je pjese e nje familjeje ekzistuese. Ftesen e ben pronari i te dhenave.';
  end if;
  if (select count(*) from public.baby_household_members where owner_id = uid) >= 12 then
    raise exception 'Familja ka arritur kufirin e anetareve.';
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

  insert into public.baby_household_invites (code, owner_id, expires_at, role)
  values (new_code, uid, now() + interval '7 days', coalesce(p_role, 'parent'));

  return new_code;
end;
$$;

revoke execute on function public.create_household_invite(text) from public, anon;
grant execute on function public.create_household_invite(text) to authenticated;

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

  insert into public.baby_household_members (owner_id, member_id, role)
  values (invite.owner_id, uid, invite.role);

  update public.baby_household_invites
  set used_at = now(), used_by = uid
  where code = invite.code;

  return invite.owner_id;
end;
$$;

revoke execute on function public.join_household(text) from public, anon;
grant execute on function public.join_household(text) to authenticated;

-- Roli im në familjen ku jam (pronari = 'parent').
create or replace function public.my_household_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role from public.baby_household_members where member_id = (select auth.uid()) limit 1),
    'parent'
  );
$$;

revoke execute on function public.my_household_role() from public, anon;
grant execute on function public.my_household_role() to authenticated;

-- --- 2) Kush e shkroi shënimin ----------------------------------------
-- Vendoset vetëm në krijim (upsert-i i app-it s'e dërgon këtë kolonë, pra
-- përditësimet s'e ndryshojnë). Shënimet e vjetra mbeten pa autor.
alter table public.baby_records
  add column if not exists created_by uuid default auth.uid();

create index if not exists baby_records_owner_occurred_idx
  on public.baby_records (user_id, occurred_at);

-- --- 3) Emri dhe lidhja e anëtarëve -----------------------------------
create table if not exists public.household_member_profiles (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  display_name text check (display_name is null or char_length(display_name) <= 40),
  relation     text check (relation is null or relation in ('mom', 'dad', 'guardian', 'grandparent', 'family')),
  lang         text not null default 'sq' check (lang in ('sq', 'en')),
  updated_at   timestamptz not null default now()
);

alter table public.household_member_profiles enable row level security;

-- Secili shkruan vetëm të vetin; leximi i të tjerëve bëhet me household_people().
drop policy if exists "member_profile_own" on public.household_member_profiles;
create policy "member_profile_own"
  on public.household_member_profiles for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Njerëzit e familjes sime: pronari, prindërit dhe shikuesit, me emrat.
create or replace function public.household_people()
returns table (user_id uuid, role text, display_name text, relation text, is_owner boolean, is_me boolean)
language sql
stable
security definer
set search_path = public
as $$
  with me as (select (select auth.uid()) as uid, public.my_data_owner() as owner),
  people as (
    select m.owner as user_id, 'parent'::text as role, true as is_owner from me m
    union all
    select hm.member_id, hm.role, false from public.baby_household_members hm, me m where hm.owner_id = m.owner
  )
  select p.user_id, p.role, mp.display_name, mp.relation, p.is_owner, p.user_id = (select uid from me)
  from people p
  left join public.household_member_profiles mp on mp.user_id = p.user_id
  where (select uid from me) is not null
    and public.can_view_baby_data((select owner from me))
    -- Shikuesi sheh vetëm prindërit dhe veten, jo shikuesit e tjerë.
    and (p.role = 'parent' or p.user_id = (select uid from me) or public.can_access_baby_data((select owner from me)));
$$;

revoke execute on function public.household_people() from public, anon;
grant execute on function public.household_people() to authenticated;

-- --- Përmbledhja e ditës sipas anëtarit -------------------------------
create or replace function public.household_day_summary(p_from timestamptz, p_to timestamptz)
returns table (member_id uuid, kind text, n int)
language sql
stable
security definer
set search_path = public
as $$
  select r.created_by, r.kind::text, count(*)::int
  from public.baby_records r
  where r.user_id = public.my_data_owner()
    and public.can_access_baby_data(r.user_id)
    and r.created_by is not null
    and r.kind in ('feeding', 'sleep', 'diaper')
    and r.deleted_at is null and r.archived_at is null
    and r.occurred_at >= p_from and r.occurred_at < p_to
    and p_to - p_from <= interval '2 days'
  group by r.created_by, r.kind;
$$;

revoke execute on function public.household_day_summary(timestamptz, timestamptz) from public, anon;
grant execute on function public.household_day_summary(timestamptz, timestamptz) to authenticated;

-- --- 4) Faleminderit ❤️ ------------------------------------------------
create table if not exists public.household_thanks (
  id         bigserial primary key,
  owner_id   uuid not null references auth.users(id) on delete cascade,
  from_user  uuid not null references auth.users(id) on delete cascade,
  to_user    uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists household_thanks_rate_idx on public.household_thanks (from_user, to_user, created_at desc);

-- Pa politika: vetëm funksioni më poshtë e prek.
alter table public.household_thanks enable row level security;

create or replace function public.member_label(p_user uuid, p_lang text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    nullif(trim(mp.display_name), ''),
    case mp.relation
      when 'mom' then case when p_lang = 'en' then 'Mom' else 'Mami' end
      when 'dad' then case when p_lang = 'en' then 'Dad' else 'Babi' end
      when 'grandparent' then case when p_lang = 'en' then 'Grandparent' else 'Gjyshi/Gjyshja' end
      else null
    end,
    case when p_lang = 'en' then 'Your partner' else 'Partneri' end
  )
  from (select 1) x
  left join public.household_member_profiles mp on mp.user_id = p_user;
$$;

revoke execute on function public.member_label(uuid, text) from public, anon, authenticated;

-- Kthen false kur u arrit kufiri (3 në ditë për të njëjtin person).
create or replace function public.send_household_thanks(p_to uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := (select auth.uid());
  v_owner uuid := public.my_data_owner();
  v_lang text;
  v_name text;
begin
  if v_me is null or not public.can_access_baby_data(v_owner) then
    raise exception 'not_a_parent';
  end if;
  if p_to is null or p_to = v_me then
    raise exception 'bad_recipient';
  end if;
  if not (p_to = v_owner or exists (
    select 1 from public.baby_household_members where owner_id = v_owner and member_id = p_to and role = 'parent'
  )) then
    raise exception 'bad_recipient';
  end if;
  if (select count(*) from public.household_thanks
      where from_user = v_me and to_user = p_to and created_at > now() - interval '1 day') >= 3 then
    return false;
  end if;

  insert into public.household_thanks (owner_id, from_user, to_user) values (v_owner, v_me, p_to);

  v_lang := coalesce((select lang from public.household_member_profiles where user_id = p_to), 'sq');
  v_name := public.member_label(v_me, v_lang);
  perform public.enqueue_notification(
    p_to, 'baby_team',
    case when v_lang = 'en' then 'Thank you ❤️' else 'Faleminderit ❤️' end,
    case when v_lang = 'en' then v_name || ' says thank you for today.' else v_name || ' të falënderon për sot.' end,
    jsonb_build_object('type', 'team'),
    null, now(), now() + interval '12 hours'
  );
  return true;
end;
$$;

revoke execute on function public.send_household_thanks(uuid) from public, anon;
grant execute on function public.send_household_thanks(uuid) to authenticated;

-- --- 5) Turnet e natës ------------------------------------------------
create table if not exists public.household_night_shifts (
  owner_id   uuid not null references auth.users(id) on delete cascade,
  night      date not null,
  user_id    uuid not null references auth.users(id) on delete cascade,
  set_by     uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (owner_id, night)
);

alter table public.household_night_shifts enable row level security;

drop policy if exists "night_shifts_parents_read" on public.household_night_shifts;
create policy "night_shifts_parents_read"
  on public.household_night_shifts for select to authenticated
  using (public.can_access_baby_data(owner_id));

-- Cakto (ose hiq, me p_user = null) kush zgjohet natën e dhënë. Kujtesa
-- shkon te ai në 20:30 sipas zonës së tij kohore; kur turni ndryshon,
-- kujtesa e të mëparshmit hiqet.
create or replace function public.set_night_shift(p_night date, p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := (select auth.uid());
  v_owner uuid := public.my_data_owner();
  v_prev uuid;
  v_tz text;
  v_lang text;
  v_send timestamptz;
  v_dedupe text := 'shift:' || p_night::text;
begin
  if v_me is null or not public.can_access_baby_data(v_owner) then
    raise exception 'not_a_parent';
  end if;
  if p_night is null or p_night < current_date - 1 or p_night > current_date + 14 then
    raise exception 'bad_night';
  end if;
  if p_user is not null and not (p_user = v_owner or exists (
    select 1 from public.baby_household_members where owner_id = v_owner and member_id = p_user and role = 'parent'
  )) then
    raise exception 'bad_member';
  end if;

  select user_id into v_prev from public.household_night_shifts where owner_id = v_owner and night = p_night;
  if v_prev is not null and v_prev is distinct from p_user then
    delete from public.notification_outbox where user_id = v_prev and dedupe_key = v_dedupe and sent_at is null;
  end if;

  if p_user is null then
    delete from public.household_night_shifts where owner_id = v_owner and night = p_night;
    return;
  end if;

  insert into public.household_night_shifts (owner_id, night, user_id, set_by, updated_at)
  values (v_owner, p_night, p_user, v_me, now())
  on conflict (owner_id, night) do update set user_id = excluded.user_id, set_by = excluded.set_by, updated_at = now();

  if v_prev is distinct from p_user then
    v_tz := coalesce((select timezone from public.notification_settings where user_id = p_user), 'Europe/Belgrade');
    begin
      v_send := (p_night + time '20:30') at time zone v_tz;
    exception when others then
      v_send := (p_night + time '20:30') at time zone 'Europe/Belgrade';
      v_tz := 'Europe/Belgrade';
    end;
    if v_send > now() then
      v_lang := coalesce((select lang from public.household_member_profiles where user_id = p_user), 'sq');
      perform public.enqueue_notification(
        p_user, 'baby_shift',
        case when v_lang = 'en' then 'Tonight is your night 🌙' else 'Sonte e ke ti radhën 🌙' end,
        case
          when p_user = v_me and v_lang = 'en' then 'You''re on for night wake-ups. Rest while you can 💛'
          when p_user = v_me then 'Ti zgjohesh sonte për bebin. Pusho sa të mundesh 💛'
          when v_lang = 'en' then public.member_label(v_me, 'en') || ' put you on tonight''s wake-ups. Thank you 💛'
          else public.member_label(v_me, 'sq') || ' të ka shënuar për zgjimet e sontme. Faleminderit 💛'
        end,
        jsonb_build_object('type', 'shift'),
        v_dedupe, v_send, (p_night + time '23:59') at time zone v_tz
      );
    end if;
  end if;
end;
$$;

revoke execute on function public.set_night_shift(date, uuid) from public, anon;
grant execute on function public.set_night_shift(date, uuid) to authenticated;

-- --- Kapsula e kohës: vetëm prindërit vulosin letra ----------------------
-- (shikuesit s'e shohin dot listën, ndaj as s'shkruajnë aty)
create or replace function public.seal_capsule_letter(p_title text, p_body text, p_unlock_on date)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid := public.my_data_owner();
  v_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated';
  end if;
  if not public.can_access_baby_data(v_owner) then
    raise exception 'not_a_parent';
  end if;
  if p_unlock_on is null or p_unlock_on <= current_date then
    raise exception 'unlock_date_must_be_future';
  end if;
  if p_unlock_on > current_date + interval '30 years' then
    raise exception 'unlock_date_too_far';
  end if;
  if (select count(*) from public.time_capsule_letters where owner_id = v_owner) >= 300 then
    raise exception 'too_many_letters';
  end if;

  insert into public.time_capsule_letters (owner_id, author_id, title, body, unlock_on)
  values (v_owner, (select auth.uid()), trim(p_title), p_body, p_unlock_on)
  returning id into v_id;
  return v_id;
end;
$$;
