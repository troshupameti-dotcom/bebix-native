-- =====================================================================
-- Kapsula e kohës: letra për fëmijën, të mbyllura deri në një datë
-- (parazgjedhja: ditëlindja e 18-të).
--
-- Mbyllja ruhet nga serveri, jo vetëm nga app-i:
--  - teksti (`body`) s'lexohet dot me SELECT — vetëm titulli dhe data;
--  - teksti merret vetëm me open_capsule_letter(), që e jep kur ka ardhur data;
--  - letra s'ndryshohet pasi mbyllet (si një zarf i vulosur); mund të fshihet
--    vetëm nga ai që e shkroi.
--
-- I përket pronarit të të dhënave (si gjithçka e bebit), që ta shohin të dy
-- prindërit e familjes.
--
-- PA EKZEKUTUAR: ekzekutoje te Supabase → SQL Editor.
-- =====================================================================

create table if not exists public.time_capsule_letters (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references auth.users(id) on delete cascade,
  author_id  uuid references auth.users(id) on delete set null,
  title      text not null check (char_length(trim(title)) between 1 and 120),
  body       text not null check (char_length(trim(body)) between 1 and 20000),
  unlock_on  date not null,
  created_at timestamptz not null default now()
);

create index if not exists time_capsule_letters_owner_idx
  on public.time_capsule_letters (owner_id, unlock_on);

alter table public.time_capsule_letters enable row level security;

-- Vetëm kolonat pa tekst lexohen drejtpërdrejt; shkrimi bëhet vetëm me funksionin.
revoke all on public.time_capsule_letters from public, anon, authenticated;
grant select (id, owner_id, author_id, title, unlock_on, created_at) on public.time_capsule_letters to authenticated;
grant delete on public.time_capsule_letters to authenticated;

drop policy if exists "time_capsule_household_read" on public.time_capsule_letters;
create policy "time_capsule_household_read"
  on public.time_capsule_letters for select to authenticated
  using (public.can_access_baby_data(owner_id));

drop policy if exists "time_capsule_author_delete" on public.time_capsule_letters;
create policy "time_capsule_author_delete"
  on public.time_capsule_letters for delete to authenticated
  using (author_id = (select auth.uid()) and public.can_access_baby_data(owner_id));

-- Vulos një letër të re. Data duhet të jetë në të ardhmen.
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

revoke execute on function public.seal_capsule_letter(text, text, date) from public, anon;
grant execute on function public.seal_capsule_letter(text, text, date) to authenticated;

-- Hap letrën: teksti jepet vetëm kur ka ardhur data, dhe vetëm brenda familjes.
create or replace function public.open_capsule_letter(p_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select body from public.time_capsule_letters
  where id = p_id
    and unlock_on <= current_date
    and public.can_access_baby_data(owner_id);
$$;

revoke execute on function public.open_capsule_letter(uuid) from public, anon;
grant execute on function public.open_capsule_letter(uuid) to authenticated;
