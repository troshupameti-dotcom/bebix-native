-- Tregtari i shton vetë produktet (me dy mënyra): Bebix i caktuan produktet, si
-- më parë, OSE tregtari i krijon vetë. Porosia mbetet gjithmonë e klientit me
-- Bebix; tregtari sheh e përmbush vetëm artikujt e tij.
--
-- Kontrolli: produkti i krijuar nga tregtari del "pending" dhe NUK shitet
-- (is_active = false: faqja, appi dhe `place_order_core` shohin vetëm
-- produktet aktive). Admini e aprovon ose e refuzon me arsye. Një tregtari të
-- besuar admini mund t'i japë "publikim direkt" (partners.can_publish_directly).

-- ------------------------------------------------------------------ kolonat
alter table public.partners
  add column if not exists can_publish_directly boolean not null default false;

alter table public.products
  add column if not exists created_by_partner uuid references public.partners (id) on delete set null,
  add column if not exists approval_status text not null default 'approved',
  add column if not exists rejection_reason text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'products_approval_status_check') then
    alter table public.products
      add constraint products_approval_status_check check (approval_status in ('approved', 'pending', 'rejected'));
  end if;
end $$;

create index if not exists products_pending_idx on public.products (created_at) where approval_status = 'pending';
create index if not exists products_created_by_partner_idx on public.products (created_by_partner) where created_by_partner is not null;

-- Tregtari s'mund ta japë vetë "publikimin direkt" (vetëm admini).
create or replace function public.partners_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    new.status := old.status;
    new.approved_at := old.approved_at;
    new.approved_by := old.approved_by;
    new.applied_at := old.applied_at;
    new.created_at := old.created_at;
    new.can_publish_directly := old.can_publish_directly;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

-- --------------------------------------------------------------- leximi (RLS)
-- Tregtari i sheh produktet që ka krijuar (edhe në pritje) dhe ato që i janë
-- caktuar (edhe nëse admini i ka çaktivizuar). Publiku sheh vetëm aktivet.
drop policy if exists products_partner_read on public.products;
create policy products_partner_read on public.products
  for select to authenticated
  using (
    created_by_partner = (select public.current_partner_id())
    or exists (
      select 1 from public.partner_products pp
      where pp.product_id = products.id and pp.partner_id = (select public.current_partner_id())
    )
  );

-- -------------------------------------------------------------------- fotot
-- Tregtari ngarkon vetëm te `partners/<id-i-tij>/` brenda `product-images`.
drop policy if exists product_images_partner_insert on storage.objects;
create policy product_images_partner_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'product-images'
    and (storage.foldername(name))[1] = 'partners'
    and (storage.foldername(name))[2] = (select public.current_active_partner_id())::text
    and (select public.current_partner_role()) in ('owner', 'manager')
  );

drop policy if exists product_images_partner_delete on storage.objects;
create policy product_images_partner_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'product-images'
    and (storage.foldername(name))[1] = 'partners'
    and (storage.foldername(name))[2] = (select public.current_active_partner_id())::text
    and (select public.current_partner_role()) in ('owner', 'manager')
  );

-- --------------------------------------------------------- validimi i brendshëm
create or replace function public._partner_product_validate(
  p_pid uuid, p_name text, p_description text, p_price numeric, p_compare_at_price numeric,
  p_brand_id uuid, p_category_id uuid, p_image_urls text[], p_sku text, p_barcode text
)
returns void
language plpgsql
stable
set search_path = public
as $$
declare
  v_img    text;
  v_prefix text := '/storage/v1/object/public/product-images/partners/' || p_pid::text || '/';
