-- Forcime nga auditimi i 3 tetorit 2026. Të vogla dhe të pavarura; s'fshijnë dhe s'ndryshojnë të dhëna.
-- Ekzekuto me dorë te Supabase → SQL Editor.

-- 1) Funksion që nuk ka pse të thirret nga përdorues pa hyrje.
--    `is_admin()` NUK preket, sepse politikat RLS e përdorin.
revoke execute on function public.community_post_open_reports(uuid) from anon;

-- 2) Kova `story-media` ishte publike pa kufi madhësie dhe pa kufizim llojesh.
update storage.buckets
set file_size_limit = 52428800,
    allowed_mime_types = array['image/jpeg','image/png','image/webp','image/heic','video/mp4','video/quicktime']
where id = 'story-media' and file_size_limit is null;
