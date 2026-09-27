-- Fotot e momenteve per te gjithe shtepine, jo vetem per pronarin.
--
-- Te dhenat e bebit i perkasin PRONARIT (baby_records.user_id), dhe
-- partneri i ftuar shkruan e lexon aty (can_access_baby_data). Fotot ruhen
-- njesoj: baby-moments/<pronari>/<momenti>.<ext>. Por politikat e Storage
-- lejonin vetem dosjen auth.uid(): partneri s'i shihte fotot, dhe ngarkimi
-- i tij ne dosjen e pronarit refuzohej. Tani vlen i njejti rregull si per
-- rreshtat. Kjo vlen edhe per webin.

create or replace function public.can_access_baby_folder(p_folder text)
returns boolean
language sql
stable
set search_path = public
as $$
  select case
    when p_folder ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then public.can_access_baby_data(p_folder::uuid)
    else false
  end;
$$;

revoke execute on function public.can_access_baby_folder(text) from public, anon;
grant execute on function public.can_access_baby_folder(text) to authenticated;

drop policy if exists "Users read their own moment files" on storage.objects;
drop policy if exists "Users upload their own moment files" on storage.objects;
drop policy if exists "Users update their own moment files" on storage.objects;
drop policy if exists "Users delete their own moment files" on storage.objects;

create policy "Household reads moment files" on storage.objects
  for select to authenticated
  using (bucket_id = 'baby-moments' and public.can_access_baby_folder((storage.foldername(name))[1]));

create policy "Household uploads moment files" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'baby-moments' and public.can_access_baby_folder((storage.foldername(name))[1]));

create policy "Household updates moment files" on storage.objects
  for update to authenticated
  using (bucket_id = 'baby-moments' and public.can_access_baby_folder((storage.foldername(name))[1]))
  with check (bucket_id = 'baby-moments' and public.can_access_baby_folder((storage.foldername(name))[1]));

create policy "Household deletes moment files" on storage.objects
  for delete to authenticated
  using (bucket_id = 'baby-moments' and public.can_access_baby_folder((storage.foldername(name))[1]));
