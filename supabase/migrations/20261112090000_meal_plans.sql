-- Recetat 🥣, Faza C: "Plani i javës" i familjes.
-- `meal_plan_slots`: një rresht për çdo vakt të planit (data × mëngjes / drekë / darkë / zemër) të një fëmije. E
-- ndajnë të dy prindërit, si "Ekipi": e shkruajnë dhe e lexojnë prindërit e familjes; gjyshërit (viewer) vetëm e
-- lexojnë; askush tjetër s'e sheh. Kështu plani s'humbet kur ndërrohet telefoni.
-- Vakti bosh mbahet si rresht me `recipe_slug = null` (që heqja të arrijë edhe te telefoni i prindit tjetër).
-- Çdo vakt i përket një fëmije (`baby_id`); pa të, shkon te fëmija falas, si te `baby_records` dhe `food_tries`.
-- I sigurt për t'u ekzekutuar dy herë; s'fshin asgjë. Çdo hap qëndron më vete (s'varet nga transaksioni).
-- Kërkon migrimet e familjes (20261011090000_household_team.sql) dhe të fëmijëve (20261021090000_age_system_01_children.sql).
-- Kthimi, vetëm nëse e do: drop table if exists public.meal_plan_slots;  (s'prek asnjë tabelë tjetër)

create table if not exists public.meal_plan_slots (
  user_id     uuid not null references auth.users(id) on delete cascade,
  baby_id     text not null,
  plan_date   date not null,
  meal        text not null check (meal in ('breakfast', 'lunch', 'dinner', 'snack')),
  recipe_slug text check (recipe_slug is null or char_length(recipe_slug) between 1 and 80),
  created_by  uuid default auth.uid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (user_id, baby_id, plan_date, meal)
);

create index if not exists meal_plan_slots_date_idx on public.meal_plan_slots (user_id, plan_date);

-- E njëjta rregull si te `baby_records`: pa fëmijë → fëmija falas; një fëmijë i një familjeje tjetër refuzohet.
-- (Mbushet para kontrollit `not null` dhe para `on conflict`, ndaj app-i mund ta dërgojë bosh.)
drop trigger if exists meal_plan_slots_fill_child on public.meal_plan_slots;
create trigger meal_plan_slots_fill_child before insert or update on public.meal_plan_slots
  for each row execute function public.baby_records_fill_child();

alter table public.meal_plan_slots enable row level security;

-- Prindërit e familjes: lexim dhe shkrim i plotë.
drop policy if exists "meal_plan_parents" on public.meal_plan_slots;
create policy "meal_plan_parents"
  on public.meal_plan_slots for all to authenticated
  using (public.can_access_baby_data(user_id))
  with check (public.can_access_baby_data(user_id));

-- Gjyshërit e familjes: vetëm lexim (që ta dinë çfarë të gatuajnë kur e mbajnë fëmijën).
drop policy if exists "meal_plan_family_read" on public.meal_plan_slots;
create policy "meal_plan_family_read"
  on public.meal_plan_slots for select to authenticated
  using (public.can_view_baby_data(user_id));

revoke all on public.meal_plan_slots from anon;
grant select, insert, update, delete on public.meal_plan_slots to authenticated;
grant all on public.meal_plan_slots to service_role;
