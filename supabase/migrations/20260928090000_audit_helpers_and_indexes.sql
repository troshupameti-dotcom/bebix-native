-- Auditimi (28 shtator 2026): funksione ndihmese dhe indekset qe mungonin.
--
-- Rishkrimi i te gjitha politikave RLS per shpejtesi (advisor:
-- auth_rls_initplan) NUK eshte ketu: pret miratimin e pronarit te projektit,
-- shih supabase/pending-approval/rls_initplan_rewrite.sql.

-- Admini i kyçur? Nje funksion i vetem, per politikat dhe RPC-te e reja.
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

-- search_path i fiksuar (advisor: function_search_path_mutable).
create or replace function public.current_partner_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select partner_id from public.partner_users where user_id = (select auth.uid()) limit 1;
$$;

-- Partneri qe mund te VEPROJE: vetem kur Bebix e ka aprovuar. Leximi i
-- profilit te vet mbetet me current_partner_id(), qe portali te tregoje
-- "aplikimi ne pritje" edhe para aprovimit.
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

-- Indekset per celesat e huaj (advisor: unindexed_foreign_keys). Pa to,
-- fshirja e nje llogarie dhe kerkesat sipas perdoruesit lexojne tabelen e plote.
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
