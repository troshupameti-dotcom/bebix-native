-- =====================================================================
-- Kujtesat e ilaceve.
--
-- Te dhenat mjekesore ishin vetem regjistrime te asaj qe u dha — pa orar,
-- pa perseritje. Pra "kujtome per ilacin" nuk kishte ku te mbeshtetej.
-- Kjo tabele mban orarin: emri, cdo sa ore, deri kur.
--
-- I perket pronarit te te dhenave (jo llogarise), qe ta shohin te dy
-- prinderit — si gjithcka tjeter e bebit.
--
-- APLIKUAR TASHME ne projekt (version 20260919010649).
-- =====================================================================

create table if not exists public.medication_schedules (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  name           text not null check (char_length(trim(name)) between 1 and 80),
  dose           text check (dose is null or char_length(dose) <= 60),
  interval_hours smallint not null check (interval_hours between 1 and 48),
  start_at       timestamptz not null default now(),
  end_at         timestamptz,
  last_sent_at   timestamptz,
  active         boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists medication_schedules_due_idx
  on public.medication_schedules (active, start_at) where active;

alter table public.medication_schedules enable row level security;

drop policy if exists "medication_schedules_household" on public.medication_schedules;
create policy "medication_schedules_household"
  on public.medication_schedules for all to authenticated
  using (public.can_access_baby_data(user_id))
  with check (public.can_access_baby_data(user_id));

-- Cfare eshte per t'u kujtuar tani: e para dose pas start_at, ose cdo
-- interval pas asaj te fundit.
create or replace function public.due_medications()
returns table (id uuid, user_id uuid, name text, dose text, slot text)
language sql security definer set search_path = public as $$
  select m.id, m.user_id, m.name, m.dose,
         to_char(date_trunc('hour', now()), 'YYYYMMDDHH24') as slot
  from public.medication_schedules m
  where m.active
    and m.start_at <= now()
    and (m.end_at is null or m.end_at > now())
    and (m.last_sent_at is null or m.last_sent_at + make_interval(hours => m.interval_hours) <= now())
  limit 500;
$$;

revoke execute on function public.due_medications() from public, anon, authenticated;

create or replace function public.mark_medication_sent(p_ids uuid[])
returns void language sql security definer set search_path = public as $$
  update public.medication_schedules
  set last_sent_at = now(), updated_at = now()
  where id = any(p_ids);
$$;

revoke execute on function public.mark_medication_sent(uuid[]) from public, anon, authenticated;
