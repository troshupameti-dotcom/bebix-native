-- Auditimi (28 shtator 2026): autorizimi i funksioneve te partnerit.
--
-- update_order_item_status kishte nje vrime: kontrolli
--   if not v_is_admin and v_item.partner_id != current_partner_id()
-- behej NULL (jo true) kur thirresi s'ishte partner — dhe NULL nuk e hedh
-- gabimin. Pra CILIDO (edhe pa llogari) mund te ndryshonte statusin e nje
-- artikulli porosie: ta anulonte (stoku kthehet) ose ta kthente mbrapsht.
-- Tani: vetem admini ose partneri i aprovuar qe e ka artikullin.
--
-- update_partner_stock dhe update_order_item_status pranojne vetem
-- partnerin e APROVUAR (jo ate ne pritje ose te pezulluar).

create or replace function public.update_order_item_status(p_order_item_id uuid, p_new_status text)
returns public.order_items
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item          public.order_items%rowtype;
  v_pp            public.partner_products%rowtype;
  v_is_admin      boolean := public.is_admin();
  v_partner       uuid := public.current_active_partner_id();
  v_new_stock     integer;
  v_new_pp_status text;
  v_threshold     integer;
begin
  if p_new_status not in ('pending','accepted','preparing','ready_for_pickup','picked_up','delivered','cancelled','out_of_stock') then
    raise exception 'Status i panjohur: %', p_new_status;
  end if;

  select * into v_item from public.order_items where id = p_order_item_id for update;
  if v_item.id is null then
    raise exception 'Artikulli i porosisë s''u gjet.';
  end if;

  if not v_is_admin and (v_partner is null or v_item.partner_id is distinct from v_partner) then
    raise exception 'Jo i autorizuar për të ndryshuar këtë artikull.';
  end if;

  if v_item.fulfillment_status = p_new_status then
    return v_item;
  end if;

  select * into v_pp from public.partner_products where id = v_item.partner_product_id for update;

  if p_new_status = 'cancelled' and v_item.fulfillment_status <> 'cancelled' then
    if v_pp.id is not null then
      select low_stock_threshold into v_threshold from public.partners where id = v_pp.partner_id;
      v_new_stock := v_pp.stock + v_item.qty;
      v_new_pp_status := case
        when v_new_stock = 0 then 'out_of_stock'
        when v_new_stock <= v_threshold then 'low_stock'
        else 'in_stock'
      end;
      insert into public.inventory_logs (partner_product_id, old_stock, new_stock, change, reason, user_id)
      values (v_pp.id, v_pp.stock, v_new_stock, v_item.qty, 'return', auth.uid());
      update public.partner_products
        set stock = v_new_stock, status = v_new_pp_status, updated_at = now()
        where id = v_pp.id;
    end if;
  elsif v_item.fulfillment_status = 'cancelled' and p_new_status <> 'cancelled' then
    if v_pp.id is not null then
      if v_pp.stock < v_item.qty then
        raise exception 'S''mund të zhbësh anulimin: stok i pamjaftueshëm (në dispozicion vetëm %, nevojiten %).',
          v_pp.stock, v_item.qty;
      end if;
      select low_stock_threshold into v_threshold from public.partners where id = v_pp.partner_id;
      v_new_stock := v_pp.stock - v_item.qty;
      v_new_pp_status := case
        when v_new_stock = 0 then 'out_of_stock'
        when v_new_stock <= v_threshold then 'low_stock'
        else 'in_stock'
      end;
      insert into public.inventory_logs (partner_product_id, old_stock, new_stock, change, reason, user_id)
      values (v_pp.id, v_pp.stock, v_new_stock, -v_item.qty, 'adjustment', auth.uid());
      update public.partner_products
        set stock = v_new_stock, status = v_new_pp_status, updated_at = now()
        where id = v_pp.id;
    end if;
  end if;

  update public.order_items
    set fulfillment_status = p_new_status, updated_at = now()
    where id = p_order_item_id
    returning * into v_item;

  return v_item;
end;
$$;

revoke execute on function public.update_order_item_status(uuid, text) from public, anon;
grant execute on function public.update_order_item_status(uuid, text) to authenticated;

create or replace function public.update_partner_stock(p_partner_product_id uuid, p_new_stock integer, p_reason text default 'manual_update')
returns public.partner_products
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.partner_products;
  v_partner_id uuid := public.current_active_partner_id();
  v_threshold integer;
  v_new_status text;
  v_old_status text;
  v_partner_name text;
  v_product_name text;
