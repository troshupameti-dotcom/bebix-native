-- =====================================================================
-- Sistemi i moshës, pjesa 5: shtatzënia.
--
-- `pregnancy_weeks`: përmbajtja e javëve 1–40 të shtatzënisë, me të njëjtën
-- strukturë si `development_weeks` (lang sq/en, java nga–deri, titulli, teksti,
-- idetë). BOSH me qëllim: përmbajtjen mjekësore e shkruan Meti (nga paneli ose
-- me SQL). App-i punon pa të: tregon javën dhe ditët deri në lindje.
--
-- Rendi: pas 20261021090000_age_system_01_children.sql. I sigurt për dy
-- ekzekutime; s'fshin asgjë.
-- PA EKZEKUTUAR: ekzekutoje te Supabase → SQL Editor.
-- =====================================================================

create table if not exists public.pregnancy_weeks (
  id         uuid primary key default gen_random_uuid(),
  lang       text not null check (lang in ('sq', 'en')),
  week_from  smallint not null check (week_from between 1 and 42),
  week_to    smallint not null check (week_to between 1 and 42),
  title      text not null check (char_length(trim(title)) between 1 and 80),
  body       text not null check (char_length(trim(body)) between 1 and 600),
  ideas      text[] not null default '{}' check (coalesce(array_length(ideas, 1), 0) <= 5),
  is_active  boolean not null default true,
  updated_at timestamptz not null default now(),
  constraint pregnancy_weeks_range check (week_to >= week_from),
  constraint pregnancy_weeks_unique unique (lang, week_from)
);

alter table public.pregnancy_weeks enable row level security;

drop policy if exists "pregnancy_weeks_read" on public.pregnancy_weeks;
create policy "pregnancy_weeks_read"
  on public.pregnancy_weeks for select to anon, authenticated
  using (is_active or public.is_admin());

drop policy if exists "pregnancy_weeks_admin" on public.pregnancy_weeks;
create policy "pregnancy_weeks_admin"
  on public.pregnancy_weeks for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Shembull si shtohet një javë (pa e ekzekutuar këtu):
-- insert into public.pregnancy_weeks (lang, week_from, week_to, title, body, ideas)
-- values ('sq', 12, 12, 'Titulli', 'Teksti i javës 12.', array['Ide 1', 'Ide 2']);