begin
  if char_length(btrim(coalesce(p_name, ''))) < 3 or char_length(btrim(p_name)) > 160 then
    raise exception 'Emri i produktit duhet të ketë 3 deri në 160 shenja.';
  end if;
  if char_length(coalesce(p_description, '')) > 4000 then
    raise exception 'Përshkrimi është shumë i gjatë (maksimumi 4000 shenja).';
  end if;
  if p_price is null or p_price < 0.01 or p_price > 100000 then
    raise exception 'Çmimi duhet të jetë nga 0.01 deri në 100000 euro.';
  end if;
  if p_compare_at_price is not null and p_compare_at_price < p_price then
    raise exception 'Çmimi i vjetër nuk mund të jetë më i vogël se çmimi aktual.';
  end if;
  if p_brand_id is not null and not exists (select 1 from public.brands where id = p_brand_id) then
    raise exception 'Marka nuk ekziston.';
  end if;
  if p_category_id is null or not exists (select 1 from public.categories where id = p_category_id) then
    raise exception 'Zgjidh një kategori.';
  end if;
  if coalesce(array_length(p_image_urls, 1), 0) < 1 then
    raise exception 'Shto të paktën një foto.';
  end if;
  if array_length(p_image_urls, 1) > 8 then
    raise exception 'Mund të shtosh deri në 8 foto.';
  end if;
  foreach v_img in array p_image_urls loop
    if v_img is null or char_length(v_img) > 500 or position(v_prefix in v_img) = 0
       or v_img !~* '\.(jpe?g|png|webp)$' then
      raise exception 'Një foto nuk është ngarkuar saktë. Hiqe dhe ngarkoje përsëri.';
    end if;
  end loop;
  if char_length(coalesce(p_sku, '')) > 60 or char_length(coalesce(p_barcode, '')) > 40 then
    raise exception 'SKU ose barkodi është shumë i gjatë.';
  end if;
end;
$$;

revoke execute on function public._partner_product_validate(uuid, text, text, numeric, numeric, uuid, uuid, text[], text, text) from public, anon, authenticated;

