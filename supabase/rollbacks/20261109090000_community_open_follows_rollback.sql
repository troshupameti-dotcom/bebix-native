-- Kthimi mbrapa i 20261109090000_community_open_follows.sql.
--
-- Ky skedar rri jashtë `supabase/migrations`, që të mos ekzekutohet vetë. Hapet te SQL Editor vetëm nëse duhet.
-- Listat e ndjekjes i shohin sërish vetëm vetë personi dhe miqtë e tij (kur ndiqen të dy), si te
-- 20261022090000_community_profiles.sql. I sigurt për t'u ekzekutuar dy herë.

create or replace function public.community_can_see_follows(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select (select auth.uid()) is not null and (
    p_user = (select auth.uid())
    or (
      exists (select 1 from public.community_user_follows f where f.follower_id = (select auth.uid()) and f.followee_id = p_user)
      and exists (select 1 from public.community_user_follows f where f.follower_id = p_user and f.followee_id = (select auth.uid()))
    )
  );
$$;

revoke execute on function public.community_can_see_follows(uuid) from public, anon;
grant execute on function public.community_can_see_follows(uuid) to authenticated;
