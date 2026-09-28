-- Cilesimet e bebit (gjinia, grupi i gjakut, alergjite, pediatri, shenimet,
-- kontaktet e urgjences, info mjekesore) rrinin vetem ne telefon: humbnin ne
-- telefon te ri dhe s'i shihte prindi tjeter i familjes. Ruhen ketu si JSON,
-- me te njejtat politika RLS si pjesa tjeter e profilit.
alter table public.baby_profiles
  add column if not exists details jsonb not null default '{}'::jsonb;

alter table public.baby_profiles drop constraint if exists baby_profiles_details_size;
alter table public.baby_profiles add constraint baby_profiles_details_size
  check (jsonb_typeof(details) = 'object' and pg_column_size(details) < 65536);
