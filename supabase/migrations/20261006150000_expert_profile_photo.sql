-- Foto e profilit të mjekut/ekspertit.
--   - `community_experts.photo_path`: rruga e fotos te bucket-i `community-media` (publik, si fotot e postimeve),
--     gjithmonë te dosja e vet e përdoruesit (`<user_id>/...`).
--   - `set_my_expert_photo(path)`: eksperti ndryshon VETËM fotot e veta (tabela e ekspertëve është e shkruajtshme
--     vetëm nga admini, ndaj kjo është rruga e vetme e sigurt): kontrollon që rruga është e dosjes së tij.
--     Kthen foton e vjetër (rrugën) që app-i ta fshijë nga hapësira.
-- Shtesë e vogël; s'ndryshon të dhëna ekzistuese.

begin;

alter table public.community_experts add column if not exists photo_path text;
alter table public.community_experts drop constraint if exists community_experts_photo_path_len;
alter table public.community_experts add constraint community_experts_photo_path_len
  check (photo_path is null or char_length(photo_path) <= 300);

create or replace function public.set_my_expert_photo(p_path text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_old text;
begin
  if v_uid is null then
    raise exception 'Duhet të jesh i kyçur.';
  end if;
  if p_path is not null and (p_path not like v_uid::text || '/%' or char_length(p_path) > 300 or p_path like '%..%') then
    raise exception 'Fotoja duhet të jetë e ngarkuar nga ti.';
  end if;
  select photo_path into v_old from public.community_experts where user_id = v_uid for update;
  if not found then
    raise exception 'Vetëm ekspertët e verifikuar kanë foto profili.';
  end if;
  update public.community_experts set photo_path = nullif(btrim(p_path), '') where user_id = v_uid;
  return v_old;
end;
$$;
revoke all on function public.set_my_expert_photo(text) from public, anon;
grant execute on function public.set_my_expert_photo(text) to authenticated;

commit;
