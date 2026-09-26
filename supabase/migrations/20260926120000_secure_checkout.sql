-- Siguria e porosive.
--
-- 1) `place_order` e merrte çmimin nga klienti (`p_items[].price`): një
--    thirrje e ndryshuar mund ta bënte porosinë me çmim €0.01, dhe ai çmim
--    shkonte edhe te komisioni i partnerit. Sasia s'kontrollohej: një sasi
--    negative e ulte totalin dhe e rriste stokun. Tani çmimi, emri dhe
--    fotoja lexohen nga `products`; sasia duhet të jetë 1..99; produkti
--    duhet të ekzistojë dhe të jetë aktiv. Pjesa tjetër (stoku, partnerët,
--    njoftimet) mbetet e njëjtë.
--
-- 2) `checkout_process_order_items` ishte i thirrshëm nga kushdo, edhe pa
--    login (anon): mund t'i shtonte artikuj çdo porosie dhe t'ua ulte stokun
--    partnerëve. Askush s'e thërret nga klienti; i hiqet aksesi.
--
-- 3) `get_applicable_commission` zbulonte komisionet e partnerëve për anon;
--    `notification_allowed` cilësimet e njoftimeve të të tjerëve. Të dyja
--    përdoren vetëm brenda funksioneve SECURITY DEFINER, që vazhdojnë t'i
--    thërrasin si pronar.

revoke execute on function public.checkout_process_order_items(uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.get_applicable_commission(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.notification_allowed(uuid, text) from public, anon, authenticated;

create or replace function public.place_order(
  p_full_name text,
  p_phone text,
  p_address text,
  p_city text,
  p_items jsonb
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id      uuid;
  v_total         numeric := 0;
  v_item          jsonb;
  v_items         jsonb := '[]'::jsonb;
  v_product       public.products%rowtype;
  v_pp            public.partner_products%rowtype;
  v_qty           integer;
  v_price         numeric;
  v_commission    numeric;
  v_commission_amount numeric;
  v_partner_earning   numeric;
  v_new_stock     integer;
  v_new_status    text;
  v_partner_name  text;
begin
  if auth.uid() is null then
    raise exception 'Duhet të jesh i loguar për të bërë porosi.';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Shporta është bosh.';
  end if;

  if jsonb_array_length(p_items) > 50 then
    raise exception 'Shumë artikuj në një porosi.';
  end if;

  -- 1) Çdo artikull verifikohet dhe merr çmimin nga baza. Artikujt e ruajtur
  --    te porosia janë ata të serverit, jo ato që dërgoi klienti.
  for v_item in select * from jsonb_array_elements(p_items) loop
    if coalesce(v_item->>'qty', '') !~ '^[0-9]{1,3}$' then
      raise exception 'Sasi e pavlefshme.';
    end if;
    v_qty := (v_item->>'qty')::integer;
    if v_qty < 1 or v_qty > 99 then
      raise exception 'Sasi e pavlefshme.';
    end if;

    select * into v_product from public.products
      where id = (v_item->>'id')::uuid and is_active;
    if v_product.id is null then
      raise exception 'Një produkt në shportë nuk shitet më. Hiqe dhe provo përsëri.';
    end if;

    select * into v_pp from public.partner_products
      where product_id = v_product.id and status != 'inactive'
      order by stock desc
      limit 1
      for update;

    if v_pp.id is not null and v_pp.stock < v_qty then
      raise exception 'Stok i pamjaftueshëm për "%": kërkuar %, në dispozicion vetëm %.',
        v_product.name, v_qty, v_pp.stock;
    end if;

    v_total := v_total + v_product.price * v_qty;
    v_items := v_items || jsonb_build_array(
      v_item || jsonb_build_object(
        'id', v_product.id,
        'name', v_product.name,
        'price', v_product.price,
        'qty', v_qty,
        'imageUrl', v_product.image_url
      )
    );
  end loop;

  insert into public.orders (user_id, full_name, phone, address, city, items, total_price, status)
  values (auth.uid(), p_full_name, p_phone, p_address, p_city, v_items, v_total, 'pending')
  returning id into v_order_id;

  -- 2) Partnerët, stoku dhe njoftimet: si më parë, por me çmimin e serverit.
  for v_item in select * from jsonb_array_elements(v_items) loop
    v_qty := (v_item->>'qty')::integer;
    v_price := (v_item->>'price')::numeric;

    select * into v_pp from public.partner_products
      where product_id = (v_item->>'id')::uuid
        and status != 'inactive'
      order by stock desc
      limit 1
      for update;

    if v_pp.id is null then
      continue;
    end if;

    v_commission := public.get_applicable_commission(v_pp.partner_id, v_pp.product_id);
    v_commission_amount := round((v_price * v_qty) * v_commission / 100, 2);
    v_partner_earning := round((v_price * v_qty) - v_commission_amount, 2);

    insert into public.order_items (
      order_id, product_id, partner_id, partner_product_id,
      qty, unit_price, commission_rate_applied, commission_amount, partner_earning
    ) values (
      v_order_id, v_pp.product_id, v_pp.partner_id, v_pp.id,
      v_qty, v_price, v_commission, v_commission_amount, v_partner_earning
    );

    insert into public.inventory_logs (partner_product_id, old_stock, new_stock, change, reason, user_id)
    values (v_pp.id, v_pp.stock, v_pp.stock - v_qty, -v_qty, 'sale', auth.uid());

    v_new_stock := v_pp.stock - v_qty;
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
      jsonb_build_object('order_id', v_order_id, 'product_id', v_pp.product_id, 'qty', v_qty));

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

revoke execute on function public.place_order(text, text, text, text, jsonb) from public, anon;
grant execute on function public.place_order(text, text, text, text, jsonb) to authenticated;
