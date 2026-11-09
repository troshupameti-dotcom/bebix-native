-- Recetat 🥣, Faza B: ushqimet e para dhe alergjenët.
-- 1) `foods`: udhëzuesi i ushqimeve (si serviret sipas moshës, rreziku i mbytjes, alergjeni). E lexojnë të gjithë, e
--    ndryshojnë vetëm adminët. `recipes.ingredients[].food_key` tregon te `foods.food_key`.
-- 2) `food_tries`: provat e çdo fëmije ("E provoi 5 herë", 😋/🙂/🙅, "pati reagim?"). Si `baby_records`: i shkruajnë
--    dhe i lexojnë prindërit e familjes; gjyshërit (viewer) i lexojnë vetëm kur ndizet "Gjyshërit shohin edhe
--    kujdesin". Çdo provë i përket një fëmije (`baby_id`); pa të, shkon te fëmija falas, si te `baby_records`.
-- I sigurt për t'u ekzekutuar dy herë; s'fshin asgjë. Çdo hap qëndron më vete (s'varet nga transaksioni).
-- Kërkon migrimet e familjes (20261011090000_household_team.sql) dhe të fëmijëve (20261021090000_age_system_01_children.sql).
-- Ushqimet fillestare shtohen nga 20261111090100_foods_library_1.sql.

-- --- 1) Ushqimet ---------------------------------------------------------------
create table if not exists public.foods (
  food_key        text primary key check (food_key ~ '^[a-z0-9]+(_[a-z0-9]+)*$' and char_length(food_key) <= 40),
  name            text not null check (char_length(name) between 1 and 80),
  category        text not null check (category in ('fruit', 'vegetable', 'grain', 'protein', 'dairy', 'allergen')),
  age_from_months integer not null default 6 check (age_from_months between 0 and 60),
  choking_risk    text not null default 'low' check (choking_risk in ('low', 'medium', 'high')),
  allergen        text check (allergen is null or allergen in ('milk', 'egg', 'wheat', 'peanut', 'tree_nut', 'sesame', 'soy', 'fish', 'shellfish')),
  serve_by_age    jsonb not null default '{}' check (jsonb_typeof(serve_by_age) = 'object'),
  nutrients       text[] not null default '{}'
                    check (nutrients <@ array['iron', 'protein', 'calcium', 'vitamin_c', 'fiber', 'omega3']::text[]),
  tip             text not null default '' check (char_length(tip) <= 400),
  sort_order      integer not null default 1000,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create or replace function public.foods_touch()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists foods_touch on public.foods;
create trigger foods_touch before update on public.foods
  for each row execute function public.foods_touch();

alter table public.foods enable row level security;

drop policy if exists "foods_read_all" on public.foods;
create policy "foods_read_all"
  on public.foods for select to anon, authenticated
  using (true);

drop policy if exists "foods_admin_insert" on public.foods;
create policy "foods_admin_insert"
  on public.foods for insert to authenticated
  with check ((select public.is_admin()));

drop policy if exists "foods_admin_update" on public.foods;
create policy "foods_admin_update"
  on public.foods for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

drop policy if exists "foods_admin_delete" on public.foods;
create policy "foods_admin_delete"
  on public.foods for delete to authenticated
  using ((select public.is_admin()));

-- Nga 30 tetori 2026 Supabase s'jep leje vetë: lejet shkruhen këtu. RLS-ja vendos çfarë sheh secili.
grant select on public.foods to anon, authenticated;
grant insert, update, delete on public.foods to authenticated;
grant all on public.foods to service_role;

-- --- 2) Provat e fëmijës -------------------------------------------------------
-- `user_id` = pronari i të dhënave të familjes (si te `baby_records`); `id` e krijon telefoni, që prova të ruhet
-- edhe pa rrjet dhe të dërgohet më vonë pa u dyfishuar. Fshirja është e butë (`deleted_at`), që të arrijë te
-- telefoni tjetër.
create table if not exists public.food_tries (
  user_id     uuid not null references auth.users(id) on delete cascade,
  id          text not null check (char_length(id) between 1 and 64),
  baby_id     text,
  food_key    text not null check (food_key ~ '^[a-z0-9]+(_[a-z0-9]+)*$' and char_length(food_key) <= 40),
  tried_at    timestamptz not null,
  liking      text check (liking is null or liking in ('all', 'some', 'refused')),
  reaction    boolean not null default false,
  symptoms    text[] not null default '{}' check (symptoms <@ array['rash', 'vomit', 'swelling', 'other']::text[]),
  note        text not null default '' check (char_length(note) <= 500),
  recipe_slug text check (recipe_slug is null or char_length(recipe_slug) <= 80),
  created_by  uuid default auth.uid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz,
  primary key (user_id, id)
);

create index if not exists food_tries_child_idx on public.food_tries (user_id, baby_id);

-- E njëjta rregull si te `baby_records`: pa fëmijë → fëmija falas; një fëmijë i një familjeje tjetër refuzohet.
drop trigger if exists food_tries_fill_child on public.food_tries;
create trigger food_tries_fill_child before insert or update on public.food_tries
  for each row execute function public.baby_records_fill_child();

alter table public.food_tries enable row level security;

-- Prindërit e familjes: lexim dhe shkrim i plotë.
drop policy if exists "food_tries_parents" on public.food_tries;
create policy "food_tries_parents"
  on public.food_tries for all to authenticated
  using (public.can_access_baby_data(user_id))
  with check (public.can_access_baby_data(user_id));

-- Gjyshërit: vetëm lexim, dhe vetëm kur prindërit ndajnë kujdesin.
drop policy if exists "food_tries_viewers_read" on public.food_tries;
create policy "food_tries_viewers_read"
  on public.food_tries for select to authenticated
  using (public.can_view_baby_data(user_id) and public.viewers_see_care(user_id));

revoke all on public.food_tries from anon;
grant select, insert, update, delete on public.food_tries to authenticated;
grant all on public.food_tries to service_role;
