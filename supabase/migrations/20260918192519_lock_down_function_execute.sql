-- Supabase-i ka `alter default privileges ... grant all on functions to anon,
-- authenticated`, prandaj cdo funksion i ri lind i thirrshem nga `anon`.
-- `revoke ... from public` NUK e heq ate grant te shprehur — duhet hequr
-- direkt nga roli. (I njejti kurth si te `place_order`, ne drejtim te kundert.)
--
-- Funksionet e triggerave nuk thirren kurre direkt. EXECUTE kontrollohet
-- kur krijohet triggeri, jo kur ai ndizet — e verifikuar me test: pas heqjes,
-- triggerat e vleresimeve vazhduan te ndizen normalisht.
--
-- APLIKUAR TASHME ne projekt.

revoke execute on function public.notify_admin_new_order() from public, anon, authenticated;
revoke execute on function public.notify_customer_order_status() from public, anon, authenticated;
revoke execute on function public.product_review_mark_verified() from public, anon, authenticated;
revoke execute on function public.product_reviews_refresh_aggregate() from public, anon, authenticated;

revoke execute on function public.can_access_baby_data(uuid) from anon;
revoke execute on function public.my_data_owner() from anon;
revoke execute on function public.create_household_invite() from anon;
revoke execute on function public.join_household(text) from anon;
