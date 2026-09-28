-- Auditimi (28 shtator 2026): porosite dhe stoku.
--
-- 1. Stoku qe sheh klienti (`products.stock`) ndiqte vetem numrin qe
--    shkruante admini, jo stokun e partnereve: nje produkt me 3 cope te
--    partneri dukej me 10. Tani, kur produkti ka partner, `products.stock`
--    eshte shuma e stokut te partnereve.
-- 2. place_order:
--    - kontrollon emrin, telefonin, adresen dhe qytetin (gjatesi, format);
--    - i bashkon rreshtat e te njejtit produkt (dy rreshta me 3 cope secili
--      kalonin kontrollin e stokut vec e vec dhe rrezonin porosine me nje
--      gabim teknik);
--    - produkti pa partner kontrollon dhe zbret `products.stock` (me pare
--      mund te porositej sa te doje, edhe kur tregohej "Pa stok");
--    - jo me shume se 10 porosi "ne pritje" brenda 24 oresh per llogari;
--    - `p_client_ref`: e njejta porosi e derguar dy here (rrjet i dobet)
--      krijohet nje here;
--    - te `orders.items` ruhen vetem fushat e serverit (+ ikona e produktit),
--      jo cdo gje qe dergon klienti.
-- 3. Anulimi i porosise nga admini e kthen stokun e artikujve qe s'kane dale
--    ende nga partneri (me pare stoku humbiste).
-- 4. Vleresimi "blerje e verifikuar" vetem pas nje porosie te dorezuar.
-- 5. Statusi i porosise vetem nga lista e njohur.

