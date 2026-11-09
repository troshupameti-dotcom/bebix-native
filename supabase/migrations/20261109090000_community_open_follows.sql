-- =====================================================================
-- Profili në komunitet: ndjekësit dhe të ndjekurit i sheh çdo prind (9 nëntor 2026).
--
--  - Deri tani `community_can_see_follows` i lejonte listat vetëm vetë personit dhe miqve të tij (kur ndiqen të
--    dy). Tani i sheh çdo prind që ka hyrë në llogari.
--  - Bllokimi mbetet: kur njëri e ka bllokuar tjetrin, listat s'shihen. Brenda listës, personat e bllokuar s'dalin,
--    si më parë (`community_follow_list` s'ndryshon).
--  - Pa llogari: asgjë, si më parë.
--
-- Rendi: pas 20261022090000_community_profiles.sql.
-- Vetëm `create or replace function`: s'fshin asgjë, s'varet nga transaksioni dhe është i sigurt për t'u
-- ekzekutuar dy herë. Kthimi mbrapa: supabase/rollbacks/20261109090000_community_open_follows_rollback.sql.
-- PA EKZEKUTUAR: ekzekutoje te Supabase → SQL Editor.
-- =====================================================================

create or replace function public.community_can_see_follows(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select (select auth.uid()) is not null and (
    p_user = (select auth.uid())
    or not exists (
      select 1 from public.community_blocks b
      where (b.blocker_id = (select auth.uid()) and b.blocked_id = p_user)
         or (b.blocker_id = p_user and b.blocked_id = (select auth.uid()))
    )
  );
$$;

revoke execute on function public.community_can_see_follows(uuid) from public, anon;
grant execute on function public.community_can_see_follows(uuid) to authenticated;
