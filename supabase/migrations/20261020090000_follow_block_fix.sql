-- =====================================================================
-- Ndjekja respekton bllokimin nga të dyja anët.
--
-- Gabimi (i gjetur nga supabase/tests/direct-messages.test.mjs): politika
-- "community_user_follows_insert" e kontrollonte bllokimin me një nën-pyetje mbi
-- community_blocks. Ajo ekzekutohet me të drejtat e atij që ndjek, dhe RLS-ja e
-- community_blocks (community_blocks_self_all) i tregon vetëm bllokimet E TIJ —
-- jo ato ku ai është i bllokuari. Kështu, pasi Beni bllokonte Anën, Ana mund ta
-- ndiqte sërish Benin. (Mesazhet mbeteshin të bllokuara: dm_allowed() i sheh të dyja anët.)
--
-- Rregullimi: një funksion security definer që i sheh bllokimet në të dy drejtimet mes
-- përdoruesit të kyçur dhe një personi tjetër (vetëm "unë ↔ ai", jo dy të tjerë: përndryshe
-- kushdo mund të pyeste kush ka bllokuar kë), dhe politika e njëjtë që e përdor atë. S'preket asnjë e dhënë; ndjekjet ekzistuese mbeten.
-- Mund të ekzekutohet sa herë të duash.
-- PA EKZEKUTUAR: ekzekutoje te Supabase → SQL Editor.
-- =====================================================================

begin;

create or replace function public.community_blocked_with(p_other uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.community_blocks b
    where (b.blocker_id = (select auth.uid()) and b.blocked_id = p_other)
       or (b.blocker_id = p_other and b.blocked_id = (select auth.uid()))
  );
$$;

revoke execute on function public.community_blocked_with(uuid) from public, anon;
grant execute on function public.community_blocked_with(uuid) to authenticated;

drop policy if exists "community_user_follows_insert" on public.community_user_follows;
create policy "community_user_follows_insert"
  on public.community_user_follows for insert to authenticated
  with check (
    follower_id = (select auth.uid())
    and not public.community_blocked_with(followee_id)
  );

commit;
