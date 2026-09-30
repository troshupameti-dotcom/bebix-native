-- Portali i tregtarit (partnerit): funksione të sigurta për leximin e porosive,
-- pasqyrën dhe balancën, plus rolet (owner / manager / staff).
--
-- Pse funksione: `orders` ka RLS vetëm për pronarin e porosisë dhe adminin, pra
-- partneri s'mund ta lexojë (kështu portali i vjetër s'kishte data e klientë).
-- Një politikë e re mbi `orders` do t'i tregonte partnerit gjithë rreshtin —
-- edhe artikujt e partnerëve të tjerë (`orders.items`). Këto funksione kthejnë
-- VETËM rreshtat e partnerit të kyçur dhe të dhënat e dërgesës që i duhen për
-- ta përmbushur porosinë.

-- ---------------------------------------------------------------- rolet
create or replace function public.current_partner_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select pu.role
  from public.partner_users pu
  join public.partners p on p.id = pu.partner_id
  where pu.user_id = (select auth.uid()) and p.status = 'approved'
  limit 1;
$$;

revoke execute on function public.current_partner_role() from public, anon;
grant execute on function public.current_partner_role() to authenticated, service_role;

-- Pagesat: vetëm pronari (manager dhe staff s'shohin financat).
drop policy if exists payouts_self_read on public.partner_payouts;
create policy payouts_self_read on public.partner_payouts
  for select to authenticated
  using (
    partner_id = (select public.current_partner_id())
    and (select public.current_partner_role()) = 'owner'
  );

-- ------------------------------------------------------- porositë (faqosur)
-- Faqosja është sipas porosisë, jo sipas rreshtit: një porosi del gjithmonë e plotë.
create or replace function public.partner_order_lines(
  p_order_id uuid default null,
  p_status   text default null,
  p_search   text default null,
  p_limit    int  default 20,
  p_offset   int  default 0
)
returns table (
  total_orders      bigint,
  item_id           uuid,
  order_id          uuid,
  order_created_at  timestamptz,
  product_id        uuid,
  product_name      text,
  product_image     text,
  qty               int,
  unit_price        numeric,
  commission_amount numeric,
  partner_earning   numeric,
  fulfillment_status text,
  customer_name     text,
  customer_phone    text,
  customer_address  text,
  customer_city     text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_pid    uuid := public.current_active_partner_id();
  v_search text := nullif(btrim(coalesce(p_search, '')), '');
begin
  if v_pid is null then
    raise exception 'Nuk ke qasje si partner.';
  end if;

  return query
  with mine as (
    select oi.id, oi.order_id as oid, oi.product_id as pid, oi.qty as q, oi.unit_price as up,
           oi.commission_amount as ca, oi.partner_earning as pe, oi.fulfillment_status as fs,
           o.created_at as oc, o.full_name, o.phone, o.address, o.city,
           p.name as pname, p.image_url as pimg
    from public.order_items oi
    join public.orders o on o.id = oi.order_id
    left join public.products p on p.id = oi.product_id
    where oi.partner_id = v_pid
      and (p_order_id is null or oi.order_id = p_order_id)
  ),
  filtered as (
    select m.oid, max(m.oc) as created_at
    from mine m
    where (p_status is null or m.fs = p_status)
      and (v_search is null
           or m.full_name ilike '%' || v_search || '%'
           or m.phone ilike '%' || v_search || '%'
           or m.oid::text ilike v_search || '%'
           or m.pname ilike '%' || v_search || '%')
    group by m.oid
  ),
  page as (
    select f.oid, f.created_at
    from filtered f
    order by f.created_at desc
    limit least(greatest(p_limit, 1), 100) offset greatest(p_offset, 0)
  )
  select (select count(*) from filtered), m.id, m.oid, m.oc, m.pid, m.pname, m.pimg,
         m.q, m.up, m.ca, m.pe, m.fs, m.full_name, m.phone, m.address, m.city
  from mine m
  join page pg on pg.oid = m.oid
  order by pg.created_at desc, m.oid, m.id;
end;
$$;

revoke execute on function public.partner_order_lines(uuid, text, text, int, int) from public, anon;
grant execute on function public.partner_order_lines(uuid, text, text, int, int) to authenticated, service_role;

-- ----------------------------------------------- pasqyra dhe analitika
-- Një thirrje: KPI të periudhës dhe të mëparshmes, seri sipas ditës/muajit,
-- produktet kryesore dhe ndarja sipas kategorisë e markës. Jashtë: staff.
create or replace function public.partner_dashboard(
  p_from   timestamptz,
  p_to     timestamptz,
  p_bucket text default 'day'
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_pid       uuid := public.current_active_partner_id();
  v_tz        constant text := 'Europe/Belgrade';
  v_prev_from timestamptz;
  v_bucket    text := case when p_bucket = 'month' then 'month' else 'day' end;
  v_result    jsonb;
begin
  if v_pid is null then
    raise exception 'Nuk ke qasje si partner.';
  end if;
  if public.current_partner_role() not in ('owner', 'manager') then
    raise exception 'Nuk ke leje për këtë seksion.';
  end if;
  if p_to <= p_from or p_to - p_from > interval '800 days' then
    raise exception 'Periudhë e pavlefshme.';
  end if;

  v_prev_from := p_from - (p_to - p_from);

  with lines as (
    select oi.order_id as oid, o.created_at as oc, oi.product_id as pid, oi.qty as q,
           oi.unit_price as up, coalesce(oi.commission_amount, 0) as ca, coalesce(oi.partner_earning, 0) as pe,
           p.name as pname, p.image_url as pimg, c.label as cat, b.name as brand,
           (o.created_at >= p_from) as is_cur
    from public.order_items oi
    join public.orders o on o.id = oi.order_id
    left join public.products p on p.id = oi.product_id
    left join public.categories c on c.id = p.category_id
    left join public.brands b on b.id = p.brand_id
    where oi.partner_id = v_pid
      and oi.fulfillment_status not in ('cancelled', 'out_of_stock')
      and o.created_at >= v_prev_from and o.created_at < p_to
  )
  select jsonb_build_object(
    'current', (select jsonb_build_object(
        'sales', coalesce(sum(up * q), 0), 'orders', count(distinct oid), 'units', coalesce(sum(q), 0),
        'commission', coalesce(sum(ca), 0), 'earnings', coalesce(sum(pe), 0))
      from lines where is_cur),
    'previous', (select jsonb_build_object(
        'sales', coalesce(sum(up * q), 0), 'orders', count(distinct oid), 'units', coalesce(sum(q), 0))
      from lines where not is_cur),
    'series', (select coalesce(jsonb_agg(jsonb_build_object('date', d.day, 'revenue', coalesce(a.rev, 0), 'orders', coalesce(a.ord, 0)) order by d.day), '[]'::jsonb)
      from (
        select generate_series(
          date_trunc(v_bucket, p_from at time zone v_tz),
          date_trunc(v_bucket, (p_to - interval '1 second') at time zone v_tz),
          case when v_bucket = 'month' then interval '1 month' else interval '1 day' end
        )::date as day
      ) d
      left join (
        select date_trunc(v_bucket, oc at time zone v_tz)::date as day, sum(up * q) as rev, count(distinct oid) as ord
        from lines where is_cur group by 1
      ) a on a.day = d.day),
    'top_products', (select coalesce(jsonb_agg(t order by (t->>'revenue')::numeric desc), '[]'::jsonb) from (
        select jsonb_build_object('product_id', pid, 'name', max(pname), 'image', max(pimg), 'units', sum(q), 'revenue', sum(up * q)) as t
        from lines where is_cur group by pid order by sum(up * q) desc limit 5) s),
    'by_category', (select coalesce(jsonb_agg(t order by (t->>'revenue')::numeric desc), '[]'::jsonb) from (
        select jsonb_build_object('name', coalesce(cat, '—'), 'revenue', sum(up * q), 'units', sum(q)) as t
        from lines where is_cur group by cat order by sum(up * q) desc limit 6) s),
    'by_brand', (select coalesce(jsonb_agg(t order by (t->>'revenue')::numeric desc), '[]'::jsonb) from (
        select jsonb_build_object('name', coalesce(brand, '—'), 'revenue', sum(up * q), 'units', sum(q)) as t
        from lines where is_cur group by brand order by sum(up * q) desc limit 6) s),
    'pending_orders', (select count(distinct oi.order_id) from public.order_items oi
        where oi.partner_id = v_pid and oi.fulfillment_status = 'pending')
  ) into v_result;

  return v_result;
end;
$$;

revoke execute on function public.partner_dashboard(timestamptz, timestamptz, text) from public, anon;
grant execute on function public.partner_dashboard(timestamptz, timestamptz, text) to authenticated, service_role;

-- ------------------------------------------------------------- klientët
-- Vetëm ç'i duhet tregtarit: emri, qyteti dhe numrat. Pa telefon e adresë.
create or replace function public.partner_customers(p_limit int default 50, p_offset int default 0)
returns table (total_customers bigint, customer_name text, city text, orders bigint, total_spent numeric, first_order timestamptz, last_order timestamptz)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_pid uuid := public.current_active_partner_id();
begin
  if v_pid is null then
    raise exception 'Nuk ke qasje si partner.';
  end if;
  if public.current_partner_role() not in ('owner', 'manager') then
    raise exception 'Nuk ke leje për këtë seksion.';
  end if;

  return query
  with g as (
    select lower(btrim(o.full_name)) || '|' || regexp_replace(coalesce(o.phone, ''), '\D', '', 'g') as k,
           max(o.full_name) as nm, max(o.city) as ct,
           count(distinct o.id) as ord,
           sum(oi.unit_price * oi.qty) filter (where oi.fulfillment_status not in ('cancelled', 'out_of_stock')) as spent,
           min(o.created_at) as fo, max(o.created_at) as lo
    from public.order_items oi
    join public.orders o on o.id = oi.order_id
    where oi.partner_id = v_pid
    group by 1
  )
  select (select count(*) from g), g.nm, g.ct, g.ord, coalesce(g.spent, 0), g.fo, g.lo
  from g
  order by g.lo desc
  limit least(greatest(p_limit, 1), 100) offset greatest(p_offset, 0);
end;
$$;

revoke execute on function public.partner_customers(int, int) from public, anon;
grant execute on function public.partner_customers(int, int) to authenticated, service_role;

-- --------------------------------------------------------------- balanca
-- E disponueshme = fitimet e artikujve të dorëzuar minus çfarë është paguar ose është në rrugë.
create or replace function public.partner_balance()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_pid       uuid := public.current_active_partner_id();
  v_delivered numeric;
  v_open      numeric;
  v_paid      numeric;
  v_reserved  numeric;
begin
  if v_pid is null then
    raise exception 'Nuk ke qasje si partner.';
  end if;
  if public.current_partner_role() <> 'owner' then
    raise exception 'Nuk ke leje për këtë seksion.';
  end if;

  select coalesce(sum(partner_earning) filter (where fulfillment_status = 'delivered'), 0),
         coalesce(sum(partner_earning) filter (where fulfillment_status not in ('delivered', 'cancelled', 'out_of_stock')), 0)
  into v_delivered, v_open
  from public.order_items where partner_id = v_pid;

  select coalesce(sum(amount) filter (where status = 'paid'), 0),
         coalesce(sum(amount) filter (where status in ('pending', 'processing')), 0)
  into v_paid, v_reserved
  from public.partner_payouts where partner_id = v_pid;

  return jsonb_build_object(
    'available', greatest(v_delivered - v_paid - v_reserved, 0),
    'pending', v_open + v_reserved,
    'paid', v_paid);
end;
$$;

revoke execute on function public.partner_balance() from public, anon;
grant execute on function public.partner_balance() to authenticated, service_role;
