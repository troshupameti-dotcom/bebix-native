-- Kthimi i 20261115090000_shop_order_filters.sql: renditja e dyqanit pa filtrat e stokut, çmimit dhe "Top".
-- App-i i ri vazhdon të punojë: kur funksioni s'i njeh parametrat e rinj, i lexon filtrat drejt nga tabela.
-- Nuk prek asnjë tabelë ose të dhënë.

drop function if exists public.shop_product_order(text, uuid, boolean, text, text, numeric, numeric, boolean, integer, integer, text, boolean, numeric, boolean);

create or replace function public.shop_product_order(
  p_category text default null,
  p_brand uuid default null,
  p_on_sale boolean default false,
  p_search text default null,
  p_sort text default 'newest',
  p_age_from numeric default null,
  p_age_to numeric default null,
  p_pregnancy boolean default false,
  p_offset integer default 0,
  p_limit integer default 20,
  p_subcategory text default null
)
returns table (product_id uuid, pos integer, total_count bigint)
language sql
stable
set search_path = public
as $$
  with term as (
    select nullif(translate(lower(trim(coalesce(p_search, ''))), 'ëçËÇ', 'ecec'), '') as t
  ),
  matched_subs as (
    select sid from public.shop_subcategory_match(p_search) as m(sid)
  ),
  base as (
    select p.id, p.name, p.price, p.rating, p.created_at,
           public.shop_age_rank(p.min_age_months, p.max_age_months, c.key, p_age_from, p_age_to, coalesce(p_pregnancy, false)) as rnk,
           case
             when (select t from term) is null then 0
             when p.search_text like (select t from term) || '%' then 0
             when p.search_text like '%' || (select t from term) || '%' then 1
             when p.subcategory_id in (select sid from matched_subs) then 2
             else 3
           end as relevance
    from public.products p
    left join public.categories c on c.id = p.category_id
    left join public.subcategories s on s.id = p.subcategory_id
    left join public.brands b on b.id = p.brand_id
    where p.is_active = true
      and (p_category is null or p_category = 'all' or c.key = p_category)
      and (p_subcategory is null or s.key = p_subcategory)
      and (p_brand is null or p.brand_id = p_brand)
      and (not coalesce(p_on_sale, false) or p.compare_at_price is not null)
      and ((select t from term) is null
           or p.search_text like '%' || (select t from term) || '%'
           or translate(lower(b.name), 'ëçËÇ', 'ecec') like '%' || (select t from term) || '%'
           or p.subcategory_id in (select sid from matched_subs))
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

revoke execute on function public.shop_product_order(text, uuid, boolean, text, text, numeric, numeric, boolean, integer, integer, text) from public;
grant execute on function public.shop_product_order(text, uuid, boolean, text, text, numeric, numeric, boolean, integer, integer, text) to anon, authenticated, service_role;
