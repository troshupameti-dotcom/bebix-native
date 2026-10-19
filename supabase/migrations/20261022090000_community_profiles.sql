-- =====================================================================
-- Profili në komunitet: foto për çdo prind, dhe listat e ndjekjes.
--
--  - `community_user_profiles.avatar_path`: fotoja e profilit e prindit te
--    bucket-i publik `community-media` (`<user_id>/avatar-*.jpg`, si fotoja e
--    ekspertit). Postimet s'e ruajnë foton: app-i e lexon nga profili sa herë
--    shfaqen, ndaj edhe postimet e vjetra marrin foton e re menjëherë.
--  - `set_my_community_avatar(path)`: vendos foton (vetëm nga dosja e vet).
--  - `community_follow_list(user, kind)`: ndjekësit / të ndjekurit e një
--    personi. I sheh vetë personi dhe miqtë e tij (kur ndiqen të dy); të tjerët
--    shohin vetëm numrat.
--
-- Rendi: pas 20261019090000_direct_messages.sql. I sigurt për dy ekzekutime;
-- s'fshin asgjë.
-- PA EKZEKUTUAR: ekzekutoje te Supabase → SQL Editor.
-- =====================================================================

alter table public.community_user_profiles add column if not exists avatar_path text;

-- Fotoja e profilit: rruga duhet të jetë te dosja e vetë personit. Kthen rrugën e vjetër (app-i e fshin).
create or replace function public.set_my_community_avatar(p_path text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := (select auth.uid());
  v_old text;
begin
  if v_me is null then
    raise exception 'not_authenticated';
  end if;
  if p_path is not null and (p_path not like v_me::text || '/%' or char_length(p_path) > 300 or p_path like '%..%') then
    raise exception 'Fotoja duhet të jetë e ngarkuar nga ti.';
  end if;
  select avatar_path into v_old from public.community_user_profiles where user_id = v_me;
  insert into public.community_user_profiles (user_id, display_name, avatar_path, updated_at)
  values (v_me, public.community_display_name(v_me), p_path, now())
  on conflict (user_id) do update set avatar_path = excluded.avatar_path, updated_at = now();
  return v_old;
end;
$$;

revoke execute on function public.set_my_community_avatar(text) from public, anon;
grant execute on function public.set_my_community_avatar(text) to authenticated;

-- A i sheh unë listat e ndjekjes së këtij personi: vetja, ose miq (ndiqemi të dy).
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

-- Ndjekësit ('followers') ose të ndjekurit ('following'), me emrin dhe foton. Bosh kur s'lejohet.
create or replace function public.community_follow_list(p_user uuid, p_kind text)
returns table (user_id uuid, display_name text, avatar_path text, followed_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select x.uid, public.community_display_name(x.uid),
         coalesce((select e.photo_path from public.community_experts e where e.user_id = x.uid),
                  (select p.avatar_path from public.community_user_profiles p where p.user_id = x.uid)),
         x.at
  from (
    select case when p_kind = 'followers' then f.follower_id else f.followee_id end as uid, f.created_at as at
    from public.community_user_follows f
    where (p_kind = 'followers' and f.followee_id = p_user)
       or (p_kind = 'following' and f.follower_id = p_user)
  ) x
  where public.community_can_see_follows(p_user)
    and not exists (
      select 1 from public.community_blocks b
      where (b.blocker_id = (select auth.uid()) and b.blocked_id = x.uid)
         or (b.blocker_id = x.uid and b.blocked_id = (select auth.uid()))
    )
  order by x.at desc
  limit 500;
$$;

revoke execute on function public.community_follow_list(uuid, text) from public, anon;
grant execute on function public.community_follow_list(uuid, text) to authenticated;
