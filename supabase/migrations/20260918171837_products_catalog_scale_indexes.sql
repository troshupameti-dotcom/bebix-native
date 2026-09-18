-- Indekset qe i duhen nje katalogu me mijera produkte. Pa to, cdo kerkim
-- dhe cdo filter skanon gjithe tabelen.
--
-- APLIKUAR TASHME ne projekt (version 20260918171837). Ky skedar mban
-- permbajtjen ne repo; ekzekutimi perseri eshte i padëmshem.

create index if not exists products_active_created_idx
  on public.products (created_at desc) where is_active;

create index if not exists products_active_category_idx
  on public.products (category_id, created_at desc) where is_active;

create index if not exists products_active_brand_idx
  on public.products (brand_id, created_at desc) where is_active;

create index if not exists products_active_price_idx
  on public.products (price) where is_active;

create index if not exists products_active_rating_idx
  on public.products (rating desc) where is_active;

-- Kerkimi me `ilike '%term%'`: pa trigram, asnje indeks nuk perdoret.
create extension if not exists pg_trgm;

create index if not exists products_name_trgm_idx
  on public.products using gin (name gin_trgm_ops);

create index if not exists brands_name_trgm_idx
  on public.brands using gin (name gin_trgm_ops);
