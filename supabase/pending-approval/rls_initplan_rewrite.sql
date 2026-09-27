-- Auditimi (28 shtator 2026) — 1/6: politikat RLS me te shpejta dhe me te ngushta.
--
-- 1. `is_admin()`: nje funksion i vetem ne vend te nenkerkeses
--    `auth.uid() IN (SELECT user_id FROM admins)` qe perseritej ne 40+
--    politika dhe llogaritej per CDO rresht (advisor: auth_rls_initplan).
-- 2. `auth.uid()` dhe `current_partner_id()` mbeshtjellen ne `(select ...)`,
--    qe Postgres-i t'i llogarise nje here per kerkese, jo per rresht.
-- 3. Politikat e adminit dhe te partnerit vlejne vetem per `authenticated`:
--    anon-i nuk ka pse t'i vleresoje fare, dhe keshtu funksionet ndihmese
--    nuk kane pse te thirren nga anon-i.
-- 4. Politika te dyfishta te porosive hiqen (advisor: multiple_permissive).
-- 5. Indekset qe mungonin per celesat e huaj (advisor: unindexed_foreign_keys)
--    dhe per listen e porosive te adminit sipas dates.

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admins where user_id = (select auth.uid()));
$$;

revoke execute on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- search_path i fiksuar per funksionin qe perdoret ne politikat e partnerit.
create or replace function public.current_partner_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select partner_id from public.partner_users where user_id = (select auth.uid()) limit 1;
$$;

-- Partneri qe mund te veproje: vetem kur eshte aprovuar. Leximi i profilit
-- te vet mbetet me current_partner_id(), qe portali te tregoje "ne pritje".
create or replace function public.current_active_partner_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select pu.partner_id
  from public.partner_users pu
  join public.partners p on p.id = pu.partner_id
  where pu.user_id = (select auth.uid()) and p.status = 'approved'
  limit 1;
$$;

revoke execute on function public.current_active_partner_id() from public, anon;
grant execute on function public.current_active_partner_id() to authenticated;

-- Politikat e dyfishta te porosive: e njejta rregull ne dy emra.
drop policy if exists users_read_own_orders on public.orders;
drop policy if exists order_items_customer_read on public.order_items;

-- Rishkrimi i politikave ne skemen public.
do $$
declare
  r record;
  nq text;
  nc text;
  admin_in constant text := E'(auth.uid() IN ( SELECT admins.user_id\n   FROM admins))';
  admin_exists constant text := E'(EXISTS ( SELECT 1\n   FROM admins\n  WHERE (admins.user_id = auth.uid())))';
  admin_call constant text := '( SELECT public.is_admin() AS is_admin)';
  uid_wrapped constant text := '( SELECT auth.uid() AS uid)';
  partner_wrapped constant text := '( SELECT public.current_partner_id() AS current_partner_id)';
  touches_private boolean;
  stmt text;
begin
  for r in
    select pol.polname, cls.relname, pol.polcmd, pol.polroles,
           pg_get_expr(pol.polqual, pol.polrelid) as qual,
           pg_get_expr(pol.polwithcheck, pol.polrelid) as chk
    from pg_policy pol
    join pg_class cls on cls.oid = pol.polrelid
    join pg_namespace n on n.oid = cls.relnamespace
    where n.nspname = 'public'
  loop
    nq := r.qual;
    nc := r.chk;

    if nq is not null then
      nq := replace(nq, admin_in, admin_call);
      nq := replace(nq, admin_exists, admin_call);
      nq := replace(nq, uid_wrapped, '§UID§');
      nq := replace(nq, 'auth.uid()', uid_wrapped);
      nq := replace(nq, '§UID§', uid_wrapped);
      nq := replace(nq, 'current_partner_id()', '§CP§');
      nq := replace(nq, '§CP§', partner_wrapped);
    end if;
    if nc is not null then
      nc := replace(nc, admin_in, admin_call);
      nc := replace(nc, admin_exists, admin_call);
      nc := replace(nc, uid_wrapped, '§UID§');
      nc := replace(nc, 'auth.uid()', uid_wrapped);
      nc := replace(nc, '§UID§', uid_wrapped);
      nc := replace(nc, 'current_partner_id()', '§CP§');
      nc := replace(nc, '§CP§', partner_wrapped);
    end if;

    if nq is distinct from r.qual or nc is distinct from r.chk then
      stmt := format('alter policy %I on public.%I', r.polname, r.relname);
      if nq is not null then stmt := stmt || format(' using (%s)', nq); end if;
      if nc is not null then stmt := stmt || format(' with check (%s)', nc); end if;
      execute stmt;
    end if;

    -- Politikat qe varen nga admini ose partneri: vetem per te kycurit.
    touches_private := coalesce(nq, '') like '%is_admin()%' or coalesce(nc, '') like '%is_admin()%'
                    or coalesce(nq, '') like '%current_partner_id()%' or coalesce(nc, '') like '%current_partner_id()%';
    if touches_private and r.polroles = array[0::oid] then
      execute format('alter policy %I on public.%I to authenticated', r.polname, r.relname);
    end if;
  end loop;
end $$;

-- Anon-i s'vlereson me asnje politike partneri.
revoke execute on function public.current_partner_id() from public, anon;
grant execute on function public.current_partner_id() to authenticated;

-- Indekset per celesat e huaj (fshirja e nje llogarie, kerkesat sipas perdoruesit).
create index if not exists baby_household_invites_used_by_idx on public.baby_household_invites (used_by);
create index if not exists community_blocks_blocked_idx on public.community_blocks (blocked_id);
create index if not exists community_comments_author_idx on public.community_comments (author_id);
create index if not exists community_comments_parent_idx on public.community_comments (parent_id);
create index if not exists community_expert_follows_user_idx on public.community_expert_follows (user_id);
create index if not exists community_group_members_user_idx on public.community_group_members (user_id);
create index if not exists community_post_likes_user_idx on public.community_post_likes (user_id);
create index if not exists community_post_saves_user_idx on public.community_post_saves (user_id);
create index if not exists community_posts_author_idx on public.community_posts (author_id, created_at desc);
create index if not exists community_reports_comment_idx on public.community_reports (comment_id);
create index if not exists expert_applications_reviewed_by_idx on public.expert_applications (reviewed_by);
create index if not exists inventory_logs_user_idx on public.inventory_logs (user_id);
create index if not exists medication_schedules_user_idx on public.medication_schedules (user_id);
create index if not exists order_items_partner_product_idx on public.order_items (partner_product_id);
create index if not exists order_items_product_idx on public.order_items (product_id);
create index if not exists partners_approved_by_idx on public.partners (approved_by);
create index if not exists product_reviews_user_idx on public.product_reviews (user_id);
create index if not exists push_tokens_user_idx on public.push_tokens (user_id);

-- Paneli i adminit liston porosite sipas dates, dhe "ne pritje" vecmas.
create index if not exists orders_created_idx on public.orders (created_at desc);
create index if not exists orders_pending_idx on public.orders (created_at desc) where status = 'pending';
