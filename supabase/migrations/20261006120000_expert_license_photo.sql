-- Fotoja e licencës së mjekut te aplikimi për ekspert.
--   - `expert_applications.license_photo_path`: rruga e fotos te bucket-i privat `expert-licenses`.
--   - Bucket-i është PRIVAT (dokument personal): aplikanti ngarkon vetëm te dosja e vet (`<user_id>/...`) dhe e sheh
--     vetëm ai dhe admini; admini e hap me lidhje të përkohshme (signed URL). S'ka lexim publik.
--   - Kufi 10 MB, vetëm foto (jpeg, png, webp, heic).
-- Shtesë e vogël; s'ndryshon të dhëna ekzistuese.

begin;

alter table public.expert_applications add column if not exists license_photo_path text;
alter table public.expert_applications drop constraint if exists expert_applications_license_photo_len;
alter table public.expert_applications add constraint expert_applications_license_photo_len
  check (license_photo_path is null or char_length(license_photo_path) <= 300);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('expert-licenses', 'expert-licenses', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
on conflict (id) do update
  set public = false, file_size_limit = 10485760, allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/heic'];

drop policy if exists expert_licenses_insert_own on storage.objects;
create policy expert_licenses_insert_own on storage.objects for insert to authenticated
  with check (bucket_id = 'expert-licenses' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists expert_licenses_read on storage.objects;
create policy expert_licenses_read on storage.objects for select to authenticated
  using (bucket_id = 'expert-licenses' and ((storage.foldername(name))[1] = (select auth.uid())::text or (select public.is_admin())));

drop policy if exists expert_licenses_delete_own on storage.objects;
create policy expert_licenses_delete_own on storage.objects for delete to authenticated
  using (bucket_id = 'expert-licenses' and ((storage.foldername(name))[1] = (select auth.uid())::text or (select public.is_admin())));

commit;