-- ------------------------------------------------------------ krijimi (tregtari)
create or replace function public.partner_create_product(
  p_name text, p_description text, p_price numeric, p_compare_at_price numeric,
  p_brand_id uuid, p_category_id uuid, p_image_urls text[], p_sku text, p_barcode text,
  p_stock int, p_free_delivery boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pid        uuid := public.current_active_partner_id();
  v_partner    public.partners%rowtype;
  v_name       text := regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g');
  v_direct     boolean;
  v_status     text;
  v_product_id uuid;
  v_pp_id      uuid;
  v_stock_st   text;
begin
  if v_pid is null then
    raise exception 'Nuk ke qasje si partner.';
  end if;
  if public.current_partner_role() not in ('owner', 'manager') then
    raise exception 'Nuk ke leje të shtosh produkte.';
  end if;
  if p_stock is null or p_stock < 0 or p_stock > 100000 then
    raise exception 'Stoku duhet të jetë nga 0 deri në 100000.';
  end if;
  perform public._partner_product_validate(v_pid, v_name, p_description, p_price, p_compare_at_price, p_brand_id, p_category_id, p_image_urls, p_sku, p_barcode);

  -- Kufij kundër abuzimit.
  if (select count(*) from public.products where created_by_partner = v_pid and approval_status = 'pending') >= 25 then
    raise exception 'Ke shumë produkte në pritje të aprovimit. Prit që Bebix t''i shqyrtojë.';
  end if;
  if (select count(*) from public.products where created_by_partner = v_pid and created_at > now() - interval '1 day') >= 60 then
    raise exception 'Kufiri ditor i produkteve të reja u arrit. Provo nesër.';
  end if;

  select * into v_partner from public.partners where id = v_pid;
  v_direct := v_partner.can_publish_directly;
  v_status := case when v_direct then 'approved' else 'pending' end;

  insert into public.products (name, brand_id, description, price, compare_at_price, category_id,
    image_url, gallery_urls, accent, stock, is_active, free_delivery, created_by_partner, approval_status)
  values (v_name, p_brand_id, nullif(btrim(coalesce(p_description, '')), ''), p_price, p_compare_at_price, p_category_id,
    p_image_urls[1], p_image_urls[2:array_length(p_image_urls, 1)], 'olive', 0, v_direct,
    coalesce(p_free_delivery, false), v_pid, v_status)
  returning id into v_product_id;

  v_stock_st := case
    when p_stock = 0 then 'out_of_stock'
    when p_stock <= v_partner.low_stock_threshold then 'low_stock'
    else 'in_stock' end;

  insert into public.partner_products (partner_id, product_id, sku, barcode, stock, status)
  values (v_pid, v_product_id, nullif(btrim(coalesce(p_sku, '')), ''), nullif(btrim(coalesce(p_barcode, '')), ''), p_stock, v_stock_st)
  returning id into v_pp_id;

  insert into public.inventory_logs (partner_product_id, old_stock, new_stock, change, reason, user_id)
  values (v_pp_id, 0, p_stock, p_stock, 'manual_update', auth.uid());

  if v_direct then
    insert into public.partner_notifications (partner_id, type, title, body, payload)
    values (v_pid, 'admin_message', 'Produkti u publikua', v_name, jsonb_build_object('product_id', v_product_id));
  else
    insert into public.partner_notifications (partner_id, type, title, body, payload)
    values (v_pid, 'admin_message', 'Produkti u dërgua për aprovim', v_name || ' po shqyrtohet nga Bebix.', jsonb_build_object('product_id', v_product_id));
    insert into public.admin_notifications (type, title, body, payload)
    values ('new_product_request', 'Produkt i ri për aprovim', v_partner.company_name || ' — ' || v_name,
      jsonb_build_object('product_id', v_product_id, 'partner_id', v_pid));
  end if;

  return jsonb_build_object('product_id', v_product_id, 'partner_product_id', v_pp_id, 'approval_status', v_status);
end;
$$;

revoke execute on function public.partner_create_product(text, text, numeric, numeric, uuid, uuid, text[], text, text, int, boolean) from public, anon;
grant execute on function public.partner_create_product(text, text, numeric, numeric, uuid, uuid, text[], text, text, int, boolean) to authenticated, service_role;

-- ---------------------------------------------------------- ndryshimi (tregtari)
-- Vetëm produktet që ka krijuar vetë. Ndryshimet e rëndësishme (emër, përshkrim,
-- çmim, foto, markë, kategori) te një tregtar i pabesuar kthejnë produktin në
-- "pending": s'mund të aprovohet një foto ose çmim e pastaj të ndërrohet.
create or replace function public.partner_update_product(
  p_product_id uuid, p_name text, p_description text, p_price numeric, p_compare_at_price numeric,
  p_brand_id uuid, p_category_id uuid, p_image_urls text[], p_sku text, p_barcode text,
  p_free_delivery boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pid      uuid := public.current_active_partner_id();
  v_partner  public.partners%rowtype;
  v_product  public.products%rowtype;
  v_name     text := regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g');
  v_desc     text := nullif(btrim(coalesce(p_description, '')), '');
  v_material boolean;
  v_new      text;
begin
  if v_pid is null then
    raise exception 'Nuk ke qasje si partner.';
  end if;
  if public.current_partner_role() not in ('owner', 'manager') then
    raise exception 'Nuk ke leje të ndryshosh produkte.';
  end if;

  select * into v_product from public.products where id = p_product_id and created_by_partner = v_pid for update;
  if v_product.id is null then
    raise exception 'Ky produkt nuk është krijuar nga ti, prandaj s''mund ta ndryshosh.';
  end if;
  perform public._partner_product_validate(v_pid, v_name, p_description, p_price, p_compare_at_price, p_brand_id, p_category_id, p_image_urls, p_sku, p_barcode);

  select * into v_partner from public.partners where id = v_pid;

  v_material :=
       v_name is distinct from v_product.name
    or v_desc is distinct from v_product.description
    or p_price is distinct from v_product.price
    or p_compare_at_price is distinct from v_product.compare_at_price
    or p_brand_id is distinct from v_product.brand_id
    or p_category_id is distinct from v_product.category_id
    or p_image_urls[1] is distinct from v_product.image_url
    or p_image_urls[2:array_length(p_image_urls, 1)] is distinct from coalesce(v_product.gallery_urls, '{}');

  v_new := v_product.approval_status;
  if v_partner.can_publish_directly then
    v_new := 'approved';
  elsif v_product.approval_status = 'rejected' or (v_product.approval_status = 'approved' and v_material) then
    v_new := 'pending';
  end if;

  update public.products set
    name = v_name, description = v_desc, price = p_price, compare_at_price = p_compare_at_price,
    brand_id = p_brand_id, category_id = p_category_id,
    image_url = p_image_urls[1], gallery_urls = p_image_urls[2:array_length(p_image_urls, 1)],
    free_delivery = coalesce(p_free_delivery, false),
    approval_status = v_new,
    rejection_reason = case when v_new = 'rejected' then rejection_reason else null end,
    -- Aktivizimi ndryshon vetëm kur ndryshon statusi (admini mund ta ketë fshehur vetë).
    is_active = case when v_new is distinct from v_product.approval_status then (v_new = 'approved') else is_active end
  where id = p_product_id;

  update public.partner_products set
    sku = nullif(btrim(coalesce(p_sku, '')), ''), barcode = nullif(btrim(coalesce(p_barcode, '')), ''), updated_at = now()
  where product_id = p_product_id and partner_id = v_pid;

  if v_new = 'pending' and v_product.approval_status is distinct from 'pending' then
    insert into public.admin_notifications (type, title, body, payload)
    values ('new_product_request', 'Produkt për rishqyrtim', v_partner.company_name || ' — ' || v_name,
      jsonb_build_object('product_id', p_product_id, 'partner_id', v_pid));
    insert into public.partner_notifications (partner_id, type, title, body, payload)
    values (v_pid, 'admin_message', 'Produkti u dërgua për aprovim', v_name || ' po shqyrtohet përsëri nga Bebix.', jsonb_build_object('product_id', p_product_id));
  end if;

  return jsonb_build_object('product_id', p_product_id, 'approval_status', v_new);
end;
$$;

revoke execute on function public.partner_update_product(uuid, text, text, numeric, numeric, uuid, uuid, text[], text, text, boolean) from public, anon;
grant execute on function public.partner_update_product(uuid, text, text, numeric, numeric, uuid, uuid, text[], text, text, boolean) to authenticated, service_role;

-- ------------------------------------------------- çaktivizo / aktivizo ofertën
create or replace function public.partner_set_offer_active(p_partner_product_id uuid, p_active boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pid  uuid := public.current_active_partner_id();
  v_pp   public.partner_products%rowtype;
  v_thr  int;
begin
  if v_pid is null then
    raise exception 'Nuk ke qasje si partner.';
  end if;
  if public.current_partner_role() not in ('owner', 'manager') then
    raise exception 'Nuk ke leje për këtë veprim.';
  end if;
  select * into v_pp from public.partner_products where id = p_partner_product_id and partner_id = v_pid for update;
  if v_pp.id is null then
    raise exception 'Produkti nuk u gjet.';
  end if;
  select low_stock_threshold into v_thr from public.partners where id = v_pid;
  update public.partner_products set
    status = case
      when not p_active then 'inactive'
      when v_pp.stock = 0 then 'out_of_stock'
      when v_pp.stock <= v_thr then 'low_stock'
      else 'in_stock' end,
    updated_at = now()
  where id = v_pp.id;
end;
$$;

revoke execute on function public.partner_set_offer_active(uuid, boolean) from public, anon;
grant execute on function public.partner_set_offer_active(uuid, boolean) to authenticated, service_role;

-- --------------------------------------------------------------- aprovimi (admin)
create or replace function public.admin_review_product(p_product_id uuid, p_approve boolean, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product public.products%rowtype;
  v_reason  text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if not public.is_admin() then
    raise exception 'Vetëm admini mund ta aprovojë një produkt.';
  end if;
  select * into v_product from public.products where id = p_product_id and created_by_partner is not null for update;
  if v_product.id is null then
    raise exception 'Produkti nuk u gjet ose nuk është i një tregtari.';
  end if;

  if p_approve then
    update public.products set approval_status = 'approved', is_active = true, rejection_reason = null where id = p_product_id;
  else
    if v_reason is null or char_length(v_reason) < 3 or char_length(v_reason) > 300 then
      raise exception 'Shkruaj arsyen e refuzimit (3 deri në 300 shenja).';
    end if;
    update public.products set approval_status = 'rejected', is_active = false, rejection_reason = v_reason where id = p_product_id;
  end if;

  insert into public.partner_notifications (partner_id, type, title, body, payload)
  values (v_product.created_by_partner, 'admin_message',
    case when p_approve then 'Produkti u aprovua' else 'Produkti u refuzua' end,
    case when p_approve then v_product.name || ' tani shitet në Bebix.' else v_product.name || ': ' || v_reason end,
    jsonb_build_object('product_id', p_product_id));
end;
$$;

revoke execute on function public.admin_review_product(uuid, boolean, text) from public, anon;
grant execute on function public.admin_review_product(uuid, boolean, text) to authenticated, service_role;
