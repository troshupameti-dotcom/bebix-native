-- =====================================================================
-- Numrat e parave për panelin e adminit
--
-- Të gjitha të dhënat ekzistojnë te `orders` dhe `order_items`; deri tani
-- askush nuk i mblidhte. Këto view-e nuk krijojnë tabela të reja dhe nuk
-- shkruajnë asgjë.
--
-- Siguria: `security_invoker = true` do të thotë që view-i lexohet me të
-- drejtat e atij që e thërret, jo të pronarit. Pra RLS-ja e `orders`
-- mbetet në fuqi — një klient normal nuk sheh shitjet e askujt tjetër.
-- (Pa këtë, view-i do t'i anashkalonte politikat, siç ndodhi me
-- `community_feed` më parë.)
-- =====================================================================

-- --- Shitjet për ditë -------------------------------------------------
create or replace view public.admin_sales_daily with (security_invoker = true) as
select
  (created_at at time zone 'Europe/Belgrade')::date        as day,
  count(*)                                                 as orders_all,
  count(*) filter (where status <> 'cancelled')            as orders,
  count(*) filter (where status = 'cancelled')             as orders_cancelled,
  coalesce(sum(total_price) filter (where status <> 'cancelled'), 0)::numeric(12, 2) as revenue,
  round(
    coalesce(sum(total_price) filter (where status <> 'cancelled'), 0)
    / nullif(count(*) filter (where status <> 'cancelled'), 0),
    2
  )::numeric(12, 2)                                        as avg_order_value
from public.orders
group by 1;

comment on view public.admin_sales_daily is
  'Porositë dhe qarkullimi për ditë. Të anuluarat nxirren nga qarkullimi por numërohen veç.';

-- --- Përmbledhje: 30 ditët e fundit kundrejt 30 të mëparshmeve --------
create or replace view public.admin_sales_summary with (security_invoker = true) as
with windows as (
  select
    count(*) filter (where status <> 'cancelled' and created_at >= now() - interval '30 days')  as orders_30d,
    count(*) filter (where status <> 'cancelled' and created_at >= now() - interval '60 days'
                       and created_at <  now() - interval '30 days')                            as orders_prev_30d,
    coalesce(sum(total_price) filter (where status <> 'cancelled' and created_at >= now() - interval '30 days'), 0) as revenue_30d,
    coalesce(sum(total_price) filter (where status <> 'cancelled' and created_at >= now() - interval '60 days'
                                        and created_at <  now() - interval '30 days'), 0)       as revenue_prev_30d,
    count(*) filter (where status = 'cancelled' and created_at >= now() - interval '30 days')   as cancelled_30d,
    count(*) filter (where created_at >= now() - interval '30 days')                            as all_30d,
    count(*) filter (where status = 'pending')                                                  as pending_now
  from public.orders
)
select
  orders_30d,
  orders_prev_30d,
  revenue_30d::numeric(12, 2),
  revenue_prev_30d::numeric(12, 2),
  round(revenue_30d / nullif(orders_30d, 0), 2)::numeric(12, 2) as avg_order_value_30d,
  cancelled_30d,
  round(100.0 * cancelled_30d / nullif(all_30d, 0), 1)::numeric(5, 1) as cancelled_pct_30d,
  pending_now
from windows;

comment on view public.admin_sales_summary is
  '30 ditët e fundit krahasuar me 30 të mëparshmet — një rresht i vetëm.';

-- --- Produktet më të shitura -----------------------------------------
create or replace view public.admin_top_products with (security_invoker = true) as
select
  oi.product_id,
  p.name                                                    as product_name,
  sum(oi.qty)                                               as units,
  sum(oi.unit_price * oi.qty)::numeric(12, 2)               as revenue,
  count(distinct oi.order_id)                               as orders
from public.order_items oi
left join public.products p on p.id = oi.product_id
where coalesce(oi.fulfillment_status, '') <> 'cancelled'
group by oi.product_id, p.name;

comment on view public.admin_top_products is
  'Njësi dhe qarkullim për produkt, nga order_items (jo nga orders.items).';

-- --- Klientët: një herë apo të rikthyer -------------------------------
create or replace view public.admin_customer_stats with (security_invoker = true) as
select
  user_id,
  count(*)                                    as orders,
  min(created_at)                             as first_order_at,
  max(created_at)                             as last_order_at,
  coalesce(sum(total_price), 0)::numeric(12, 2) as lifetime_value
from public.orders
where status <> 'cancelled'
group by user_id;

comment on view public.admin_customer_stats is
  'Një rresht për klient. orders > 1 = klient i rikthyer.';
