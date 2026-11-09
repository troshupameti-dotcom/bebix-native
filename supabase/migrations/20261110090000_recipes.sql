-- Recetat 🥣: receta dhe ushqimet e para për bebe e fëmijë (6 muaj–5 vjeç), si te Përrallat.
-- Biblioteka e lexojnë të gjithë, e ndryshojnë vetëm adminët; app-i lexon vetëm ato me status 'published'. Recetat e
-- reja shtohen këtu (Table Editor ose SQL) dhe dalin në app pa përditësim. Fotot shkojnë te bucket-i publik
-- `recipe-covers` (cover_url); pa foto, app-i vizaton pjatën sipas `cover_key`.
-- Të preferuarat e çdo prindi ruhen te `recipe_favorites`.
-- Njësitë e përbërësve janë vetëm g, ml, copë, lugë gjelle, lugë çaji, filxhan: baza refuzon çdo tjetër.
-- I sigurt për t'u ekzekutuar dy herë; s'fshin asgjë. Çdo hap qëndron më vete (s'varet nga transaksioni).
-- Recetat fillestare shtohen nga 20261110090100_recipes_library_1.sql.

-- Përbërësit: listë objektesh { name, amount, unit, food_key, optional }, me njësitë e lejuara.
create or replace function public.recipes_ingredients_valid(p jsonb)
returns boolean
language sql
immutable
set search_path = public
as $$
  select jsonb_typeof(p) = 'array'
    and jsonb_array_length(p) between 1 and 40
    and not exists (
      select 1 from jsonb_array_elements(p) e
      where jsonb_typeof(e) <> 'object'
         or jsonb_typeof(e -> 'name') <> 'string'
         or char_length(e ->> 'name') not between 1 and 120
         or (case when jsonb_typeof(e -> 'amount') = 'number' then (e ->> 'amount')::numeric <= 0 else true end)
         or coalesce(e ->> 'unit', '') not in ('g', 'ml', 'copë', 'lugë gjelle', 'lugë çaji', 'filxhan')
         or (e ? 'food_key' and jsonb_typeof(e -> 'food_key') not in ('string', 'null'))
    );
$$;

create table if not exists public.recipes (
  id               uuid primary key default gen_random_uuid(),
  slug             text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 80),
  language         text not null default 'sq' check (char_length(language) between 2 and 5),
  title            text not null check (char_length(title) between 1 and 120),
  summary          text not null default '' check (char_length(summary) <= 400),
  age_min_months   integer not null default 6 check (age_min_months between 0 and 216),
  age_max_months   integer not null default 60 check (age_max_months between 1 and 216),
  stage            text not null default 'pure' check (stage in ('pure', 'mashed', 'finger', 'family')),
  feeding_style    text[] not null default '{}' check (feeding_style <@ array['puree', 'blw']::text[]),
  meal_types       text[] not null default '{}' check (meal_types <@ array['breakfast', 'lunch', 'dinner', 'snack']::text[]),
  prep_minutes     integer not null default 0 check (prep_minutes between 0 and 600),
  cook_minutes     integer not null default 0 check (cook_minutes between 0 and 1440),
  yield_note       text not null default '' check (char_length(yield_note) <= 120),
  family_factor    numeric(3, 1) not null default 3 check (family_factor between 1 and 8),
  ingredients      jsonb not null check (public.recipes_ingredients_valid(ingredients)),
  steps            text[] not null check (cardinality(steps) between 1 and 40),
  serve_by_age     jsonb not null default '{}' check (jsonb_typeof(serve_by_age) = 'object'),
  allergens        text[] not null default '{}'
                     check (allergens <@ array['milk', 'egg', 'wheat', 'peanut', 'tree_nut', 'sesame', 'soy', 'fish', 'shellfish']::text[]),
  diet_tags        text[] not null default '{}'
                     check (diet_tags <@ array['vegetarian', 'dairy_free', 'gluten_free', 'egg_free', 'nut_free']::text[]),
  nutrients        text[] not null default '{}'
                     check (nutrients <@ array['iron', 'protein', 'calcium', 'vitamin_c', 'fiber', 'omega3']::text[]),
  freezer_friendly boolean not null default false,
  storage_note     text not null default '' check (char_length(storage_note) <= 600),
  freezer_note     text not null default '' check (char_length(freezer_note) <= 600),
  reheat_note      text not null default '' check (char_length(reheat_note) <= 600),
  choking_note     text not null default '' check (char_length(choking_note) <= 600),
  family_tip       text not null default '' check (char_length(family_tip) <= 600),
  season           text[] not null default '{}' check (season <@ array['spring', 'summer', 'autumn', 'winter']::text[]),
  is_albanian      boolean not null default false,
  cover_key        text check (cover_key is null or char_length(cover_key) <= 40),
  cover_url        text check (cover_url is null or cover_url ~ '^https://'),
  cover_svg        text check (cover_svg is null or char_length(cover_svg) <= 60000),
  status           text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  featured         boolean not null default false,
  sort_order       integer not null default 1000,
  source           text not null default 'editor' check (source in ('editor', 'ai')),
  published_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint recipes_age_range check (age_max_months >= age_min_months)
);

