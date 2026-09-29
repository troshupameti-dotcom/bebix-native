-- Blerja si mysafir: klienti porosit pa llogari (pagesa në dorëzim, admini
-- e konfirmon me telefon).
--
-- Logjika e porosisë kalon te `place_order_core(p_user, ...)`, e brendshme
-- (askush s'e thërret drejtpërdrejt). Dy hyrje:
--   - place_order(...)        → i kyçuri, si më parë;
--   - place_guest_order(...)  → mysafiri (anon), me mbrojtje nga spam-i:
--       * `p_client_ref` i detyrueshëm (e njëjta porosi s'krijohet dy herë);
--       * jo më shumë se 3 porosi në pritje për numër telefoni në 24 orë;
--       * jo më shumë se 30 porosi mysafiri në orë, gjithsej.

create unique index if not exists orders_guest_client_ref_idx
  on public.orders (client_ref) where user_id is null and client_ref is not null;

create or replace function public.place_order_core(
  p_user uuid,
  p_full_name text,
  p_phone text,
  p_address text,
  p_city text,
  p_items jsonb,
  p_client_ref uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name          text := regexp_replace(btrim(coalesce(p_full_name, '')), '\s+', ' ', 'g');
  v_phone         text := btrim(coalesce(p_phone, ''));
  v_phone_digits  text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
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
  if p_client_ref is not null then
    select id into v_order_id from public.orders
      where client_ref = p_client_ref and user_id is not distinct from p_user;
    if v_order_id is not null then
      return v_order_id;
    end if;
  end if;

  if char_length(v_name) < 2 or char_length(v_name) > 100 then
    raise exception 'Shkruaj emrin dhe mbiemrin (2 deri në 100 shenja).';
  end if;
  if v_phone !~ '^[+0-9 ()./-]{6,30}$' or char_length(v_phone_digits) < 6 then
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

  if p_user is not null then
    if (select count(*) from public.orders
        where user_id = p_user and status = 'pending' and created_at > now() - interval '24 hours') >= 10 then
      raise exception 'Ke shumë porosi në pritje. Prit konfirmimin e tyre ose na shkruaj.';
    end if;
  else
    if (select count(*) from public.orders
        where user_id is null and status = 'pending' and created_at > now() - interval '24 hours'
          and regexp_replace(coalesce(phone, ''), '\D', '', 'g') = v_phone_digits) >= 3 then
      raise exception 'Ke tashmë porosi në pritje me këtë numër. Do të të telefonojmë së shpejti.';
    end if;
    if (select count(*) from public.orders
        where user_id is null and created_at > now() - interval '1 hour') >= 30 then
      raise exception 'Shumë porosi për momentin. Provo përsëri pas pak minutash.';
    end if;
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    if coalesce(v_item->>'qty', '') !~ '^[0-9]{1,3}$' then
      raise exception 'Sasi e pavlefshme.';
    end if;
    if coalesce(v_item->>'id', '') !~ '^[0-9a-fA-F-]{36}$' then
      raise exception 'Një produkt në shportë nuk njihet. Hiqe dhe provo përsëri.';
    end if;
  end loop;

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
      order by stock desc limit 1 for update;
    if v_pp.id is not null then
      if v_pp.stock < v_line.qty then
        raise exception 'Stok i pamjaftueshëm për "%": kërkuar %, në dispozicion vetëm %.', v_product.name, v_line.qty, v_pp.stock;
      end if;
    else
      if v_product.stock < v_line.qty then
        raise exception 'Stok i pamjaftueshëm për "%": kërkuar %, në dispozicion vetëm %.', v_product.name, v_line.qty, v_product.stock;
      end if;
    end if;
    v_total := v_total + v_product.price * v_line.qty;
    v_items := v_items || jsonb_build_array(
      jsonb_build_object(
        'id', v_product.id, 'name', v_product.name, 'price', v_product.price, 'qty', v_line.qty,
        'imageUrl', v_product.image_url,
        'stock_source', case when v_pp.id is not null then 'partner' else 'product' end
      ) || case when v_line.icon is not null then jsonb_build_object('icon', v_line.icon) else '{}'::jsonb end
    );
  end loop;

  insert into public.orders (user_id, full_name, phone, address, city, items, total_price, status, client_ref)
  values (p_user, v_name, v_phone, v_address, v_city, v_items, v_total, 'pending', p_client_ref)
  returning id into v_order_id;

  for v_item in select * from jsonb_array_elements(v_items) loop
    v_price := (v_item->>'price')::numeric;
    if v_item->>'stock_source' = 'product' then
      update public.products set stock = stock - (v_item->>'qty')::int where id = (v_item->>'id')::uuid;
      continue;
    end if;
    select * into v_pp from public.partner_products
      where product_id = (v_item->>'id')::uuid and status <> 'inactive'
      order by stock desc limit 1 for update;
    if v_pp.id is null then
      continue;
    end if;
    v_commission := public.get_applicable_commission(v_pp.partner_id, v_pp.product_id);
    v_commission_amount := round((v_price * (v_item->>'qty')::int) * v_commission / 100, 2);
    v_partner_earning := round((v_price * (v_item->>'qty')::int) - v_commission_amount, 2);
    insert into public.order_items (order_id, product_id, partner_id, partner_product_id, qty, unit_price, commission_rate_applied, commission_amount, partner_earning)
    values (v_order_id, v_pp.product_id, v_pp.partner_id, v_pp.id, (v_item->>'qty')::int, v_price, v_commission, v_commission_amount, v_partner_earning);
    insert into public.inventory_logs (partner_product_id, old_stock, new_stock, change, reason, user_id)
    values (v_pp.id, v_pp.stock, v_pp.stock - (v_item->>'qty')::int, -(v_item->>'qty')::int, 'sale', p_user);
    v_new_stock := v_pp.stock - (v_item->>'qty')::int;
    v_new_status := case
      when v_new_stock = 0 then 'out_of_stock'
      when v_new_stock <= (select low_stock_threshold from public.partners where id = v_pp.partner_id) then 'low_stock'
      else 'in_stock' end;
    update public.partner_products set stock = v_new_stock, status = v_new_status, updated_at = now() where id = v_pp.id;
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
        jsonb_build_object('partner_id', v_pp.partner_id, 'partner_product_id', v_pp.id, 'stock', v_new_stock));
    end if;
  end loop;

  return v_order_id;
end;
$$;

revoke execute on function public.place_order_core(uuid, text, text, text, text, jsonb, uuid) from public, anon, authenticated;

-- I kyçuri: e njëjta nënshkrim si më parë (app-i dhe webi s'ndryshojnë).
create or replace function public.place_order(
  p_full_name text, p_phone text, p_address text, p_city text, p_items jsonb, p_client_ref uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Duhet të jesh i loguar për të bërë porosi.';
  end if;
  return public.place_order_core(auth.uid(), p_full_name, p_phone, p_address, p_city, p_items, p_client_ref);
end;
$$;

revoke execute on function public.place_order(text, text, text, text, jsonb, uuid) from public, anon;
grant execute on function public.place_order(text, text, text, text, jsonb, uuid) to authenticated, service_role;

-- Mysafiri: pa llogari. Referenca e porosisë është e detyrueshme.
create or replace function public.place_guest_order(
  p_full_name text, p_phone text, p_address text, p_city text, p_items jsonb, p_client_ref uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_client_ref is null then
    raise exception 'Mungon referenca e porosisë. Rifresko dhe provo përsëri.';
  end if;
  return public.place_order_core(null, p_full_name, p_phone, p_address, p_city, p_items, p_client_ref);
end;
$$;

revoke execute on function public.place_guest_order(text, text, text, text, jsonb, uuid) from public;
grant execute on function public.place_guest_order(text, text, text, text, jsonb, uuid) to anon, authenticated, service_role;
