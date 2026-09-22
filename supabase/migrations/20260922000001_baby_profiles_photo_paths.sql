-- Fotoja e bebit/prindit ruhej vetem lokalisht ne AsyncStorage te telefonit,
-- kurre ne server. Cdo ri-instalim, pastrim cache-i, ose hyrje ne nje
-- pajisje tjeter e humbte fare (file-i mbetej ne Storage, i braktisur, por
-- asnje rruge nuk e gjente me). Keto dy kolona e bejne foton pjese te
-- profilit te sinkronizuar, njesoj si emri dhe datelindja.
alter table public.baby_profiles
  add column if not exists baby_photo_path text,
  add column if not exists parent_photo_path text;