-- Lista e app-it: vetëm të publikuarat, sipas radhës.
create index if not exists recipes_published_order_idx on public.recipes (sort_order, slug) where status = 'published';

-- updated_at ndryshon me çdo ndryshim (app-i e përdor për ta marrë recetën sërish); published_at vendoset vetë.
create or replace function public.recipes_touch()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  if new.status = 'published' and new.published_at is null then
    new.published_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists recipes_touch on public.recipes;
create trigger recipes_touch before insert or update on public.recipes
  for each row execute function public.recipes_touch();

alter table public.recipes enable row level security;

drop policy if exists "recipes_read_published" on public.recipes;
create policy "recipes_read_published"
  on public.recipes for select to anon, authenticated
  using (status = 'published');

drop policy if exists "recipes_admin_read" on public.recipes;
create policy "recipes_admin_read"
  on public.recipes for select to authenticated
  using ((select public.is_admin()));

drop policy if exists "recipes_admin_insert" on public.recipes;
create policy "recipes_admin_insert"
  on public.recipes for insert to authenticated
  with check ((select public.is_admin()));

drop policy if exists "recipes_admin_update" on public.recipes;
create policy "recipes_admin_update"
  on public.recipes for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

drop policy if exists "recipes_admin_delete" on public.recipes;
create policy "recipes_admin_delete"
  on public.recipes for delete to authenticated
  using ((select public.is_admin()));

-- Nga 30 tetori 2026 Supabase s'jep leje vetë: lejet shkruhen këtu. RLS-ja vendos çfarë sheh secili.
grant select on public.recipes to anon, authenticated;
grant insert, update, delete on public.recipes to authenticated;
grant all on public.recipes to service_role;

-- Të preferuarat e çdo prindi.
create table if not exists public.recipe_favorites (
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  recipe_slug text not null references public.recipes(slug) on update cascade on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, recipe_slug)
);

alter table public.recipe_favorites enable row level security;

drop policy if exists "recipe_favorites_own_read" on public.recipe_favorites;
create policy "recipe_favorites_own_read"
  on public.recipe_favorites for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "recipe_favorites_own_insert" on public.recipe_favorites;
create policy "recipe_favorites_own_insert"
  on public.recipe_favorites for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "recipe_favorites_own_update" on public.recipe_favorites;
create policy "recipe_favorites_own_update"
  on public.recipe_favorites for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "recipe_favorites_own_delete" on public.recipe_favorites;
create policy "recipe_favorites_own_delete"
  on public.recipe_favorites for delete to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.recipe_favorites from anon;
grant select, insert, update, delete on public.recipe_favorites to authenticated;
grant all on public.recipe_favorites to service_role;

-- Fotot e recetave: bucket publik (lexohen me lidhje të drejtpërdrejtë), i ngarkojnë dhe i ndryshojnë vetëm adminët.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('recipe-covers', 'recipe-covers', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = true, file_size_limit = 2097152, allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

drop policy if exists recipe_covers_admin_insert on storage.objects;
create policy recipe_covers_admin_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'recipe-covers' and (select public.is_admin()));

drop policy if exists recipe_covers_admin_update on storage.objects;
create policy recipe_covers_admin_update on storage.objects for update to authenticated
  using (bucket_id = 'recipe-covers' and (select public.is_admin()))
  with check (bucket_id = 'recipe-covers' and (select public.is_admin()));

drop policy if exists recipe_covers_admin_delete on storage.objects;
create policy recipe_covers_admin_delete on storage.objects for delete to authenticated
  using (bucket_id = 'recipe-covers' and (select public.is_admin()));
