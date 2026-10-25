-- Familja: kodet e ftesës me rastësi kriptografike dhe kufi provash (auditimi, gjetja #35).
--
-- Kodi mbetet 6 shenja nga 32 (rreth 1 miliard kombinime): app-et e instaluara pranojnë 6 shenja.
-- Me skadim 7 ditë dhe 10 prova të gabuara në orë për përdorues, gjetja e një kodi me provë s'bëhet dot.
--
-- Pse join_household nuk ngre më përjashtim për kodin e gabuar: përjashtimi anulon gjithë transaksionin,
-- pra edhe shënimin e provës. Tani kthen gabimin si JSON me statusin HTTP (response.status); PostgREST e
-- mbyll transaksionin me COMMIT, ndaj prova mbetet e shënuar, kurse supabase-js e jep si `error` me të
-- njëjtën `message` si më parë (app-i s'ndryshon).
--
-- I sigurt për t'u ekzekutuar dy herë; nuk fshin të dhëna (vetëm provat më të vjetra se një ditë).

create table if not exists public.household_join_attempts (
  user_id uuid not null,
  attempted_at timestamptz not null default now()
);
create index if not exists household_join_attempts_user_time on public.household_join_attempts (user_id, attempted_at);
alter table public.household_join_attempts enable row level security;
-- Vetëm funksionet e sigurta e lexojnë dhe e shkruajnë; app-i s'ka qasje.
revoke all on public.household_join_attempts from anon, authenticated;
grant select, insert, delete on public.household_join_attempts to service_role;

-- Gabimi për app-in: statusi HTTP + JSON në formën e PostgREST (message, code, details, hint).
create or replace function public.household_join_error(p_message text, p_status text default '400')
returns json
language plpgsql
set search_path = public
as $$
begin
  perform set_config('response.status', p_status, true);
  return json_build_object('message', p_message, 'code', 'P0001', 'details', null, 'hint', null);
end;
$$;
revoke all on function public.household_join_error(text, text) from public, anon, authenticated;

create or replace function public.create_household_invite(p_role text default 'parent')
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- 32 shenja, pa 0/O dhe 1/I
  new_code text;
  bytes bytea;
  uid uuid := (select auth.uid());
begin
  if uid is null then
    raise exception 'Duhet të jesh i kyçur.';
  end if;
  if coalesce(p_role, 'parent') not in ('parent', 'viewer') then
    raise exception 'Rol i panjohur.';
  end if;
  if exists (select 1 from public.baby_household_members where member_id = uid) then
    raise exception 'Je pjesë e një familjeje ekzistuese. Ftesën e bën pronari i të dhënave.';
  end if;
  if (select count(*) from public.baby_household_members where owner_id = uid) >= 12 then
    raise exception 'Familja ka arritur kufirin e anëtarëve.';
  end if;

  for i in 1..10 loop
    -- gen_random_uuid() merr bajtet nga burimi kriptografik i Postgres-it; 6 bajtet e para s'kanë bite fikse.
    -- 256 ndahet saktë me 32, ndaj çdo shenjë ka të njëjtën gjasë.
    bytes := decode(replace(gen_random_uuid()::text, '-', ''), 'hex');
    new_code := '';
    for j in 0..5 loop
      new_code := new_code || substr(alphabet, (get_byte(bytes, j) % 32) + 1, 1);
    end loop;
    exit when not exists (select 1 from public.baby_household_invites where code = new_code);
    new_code := null;
  end loop;

  if new_code is null then
    raise exception 'S''u krijua dot kodi. Provo përsëri.';
  end if;

  insert into public.baby_household_invites (code, owner_id, expires_at, role)
  values (new_code, uid, now() + interval '7 days', coalesce(p_role, 'parent'));

  return new_code;
end;
$$;

-- Lloji i kthimit ndryshon (uuid → json), ndaj funksioni i vjetër hiqet para se të krijohet i riu.
drop function if exists public.join_household(text);
create function public.join_household(p_code text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := (select auth.uid());
  invite public.baby_household_invites;
  problem text;
begin
  if uid is null then
    return public.household_join_error('Duhet të jesh i kyçur.', '401');
  end if;
  if (select count(*) from public.household_join_attempts
      where user_id = uid and attempted_at > now() - interval '1 hour') >= 10 then
    return public.household_join_error('Shumë prova me kod të gabuar. Provo përsëri pas një ore.', '429');
  end if;

  select * into invite
  from public.baby_household_invites
  where code = upper(trim(p_code))
  for update;

  if invite.code is null then
    problem := 'Kodi nuk u gjet.';
  elsif invite.used_at is not null then
    problem := 'Ky kod është përdorur tashmë.';
  elsif invite.expires_at < now() then
    problem := 'Kodi ka skaduar. Kërko një të ri.';
  elsif invite.owner_id = uid then
    problem := 'Ky është kodi yt.';
  elsif exists (select 1 from public.baby_household_members where member_id = uid) then
    problem := 'Je tashmë pjesë e një familjeje. Dil prej saj para se të bashkohesh me një tjetër.';
  elsif exists (select 1 from public.baby_household_members where owner_id = uid) then
    problem := 'Ke tashmë një familje me anëtarë. Hiqi ata para se të bashkohesh diku tjetër.';
  end if;

  if problem is not null then
    insert into public.household_join_attempts (user_id) values (uid);
    return public.household_join_error(problem, '400');
  end if;

  insert into public.baby_household_members (owner_id, member_id, role)
  values (invite.owner_id, uid, invite.role);

  update public.baby_household_invites
  set used_at = now(), used_by = uid
  where code = invite.code;

  delete from public.household_join_attempts where attempted_at < now() - interval '1 day';

  return json_build_object('owner_id', invite.owner_id);
end;
$$;

revoke all on function public.create_household_invite(text) from public, anon;
grant execute on function public.create_household_invite(text) to authenticated;
revoke all on function public.join_household(text) from public, anon;
grant execute on function public.join_household(text) to authenticated;
