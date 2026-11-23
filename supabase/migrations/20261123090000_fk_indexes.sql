-- Indekse për katër lidhje (foreign key) pa indeks, të gjetura nga Supabase Advisors më 23 nëntor 2026.
-- Pa to, fshirja e një recete/përralle ose e një llogarie kontrollon tabelat rresht pas rreshti.
--
-- I sigurt për t'u ekzekutuar dy herë (if not exists). S'fshin dhe s'ndryshon asnjë të dhënë.
-- Kthimi mbrapa (nëse duhet): drop index if exists <emri>; për secilin më poshtë.

create index if not exists ai_reports_user_id_idx on public.ai_reports (user_id);
create index if not exists recipe_favorites_recipe_slug_idx on public.recipe_favorites (recipe_slug);
create index if not exists story_favorites_story_slug_idx on public.story_favorites (story_slug);
create index if not exists story_progress_story_slug_idx on public.story_progress (story_slug);
