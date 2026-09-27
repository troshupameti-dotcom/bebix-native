-- Auditimi (28 shtator 2026): politikat qe lejonin me shume se sa duhej.
--
-- 1. orders: klienti mund te fuste nje porosi DIREKT (pa place_order), me
--    cmime dhe total te zgjedhur prej tij. Porosite krijohen vetem nga
--    place_order (SECURITY DEFINER), prandaj politika e INSERT-it hiqet.
-- 2. order_items: partneri mund te ndryshonte CDO kolone te artikujve te vet
--    (komisionin, fitimin, cmimin). Statusi ndryshohet me RPC-ne
--    update_order_item_status; politika e UPDATE-it hiqet.
-- 3. partners: kushdo (edhe pa llogari) mund te shtonte partnere. Aplikimi
--    kalon nga submit_partner_application (kerkon llogari). Politika hiqet.
--    Partneri mund te ndryshonte vete `status`-in (p.sh. te aprovohej vete):
--    tani fushat e aprovimit i ndryshon vetem admini.
-- 4. partner_products: kushdo mund t'i lexonte (edhe komisionin per produkt),
--    dhe partneri mund te ndryshonte komisionin/produktin/stokun pa gjurme.
--    Leximi mbetet per partnerin e vet dhe adminin; stoku ndryshon me RPC.
-- 5. partner_commission_rules: rregullat e pergjithshme (partner_id null)
--    lexoheshin nga cilido. Tani vetem nga partneret.
-- 6. expert_applications: aplikimi futet vetem si "pending".
-- 7. storage brand-logos: kushdo mund te ngarkonte cfaredo skedari, cfaredo
--    madhesie, ne nje bucket publik. Tani vetem admini, vetem imazhe.

drop policy if exists users_insert_own_orders on public.orders;
drop policy if exists order_items_partner_update_status on public.order_items;
drop policy if exists partners_public_apply on public.partners;
drop policy if exists partner_products_public_stock_read on public.partner_products;
drop policy if exists partner_products_self_update on public.partner_products;

drop policy if exists commission_rules_self_read on public.partner_commission_rules;
create policy commission_rules_self_read on public.partner_commission_rules
  for select to authenticated
  using (
    (select public.current_partner_id()) is not null
    and (partner_id = (select public.current_partner_id()) or partner_id is null)
  );

-- Fushat e aprovimit: vetem admini.
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
  end if;
  new.updated_at := now();
  return new;
end;
$$;

revoke execute on function public.partners_guard() from public, anon, authenticated;

drop trigger if exists partners_guard on public.partners;
create trigger partners_guard before update on public.partners
  for each row execute function public.partners_guard();

-- Aplikimi i ekspertit: vetem "pending", pa fushat e shqyrtimit, dhe nje
-- aplikim ne pritje per llogari.
drop policy if exists expert_applications_self_insert on public.expert_applications;
create policy expert_applications_self_insert on public.expert_applications
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and status = 'pending'
    and admin_note is null
    and reviewed_at is null
    and reviewed_by is null
  );

create unique index if not exists expert_applications_one_pending
  on public.expert_applications (user_id) where status = 'pending';

-- Storage: logot e markave i ngarkon vetem admini.
drop policy if exists "Public upload brand logos" on storage.objects;
drop policy if exists brand_logos_admin_insert on storage.objects;
drop policy if exists brand_logos_admin_update on storage.objects;
drop policy if exists brand_logos_admin_delete on storage.objects;

create policy brand_logos_admin_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'brand-logos' and public.is_admin());
create policy brand_logos_admin_update on storage.objects
  for update to authenticated
  using (bucket_id = 'brand-logos' and public.is_admin())
  with check (bucket_id = 'brand-logos' and public.is_admin());
create policy brand_logos_admin_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'brand-logos' and public.is_admin());

update storage.buckets
  set file_size_limit = 5 * 1024 * 1024,
      allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']
  where id = 'brand-logos';

update storage.buckets
  set file_size_limit = 10 * 1024 * 1024,
      allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
  where id = 'product-images';
