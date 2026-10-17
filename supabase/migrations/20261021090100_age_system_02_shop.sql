-- =====================================================================
-- Sistemi i moshës, pjesa 2: dyqani rendit sipas moshës, kurrë s'filtron.
--
-- Çdo produkt shfaqet për çdo moshë. Rendi:
--   rank 0  produkti ka moshë (min dhe/ose max) dhe përputhet me fëmijën aktiv
--   rank 1  produkt pa moshë (universal)
--   rank 2  produkt me moshë që s'përputhet (në fund, por i dukshëm dhe i blueshëm)
-- Shtatzënia: "Për nënën" dhe "Dhoma e bebit" në krye (rank 0); produktet për
-- të porsalindurit (mosha 0) dhe ato universale pas tyre (rank 1).
-- Brenda çdo ranku mbetet renditja ekzistuese (më të rejat / çmimi / vlerësimi).
-- Në kërkim: përputhja me tekstin së pari, pastaj ranku, pastaj renditja.
--
-- `min_age_months` / `max_age_months` janë jsonb (muaj). Pranohen numër,
-- tekst me numër ("6"), null; çdo gjë tjetër = pa kufi.
--
-- Rendi: pas 20261021090000_age_system_01_children.sql. I sigurt për dy
-- ekzekutime; s'ndryshon asnjë produkt ose kategori ekzistuese.
-- PA EKZEKUTUAR: ekzekutoje te Supabase → SQL Editor.
-- =====================================================================

-- --- 1) Mosha e produktit si numër ---------------------------------------
create or replace function public.age_months_value(p jsonb)
returns numeric
language sql
immutable
set search_path = public
as $$
  select case
    when p is null or jsonb_typeof(p) = 'null' then null
    when jsonb_typeof(p) = 'number' then (p #>> '{}')::numeric
    when jsonb_typeof(p) = 'string' and (p #>> '{}') ~ '^\s*[0-9]+(\.[0-9]+)?\s*$' then trim(p #>> '{}')::numeric
    else null
  end;
$$;

-- --- 2) Ranku i një produkti ----------------------------------------------
-- p_from/p_to: mosha e fëmijës në muaj (e njëjta vlerë), ose grupmosha që
-- zgjodhi prindi te çipat. Pa moshë (null) dhe pa shtatzëni: të gjithë rank 1.
create or replace function public.shop_age_rank(
  p_min jsonb, p_max jsonb, p_category_key text,
  p_from numeric, p_to numeric, p_pregnancy boolean
)
returns int
language sql
immutable
set search_path = public
as $$
  with v as (
    select public.age_months_value(p_min) as mn, public.age_months_value(p_max) as mx
  )
  select case
    when p_pregnancy then
      case
        when p_category_key in ('Për nënën', 'Dhoma e bebit') then 0
        when v.mn is null and v.mx is null then 1
        when coalesce(v.mn, 0) <= 0 then 1
        else 2
      end
    when p_from is null then 1
    when v.mn is null and v.mx is null then 1
    when (v.mn is null or v.mn <= coalesce(p_to, p_from)) and (v.mx is null or v.mx >= p_from) then 0
    else 2
  end
  from v;
$$;

-- --- 3) Faqja e dyqanit e renditur ----------------------------------------
-- Kthen vetëm id-të me pozicionin dhe numrin total; app-i lexon pastaj
-- produktet si më parë (me markën dhe kategorinë) dhe i vë në këtë radhë.
-- Security invoker: vlejnë politikat ekzistuese të `products`.
create or replace function public.shop_product_order(
  p_category text default null,
  p_brand uuid default null,
  p_on_sale boolean default false,
  p_search text default null,
  p_sort text default 'newest',
  p_age_from numeric default null,
  p_age_to numeric default null,
  p_pregnancy boolean default false,
  p_offset int default 0,
  p_limit int default 20
)
returns table (product_id uuid, pos int, total_count bigint)
language sql
stable
set search_path = public
as $$
  with term as (
    select nullif(trim(coalesce(p_search, '')), '') as t
  ),
  base as (
    select p.id, p.name, p.price, p.rating, p.created_at,
           public.shop_age_rank(p.min_age_months, p.max_age_months, c.key, p_age_from, p_age_to, coalesce(p_pregnancy, false)) as rnk,
           case
             when (select t from term) is null then 0
             when p.name ilike (select t from term) || '%' then 0
             when p.name ilike '%' || (select t from term) || '%' then 1
             else 2
           end as relevance
    from public.products p
    left join public.categories c on c.id = p.category_id
    left join public.brands b on b.id = p.brand_id
    where p.is_active = true
      and (p_category is null or p_category = 'all' or c.key = p_category)
      and (p_brand is null or p.brand_id = p_brand)
      and (not coalesce(p_on_sale, false) or p.compare_at_price is not null)
      and ((select t from term) is null
           or p.name ilike '%' || (select t from term) || '%'
           or b.name ilike '%' || (select t from term) || '%')
  ),
  ordered as (
    select id,
           row_number() over (
             order by
               relevance,
               rnk,
               case when p_sort = 'priceAsc' then price end asc nulls last,
               case when p_sort = 'priceDesc' then price end desc nulls last,
               case when p_sort = 'rating' then rating end desc nulls last,
               case when p_sort not in ('priceAsc', 'priceDesc', 'rating') or p_sort is null then created_at end desc nulls last,
               id
           )::int as pos,
           count(*) over () as total_count
    from base
  )
  select id, pos, total_count
  from ordered
  order by pos
  offset greatest(coalesce(p_offset, 0), 0)
  limit least(greatest(coalesce(p_limit, 20), 1), 100);
$$;

revoke execute on function public.shop_product_order(text, uuid, boolean, text, text, numeric, numeric, boolean, int, int) from public;
grant execute on function public.shop_product_order(text, uuid, boolean, text, text, numeric, numeric, boolean, int, int) to anon, authenticated;
grant execute on function public.age_months_value(jsonb) to anon, authenticated;
grant execute on function public.shop_age_rank(jsonb, jsonb, text, numeric, numeric, boolean) to anon, authenticated;

-- --- 4) Kategoritë e reja (fëmijët 3–12 vjeç) ------------------------------
-- Kategoritë ekzistuese s'preken. Produktet i shton Meti më vonë.
insert into public.categories (key, label, label_en, icon, sort_order)
select v.key, v.label, v.label_en, v.icon, v.sort_order
from (values
  ('shkolla', 'Shkolla', 'School', '🎒', 9),
  ('lodra-edukative', 'Lodra edukative', 'Educational toys', '🧩', 10),
  ('veshje-femije', 'Veshje për fëmijë', 'Kids clothing', '👕', 11)
) as v(key, label, label_en, icon, sort_order)
where not exists (select 1 from public.categories c where c.key = v.key);