-- ---------------------------------------------------------------------
-- 1. Stoku i produktit ndjek partneret
-- ---------------------------------------------------------------------
create or replace function public.sync_product_stock(p_product_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.products p
  set stock = s.total
  from (
    select coalesce(sum(stock), 0)::int as total
    from public.partner_products
    where product_id = p_product_id and status <> 'inactive'
  ) s
  where p.id = p_product_id
    and exists (select 1 from public.partner_products where product_id = p_product_id)
    and p.stock is distinct from s.total;
$$;

revoke execute on function public.sync_product_stock(uuid) from public, anon, authenticated;

create or replace function public.partner_products_sync_stock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op in ('INSERT', 'UPDATE') then
    perform public.sync_product_stock(new.product_id);
  end if;
  if tg_op = 'DELETE' or (tg_op = 'UPDATE' and old.product_id is distinct from new.product_id) then
    perform public.sync_product_stock(old.product_id);
  end if;
  return null;
end;
$$;

revoke execute on function public.partner_products_sync_stock() from public, anon, authenticated;

drop trigger if exists partner_products_sync_stock on public.partner_products;
create trigger partner_products_sync_stock
  after insert or update of stock, status, product_id or delete on public.partner_products
  for each row execute function public.partner_products_sync_stock();

select public.sync_product_stock(id) from public.products;

-- ---------------------------------------------------------------------
-- 5. Statusi i porosise + referenca e klientit
-- ---------------------------------------------------------------------
alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check
  check (status in ('pending', 'confirmed', 'shipped', 'delivered', 'cancelled'));

alter table public.orders add column if not exists client_ref uuid;
create unique index if not exists orders_client_ref_idx on public.orders (user_id, client_ref) where client_ref is not null;

-- ---------------------------------------------------------------------
-- 2. place_order
-- ---------------------------------------------------------------------
drop function if exists public.place_order(text, text, text, text, jsonb);

create or replace function public.place_order(
  p_full_name text,
  p_phone text,
  p_address text,
  p_city text,
  p_items jsonb,
  p_client_ref uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user          uuid := auth.uid();
  v_name          text := regexp_replace(btrim(coalesce(p_full_name, '')), '\s+', ' ', 'g');
  v_phone         text := btrim(coalesce(p_phone, ''));
  v_address       text := btrim(coalesce(p_address, ''));
  v_city          text := btrim(coalesce(p_city, ''));
  v_order_id      uuid;
  v_total         numeric := 0;
  v_item          jsonb;
  v_line          record;
  v_items         jsonb := '[]'::jsonb;
  v_product       public.products%rowtype;
  v_pp            public.partner_products%rowtype;
  v_price         numeric;
  v_commission    numeric;
  v_commission_amount numeric;
  v_partner_earning   numeric;
  v_new_stock     integer;
  v_new_status    text;
  v_partner_name  text;
begin
  if v_user is null then
    raise exception 'Duhet të jesh i loguar për të bërë porosi.';
  end if;

  if p_client_ref is not null then
    select id into v_order_id from public.orders where user_id = v_user and client_ref = p_client_ref;
    if v_order_id is not null then
      return v_order_id;
    end if;
  end if;

  if char_length(v_name) < 2 or char_length(v_name) > 100 then
    raise exception 'Shkruaj emrin dhe mbiemrin (2 deri në 100 shenja).';
  end if;
  if v_phone !~ '^[+0-9 ()./-]{6,30}$' or char_length(regexp_replace(v_phone, '\D', '', 'g')) < 6 then
    raise exception 'Numri i telefonit nuk është i vlefshëm.';
  end if;
  if char_length(v_address) < 3 or char_length(v_address) > 300 then
    raise exception 'Shkruaj adresën e plotë (3 deri në 300 shenja).';
  end if;
  if char_length(v_city) < 2 or char_length(v_city) > 100 then
    raise exception 'Shkruaj qytetin.';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Shporta është bosh.';
  end if;
  if jsonb_array_length(p_items) > 50 then
    raise exception 'Shumë artikuj në një porosi.';
  end if;

  if (select count(*) from public.orders
      where user_id = v_user and status = 'pending' and created_at > now() - interval '24 hours') >= 10 then
    raise exception 'Ke shumë porosi në pritje. Prit konfirmimin e tyre ose na shkruaj.';
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    if coalesce(v_item->>'qty', '') !~ '^[0-9]{1,3}$' then
      raise exception 'Sasi e pavlefshme.';
    end if;
    if coalesce(v_item->>'id', '') !~ '^[0-9a-fA-F-]{36}$' then
      raise exception 'Një produkt në shportë nuk njihet. Hiqe dhe provo përsëri.';
    end if;
  end loop;

  -- Rreshtat e te njejtit produkt bashkohen para kontrollit te stokut.
  for v_line in
    select (e->>'id')::uuid as product_id,
           sum((e->>'qty')::int)::int as qty,
           max(left(nullif(btrim(e->>'icon'), ''), 16)) as icon
    from jsonb_array_elements(p_items) e
    group by 1
  loop
    if v_line.qty < 1 or v_line.qty > 99 then
      raise exception 'Sasi e pavlefshme.';
    end if;

    select * into v_product from public.products where id = v_line.product_id and is_active for update;
    if v_product.id is null then
      raise exception 'Një produkt në shportë nuk shitet më. Hiqe dhe provo përsëri.';
    end if;

    select * into v_pp from public.partner_products
      where product_id = v_product.id and status <> 'inactive'
      order by stock desc
      limit 1
      for update;

    if v_pp.id is not null then
      if v_pp.stock < v_line.qty then
        raise exception 'Stok i pamjaftueshëm për "%": kërkuar %, në dispozicion vetëm %.',
          v_product.name, v_line.qty, v_pp.stock;
      end if;
    else
      if v_product.stock < v_line.qty then
        raise exception 'Stok i pamjaftueshëm për "%": kërkuar %, në dispozicion vetëm %.',
          v_product.name, v_line.qty, v_product.stock;
      end if;
    end if;

    v_total := v_total + v_product.price * v_line.qty;
    v_items := v_items || jsonb_build_array(
      jsonb_build_object(
        'id', v_product.id,
        'name', v_product.name,
        'price', v_product.price,
        'qty', v_line.qty,
        'imageUrl', v_product.image_url,
        'stock_source', case when v_pp.id is not null then 'partner' else 'product' end
      ) || case when v_line.icon is not null then jsonb_build_object('icon', v_line.icon) else '{}'::jsonb end
    );
  end loop;

  insert into public.orders (user_id, full_name, phone, address, city, items, total_price, status, client_ref)
  values (v_user, v_name, v_phone, v_address, v_city, v_items, v_total, 'pending', p_client_ref)
  returning id into v_order_id;

  for v_item in select * from jsonb_array_elements(v_items) loop
    v_price := (v_item->>'price')::numeric;

    if v_item->>'stock_source' = 'product' then
      update public.products
        set stock = stock - (v_item->>'qty')::int
        where id = (v_item->>'id')::uuid;
      continue;
    end if;

    select * into v_pp from public.partner_products
      where product_id = (v_item->>'id')::uuid and status <> 'inactive'
      order by stock desc
      limit 1
      for update;
    if v_pp.id is null then
      continue;
    end if;

    v_commission := public.get_applicable_commission(v_pp.partner_id, v_pp.product_id);
    v_commission_amount := round((v_price * (v_item->>'qty')::int) * v_commission / 100, 2);
    v_partner_earning := round((v_price * (v_item->>'qty')::int) - v_commission_amount, 2);

    insert into public.order_items (
      order_id, product_id, partner_id, partner_product_id,
      qty, unit_price, commission_rate_applied, commission_amount, partner_earning
    ) values (
      v_order_id, v_pp.product_id, v_pp.partner_id, v_pp.id,
      (v_item->>'qty')::int, v_price, v_commission, v_commission_amount, v_partner_earning
    );

    insert into public.inventory_logs (partner_product_id, old_stock, new_stock, change, reason, user_id)
    values (v_pp.id, v_pp.stock, v_pp.stock - (v_item->>'qty')::int, -(v_item->>'qty')::int, 'sale', v_user);

    v_new_stock := v_pp.stock - (v_item->>'qty')::int;
    v_new_status := case
      when v_new_stock = 0 then 'out_of_stock'
      when v_new_stock <= (select low_stock_threshold from public.partners where id = v_pp.partner_id) then 'low_stock'
      else 'in_stock'
    end;

    update public.partner_products
      set stock = v_new_stock, status = v_new_status, updated_at = now()
      where id = v_pp.id;

    insert into public.partner_notifications (partner_id, type, title, body, payload)
    values (v_pp.partner_id, 'new_order', 'Porosi e re', 'Ke marrë një porosi të re.',
      jsonb_build_object('order_id', v_order_id, 'product_id', v_pp.product_id, 'qty', (v_item->>'qty')::int));

    if v_new_status in ('low_stock', 'out_of_stock') and v_pp.status is distinct from v_new_status then
      select company_name into v_partner_name from public.partners where id = v_pp.partner_id;
      insert into public.admin_notifications (type, title, body, payload)
      values (
        case when v_new_status = 'out_of_stock' then 'out_of_stock' else 'low_stock' end,
        case when v_new_status = 'out_of_stock' then 'Produkt pa stok' else 'Stok i ulët' end,
        v_partner_name || ' — ' || (v_item->>'name') || ' (stok: ' || v_new_stock || ')',
        jsonb_build_object('partner_id', v_pp.partner_id, 'partner_product_id', v_pp.id, 'stock', v_new_stock)
      );
    end if;
  end loop;

  return v_order_id;
end;
$$;

revoke execute on function public.place_order(text, text, text, text, jsonb, uuid) from public, anon;
grant execute on function public.place_order(text, text, text, text, jsonb, uuid) to authenticated, service_role;

-- Funksioni i vjeter i checkout-it: s'e thirr askush (place_order e ka
-- brenda), dhe askujt s'i lejohej. Hiqet qe te mos ngaterrohet.
drop function if exists public.checkout_process_order_items(uuid, jsonb);

-- ---------------------------------------------------------------------
-- 3. Anulimi e kthen stokun (dhe zhbërja e anulimit e merr prapë)
-- ---------------------------------------------------------------------
-- Kthehen vetem artikujt qe jane ende te partneri. Te dorezuarit, te
-- marret nga korrieri dhe ata qe partneri i shenoi "pa stok" s'kthehen:
-- stoku do te dilte me i madh se ai qe ka partneri ne te vertete.
create or replace function public.orders_status_stock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item      public.order_items%rowtype;
  v_pp        public.partner_products%rowtype;
  v_line      jsonb;
  v_stock     integer;
  v_threshold integer;
  v_new_stock integer;
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  if new.status = 'cancelled' then
    for v_item in
      select * from public.order_items
      where order_id = new.id and fulfillment_status in ('pending', 'accepted', 'preparing', 'ready_for_pickup')
      for update
    loop
      select * into v_pp from public.partner_products where id = v_item.partner_product_id for update;
      if v_pp.id is not null then
        select low_stock_threshold into v_threshold from public.partners where id = v_pp.partner_id;
        v_new_stock := v_pp.stock + v_item.qty;
        insert into public.inventory_logs (partner_product_id, old_stock, new_stock, change, reason, user_id)
        values (v_pp.id, v_pp.stock, v_new_stock, v_item.qty, 'return', auth.uid());
        update public.partner_products
          set stock = v_new_stock,
              status = case
                when v_pp.status = 'inactive' then 'inactive'
                when v_new_stock = 0 then 'out_of_stock'
                when v_new_stock <= coalesce(v_threshold, 0) then 'low_stock'
                else 'in_stock'
              end,
              updated_at = now()
          where id = v_pp.id;
      end if;
      update public.order_items set fulfillment_status = 'cancelled', updated_at = now() where id = v_item.id;
    end loop;

    for v_line in select * from jsonb_array_elements(coalesce(new.items, '[]'::jsonb)) loop
      if v_line->>'stock_source' = 'product' then
        update public.products set stock = stock + (v_line->>'qty')::int where id = (v_line->>'id')::uuid;
      end if;
    end loop;

  elsif old.status = 'cancelled' then
    for v_item in
      select * from public.order_items where order_id = new.id and fulfillment_status = 'cancelled' for update
    loop
      select * into v_pp from public.partner_products where id = v_item.partner_product_id for update;
      if v_pp.id is not null then
        if v_pp.stock < v_item.qty then
          raise exception 'S''mund të rikthehet porosia: stok i pamjaftueshëm (në dispozicion %, nevojiten %).',
            v_pp.stock, v_item.qty;
        end if;
        select low_stock_threshold into v_threshold from public.partners where id = v_pp.partner_id;
        v_new_stock := v_pp.stock - v_item.qty;
        insert into public.inventory_logs (partner_product_id, old_stock, new_stock, change, reason, user_id)
        values (v_pp.id, v_pp.stock, v_new_stock, -v_item.qty, 'adjustment', auth.uid());
        update public.partner_products
          set stock = v_new_stock,
              status = case
                when v_pp.status = 'inactive' then 'inactive'
                when v_new_stock = 0 then 'out_of_stock'
                when v_new_stock <= coalesce(v_threshold, 0) then 'low_stock'
                else 'in_stock'
              end,
              updated_at = now()
          where id = v_pp.id;
      end if;
      update public.order_items set fulfillment_status = 'pending', updated_at = now() where id = v_item.id;
    end loop;

    for v_line in select * from jsonb_array_elements(coalesce(new.items, '[]'::jsonb)) loop
      if v_line->>'stock_source' = 'product' then
        select stock into v_stock from public.products where id = (v_line->>'id')::uuid for update;
        if coalesce(v_stock, 0) < (v_line->>'qty')::int then
          raise exception 'S''mund të rikthehet porosia: stok i pamjaftueshëm për "%".', v_line->>'name';
        end if;
        update public.products set stock = stock - (v_line->>'qty')::int where id = (v_line->>'id')::uuid;
      end if;
    end loop;
  end if;

  return new;
end;
$$;

revoke execute on function public.orders_status_stock() from public, anon, authenticated;

drop trigger if exists orders_status_stock on public.orders;
create trigger orders_status_stock before update of status on public.orders
  for each row execute function public.orders_status_stock();

-- ---------------------------------------------------------------------
-- 4. "Blerje e verifikuar" vetem pas dorezimit
-- ---------------------------------------------------------------------
-- Lexohet nga `orders.items`, qe perfshin edhe produktet pa partner (ato
-- s'kane rresht te `order_items`).
create or replace function public.product_review_mark_verified()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.verified_purchase := exists (
    select 1
    from public.orders o
    where o.user_id = new.user_id
      and o.status = 'delivered'
      and o.items @> jsonb_build_array(jsonb_build_object('id', new.product_id::text))
  );
  new.author_name := left(nullif(btrim(coalesce(new.author_name, '')), ''), 60);
  new.updated_at := now();
  return new;
end;
$$;

update public.product_reviews set updated_at = updated_at;
