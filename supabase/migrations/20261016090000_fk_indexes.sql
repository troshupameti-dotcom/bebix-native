-- Indekset për çelësat e huaj që s'kishin (këshilla e Supabase "unindexed_foreign_keys").
-- Pa to, fshirja e një përdoruesi/produkti kontrollon tabelat rresht për rresht.
-- Vetëm shtim indeksesh: s'ndryshon asnjë të dhënë dhe mund të ekzekutohet sa herë të duash.

create index if not exists expert_applications_specialty_key_idx on public.expert_applications (specialty_key);
create index if not exists gift_list_items_product_idx on public.gift_list_items (product_id);
create index if not exists household_night_shifts_set_by_idx on public.household_night_shifts (set_by);
create index if not exists household_night_shifts_user_idx on public.household_night_shifts (user_id);
create index if not exists household_thanks_owner_idx on public.household_thanks (owner_id);
create index if not exists household_thanks_to_user_idx on public.household_thanks (to_user);
create index if not exists time_capsule_letters_author_idx on public.time_capsule_letters (author_id);