begin
  if v_partner_id is null then
    raise exception 'Jo i autorizuar: ky llogari nuk është partner i aprovuar.';
  end if;
  if p_new_stock is null or p_new_stock < 0 or p_new_stock > 100000 then
    raise exception 'Stoku duhet të jetë nga 0 deri në 100000.';
  end if;
  if coalesce(p_reason, 'manual_update') not in ('manual_update', 'damaged', 'adjustment', 'return') then
    raise exception 'Arsye e panjohur.';
  end if;

  select * into v_row from public.partner_products
    where id = p_partner_product_id and partner_id = v_partner_id
    for update;
  if v_row.id is null then
    raise exception 'Produkti i partnerit s''u gjet ose s''i përket këtij partneri.';
  end if;

  select low_stock_threshold into v_threshold from public.partners where id = v_partner_id;
  v_old_status := v_row.status;
  v_new_status := case
    when p_new_stock = 0 then 'out_of_stock'
    when p_new_stock <= v_threshold then 'low_stock'
    else 'in_stock'
  end;

  insert into public.inventory_logs (partner_product_id, old_stock, new_stock, change, reason, user_id)
  values (v_row.id, v_row.stock, p_new_stock, p_new_stock - v_row.stock, coalesce(p_reason, 'manual_update'), auth.uid());

  update public.partner_products
    set stock = p_new_stock, status = v_new_status, updated_at = now()
    where id = v_row.id
    returning * into v_row;

  if v_new_status in ('low_stock', 'out_of_stock') and v_old_status is distinct from v_new_status then
    select company_name into v_partner_name from public.partners where id = v_partner_id;
    select name into v_product_name from public.products where id = v_row.product_id;
    insert into public.admin_notifications (type, title, body, payload)
    values (
      case when v_new_status = 'out_of_stock' then 'out_of_stock' else 'low_stock' end,
      case when v_new_status = 'out_of_stock' then 'Produkt pa stok' else 'Stok i ulët' end,
      v_partner_name || ' — ' || coalesce(v_product_name, 'produkt') || ' (stok: ' || p_new_stock || ')',
      jsonb_build_object('partner_id', v_partner_id, 'partner_product_id', v_row.id, 'stock', p_new_stock)
    );
  end if;

  return v_row;
end;
$$;

revoke execute on function public.update_partner_stock(uuid, integer, text) from public, anon;
grant execute on function public.update_partner_stock(uuid, integer, text) to authenticated;

-- Aplikimi i partnerit: gjatesi te kufizuara (panel-i i adminit i shfaq),
-- dhe vetem nga nje llogari e kycur.
create or replace function public.submit_partner_application(
  p_company_name text, p_business_reg_number text, p_contact_person text, p_email text,
  p_phone text, p_address text, p_city text, p_country text, p_website text,
  p_business_category text, p_description text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_partner_id uuid;
  v_company text := btrim(coalesce(p_company_name, ''));
  v_contact text := btrim(coalesce(p_contact_person, ''));
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_phone text := btrim(coalesce(p_phone, ''));
begin
  if auth.uid() is null then
    raise exception 'Duhet të krijosh llogari para se të aplikosh.';
  end if;
  if exists (select 1 from public.partner_users where user_id = auth.uid()) then
    raise exception 'Ky account është tashmë i lidhur me një partner Bebix.';
  end if;
  if char_length(v_company) < 2 or char_length(v_company) > 120 then
    raise exception 'Emri i kompanisë duhet të ketë 2 deri në 120 shenja.';
  end if;
  if char_length(v_contact) < 2 or char_length(v_contact) > 120 then
    raise exception 'Personi kontaktues duhet të ketë 2 deri në 120 shenja.';
  end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(v_email) > 200 then
    raise exception 'Email-i nuk është i vlefshëm.';
  end if;
  if v_phone !~ '^[+0-9 ()./-]{6,30}$' then
    raise exception 'Numri i telefonit nuk është i vlefshëm.';
  end if;
  if char_length(coalesce(p_description, '')) > 2000
     or char_length(coalesce(p_address, '')) > 300
     or char_length(coalesce(p_city, '')) > 120
     or char_length(coalesce(p_country, '')) > 120
     or char_length(coalesce(p_website, '')) > 300
     or char_length(coalesce(p_business_category, '')) > 120
     or char_length(coalesce(p_business_reg_number, '')) > 60 then
    raise exception 'Disa fusha janë shumë të gjata.';
  end if;

  insert into public.partners (
    company_name, business_reg_number, contact_person, email, phone,
    address, city, country, website, business_category, description, status
  ) values (
    v_company, nullif(btrim(p_business_reg_number), ''), v_contact, v_email, v_phone,
    nullif(btrim(p_address), ''), nullif(btrim(p_city), ''), nullif(btrim(p_country), ''),
    nullif(btrim(p_website), ''), nullif(btrim(p_business_category), ''), nullif(btrim(p_description), ''),
    'pending'
  )
  returning id into v_partner_id;

  insert into public.partner_users (partner_id, user_id, role)
  values (v_partner_id, auth.uid(), 'owner');

  insert into public.partner_notifications (partner_id, type, title, body)
  values (v_partner_id, 'admin_message', 'Aplikimi u dërgua', 'Aplikimi juaj është duke u shqyrtuar nga Bebix.');

  insert into public.admin_notifications (type, title, body, payload)
  values (
    'new_partner_application',
    'Aplikim i ri partneri',
    v_company || ' ka aplikuar për t''u bërë partner Bebix.',
    jsonb_build_object('partner_id', v_partner_id, 'company_name', v_company)
  );

  return v_partner_id;
end;
$$;

revoke execute on function public.submit_partner_application(text, text, text, text, text, text, text, text, text, text, text) from public, anon;
grant execute on function public.submit_partner_application(text, text, text, text, text, text, text, text, text, text, text) to authenticated;
