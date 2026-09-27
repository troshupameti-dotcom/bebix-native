-- NUK ËSHTË APLIKUAR — pret miratimin (shih README.md në këtë dosje).
--
-- Auditimi (28 shtator 2026): komuniteti dhe radha e njoftimeve.
--
-- 1. Privatësia: `community_post_likes`, `community_group_members` dhe
--    `community_expert_follows` lexohen sot nga KUSHDO (edhe pa llogari) —
--    pra kush e pëlqeu cilin postim, kush është në grupin "Binjakët", kush
--    ndjek cilin mjek, me id-të e përdoruesve. Pas këtij migrimi secili sheh
--    vetëm të vetat; numrat vijnë nga numërues në tabelat kryesore.
-- 2. Shpejtësia: pamja `community_feed` numëronte TË GJITHA pëlqimet dhe
--    komentet e bazës në çdo faqe, dhe thërriste një funksion për çdo postim.
--    Me numëruesit, një faqe lexon vetëm postimet e veta.
-- 3. Njoftimet: dy zbrazje njëkohësisht të radhës mund ta dërgonin të njëjtin
--    njoftim dy herë. Tani rreshtat "merren" me FOR UPDATE SKIP LOCKED.
-- 4. Orët e qeta dhe kujtesat ditore sipas zonës kohore të prindit (diaspora),
--    jo gjithmonë Europe/Belgrade.
-- 5. Postimi i një eksperti me shumë ndjekës shkruante një njoftim për çdo
--    ndjekës brenda të njëjtës INSERT (100 000 ndjekës = 100 000 thirrje
--    funksioni para se postimi të ruhej). Tani një INSERT ... SELECT i vetëm.
--
-- PAS APLIKIMIT (ndryshime të vogla në kod):
--   - app: lib/communityData.ts, fetchGroups/fetchGroupById: `member_count`
--     në vend të `community_group_members(count)`;
--   - web: lib/community/data.ts, e njëjta gjë;
--   - send-notifications: `claim_pending_notifications` në vend të
--     `pending_notifications`;
--   - app: lib/notifications/settingsSync.ts dërgon edhe `timezone`
--     (Intl.DateTimeFormat().resolvedOptions().timeZone).

-- ---------------------------------------------------------------------
-- 1 + 2. Numëruesit dhe privatësia
-- ---------------------------------------------------------------------
alter table public.community_posts
  add column if not exists like_count integer not null default 0,
  add column if not exists comment_count integer not null default 0,
  add column if not exists open_report_count integer not null default 0;
alter table public.community_groups
  add column if not exists member_count integer not null default 0;

update public.community_posts p set
  like_count = (select count(*) from public.community_post_likes l where l.post_id = p.id),
  comment_count = (select count(*) from public.community_comments c where c.post_id = p.id),
  open_report_count = (select count(*) from public.community_reports r where r.post_id = p.id and r.status = 'open');
update public.community_groups g set
  member_count = (select count(*) from public.community_group_members m where m.group_id = g.id);

-- Shkrimet e numëruesve kalojnë trigger-in e postimit (community_posts_guard),
-- që autorit s'ia lejon t'i ndryshojë: flag-u lokal i transaksionit e dallon.
create or replace function public.community_posts_guard()
returns trigger language plpgsql security definer set search_path = public
as $$
declare v_is_expert boolean;
begin
  if coalesce(current_setting('bebix.trusted_write', true), '') = 'on' then
    return new;
  end if;
  if tg_op = 'INSERT' then
    v_is_expert := exists (select 1 from public.community_experts where user_id = new.author_id);
    new.author_name := public.community_author_name(new.author_id, new.author_name);
    new.author_initial := upper(left(new.author_name, 1));
    new.author_is_expert := v_is_expert;
    new.icon := case when v_is_expert then 'shield' else 'sparkle' end;
    new.created_at := now();
    new.updated_at := now();
    new.like_count := 0;
    new.comment_count := 0;
    new.open_report_count := 0;
    if exists (select 1 from jsonb_array_elements(coalesce(new.media, '[]'::jsonb)) m
               where coalesce(m->>'path', '') not like new.author_id::text || '/%') then
      raise exception 'Skedarët e postimit duhet të jenë të ngarkuar nga ti.';
    end if;
    return new;
  end if;
  new.author_id := old.author_id;
  new.author_name := old.author_name;
  new.author_initial := old.author_initial;
  new.author_is_expert := old.author_is_expert;
  new.icon := old.icon;
  new.created_at := old.created_at;
  new.like_count := old.like_count;
  new.comment_count := old.comment_count;
  new.open_report_count := old.open_report_count;
  new.updated_at := now();
  if new.media is distinct from old.media and exists (
    select 1 from jsonb_array_elements(coalesce(new.media, '[]'::jsonb)) m
    where coalesce(m->>'path', '') not like old.author_id::text || '/%') then
    raise exception 'Skedarët e postimit duhet të jenë të ngarkuar nga ti.';
  end if;
  return new;
end;
$$;

create or replace function public.community_bump_post_counter(p_post uuid, p_column text, p_delta int)
returns void language plpgsql security definer set search_path = public
as $$
begin
  perform set_config('bebix.trusted_write', 'on', true);
  if p_column = 'like_count' then
    update public.community_posts set like_count = greatest(0, like_count + p_delta) where id = p_post;
  elsif p_column = 'comment_count' then
    update public.community_posts set comment_count = greatest(0, comment_count + p_delta) where id = p_post;
  elsif p_column = 'open_report_count' then
    update public.community_posts
      set open_report_count = (select count(*) from public.community_reports where post_id = p_post and status = 'open')
      where id = p_post;
  end if;
  perform set_config('bebix.trusted_write', 'off', true);
end;
$$;
revoke execute on function public.community_bump_post_counter(uuid, text, int) from public, anon, authenticated;

create or replace function public.community_counters()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if tg_table_name = 'community_post_likes' then
    perform public.community_bump_post_counter(coalesce(new.post_id, old.post_id), 'like_count', case when tg_op = 'INSERT' then 1 else -1 end);
  elsif tg_table_name = 'community_comments' then
    perform public.community_bump_post_counter(coalesce(new.post_id, old.post_id), 'comment_count', case when tg_op = 'INSERT' then 1 else -1 end);
  elsif tg_table_name = 'community_reports' then
    if coalesce(new.post_id, old.post_id) is not null then
      perform public.community_bump_post_counter(coalesce(new.post_id, old.post_id), 'open_report_count', 0);
    end if;
  elsif tg_table_name = 'community_group_members' then
    update public.community_groups
      set member_count = greatest(0, member_count + case when tg_op = 'INSERT' then 1 else -1 end)
      where id = coalesce(new.group_id, old.group_id);
  end if;
  return null;
end;
$$;
revoke execute on function public.community_counters() from public, anon, authenticated;

drop trigger if exists community_likes_counter on public.community_post_likes;
create trigger community_likes_counter after insert or delete on public.community_post_likes
  for each row execute function public.community_counters();
drop trigger if exists community_comments_counter on public.community_comments;
create trigger community_comments_counter after insert or delete on public.community_comments
  for each row execute function public.community_counters();
drop trigger if exists community_reports_counter on public.community_reports;
create trigger community_reports_counter after insert or update of status or delete on public.community_reports
  for each row execute function public.community_counters();
drop trigger if exists community_members_counter on public.community_group_members;
create trigger community_members_counter after insert or delete on public.community_group_members
  for each row execute function public.community_counters();

create or replace view public.community_feed with (security_invoker = true) as
select p.id, p.author_id, p.author_name, p.author_initial, p.author_is_expert, p.accent, p.kind, p.text,
       p.tag, p.icon, p.group_id, g.name as group_name, p.created_at, p.updated_at,
       p.like_count::bigint as like_count, p.comment_count::bigint as comment_count, p.media
from public.community_posts p
left join public.community_groups g on g.id = p.group_id
where not exists (
        select 1 from public.community_blocks b
        where b.blocker_id = (select auth.uid()) and b.blocked_id = p.author_id)
  and (p.author_id = (select auth.uid()) or p.open_report_count < 3);

-- Secili sheh vetëm pëlqimet, anëtarësitë dhe ndjekjet e veta.
drop policy if exists community_post_likes_public_read on public.community_post_likes;
create policy community_post_likes_self_read on public.community_post_likes
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists community_group_members_public_read on public.community_group_members;
create policy community_group_members_self_read on public.community_group_members
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists community_expert_follows_public_read on public.community_expert_follows;
create policy community_expert_follows_self_read on public.community_expert_follows
  for select to authenticated using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------
-- 3. Radha e njoftimeve pa dërgime të dyfishta
-- ---------------------------------------------------------------------
alter table public.notification_outbox add column if not exists claimed_at timestamptz;

create or replace function public.claim_pending_notifications(p_limit integer default 200)
returns table(id bigint, user_id uuid, key text, title text, body text, data jsonb)
language sql security definer set search_path = public
as $$
  with picked as (
    select o.id
    from public.notification_outbox o
    where o.sent_at is null
      and o.attempts < 5
      and o.send_after <= now()
      and (o.expires_at is null or o.expires_at > now())
      and (o.claimed_at is null or o.claimed_at < now() - interval '5 minutes')
      and not public.in_quiet_hours(o.user_id)
    order by o.created_at
    limit greatest(1, least(p_limit, 500))
    for update skip locked
  )
  update public.notification_outbox o
  set claimed_at = now()
  from picked
  where o.id = picked.id
  returning o.id, o.user_id, o.key, o.title, o.body, o.data;
$$;
revoke execute on function public.claim_pending_notifications(integer) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 4. Zona kohore e prindit
-- ---------------------------------------------------------------------
alter table public.notification_settings add column if not exists timezone text;

create or replace function public.in_quiet_hours(p_user uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select coalesce(
    (
      select case
        when s.quiet_from = s.quiet_to then false
        when s.quiet_from < s.quiet_to then h >= s.quiet_from and h < s.quiet_to
        else h >= s.quiet_from or h < s.quiet_to
      end
      from public.notification_settings s,
           lateral (
             select extract(hour from now() at time zone coalesce(
               (select name from pg_timezone_names where name = s.timezone), 'Europe/Belgrade'))::int as h
           ) t
      where s.user_id = p_user
    ),
    (select h >= 22 or h < 7 from (select extract(hour from now() at time zone 'Europe/Belgrade')::int as h) d)
  );
$$;

-- ---------------------------------------------------------------------
-- 5. Njoftimet e postimit: një INSERT ... SELECT, jo një thirrje për ndjekës
-- ---------------------------------------------------------------------
create or replace function public.notify_on_post()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  expert record;
  group_name text;
begin
  select e.id, e.name into expert from public.community_experts e where e.user_id = new.author_id limit 1;

  if expert.id is not null then
    insert into public.notification_outbox (user_id, key, title, body, data, dedupe_key)
    select f.user_id, 'community_expert_post', expert.name || ' postoi diçka',
           coalesce(nullif(left(new.text, 80), ''), 'Shiko postimin e ri.'),
           jsonb_build_object('postId', new.id, 'expertId', expert.id),
           'post:' || new.id
    from public.community_expert_follows f
    where f.expert_id = expert.id and f.user_id <> new.author_id
      and public.notification_allowed(f.user_id, 'community_expert_post')
    on conflict do nothing;
  end if;

  if new.group_id is not null then
    select name into group_name from public.community_groups where id = new.group_id;
    insert into public.notification_outbox (user_id, key, title, body, data, dedupe_key)
    select m.user_id, 'community_group_post', 'Postim i ri te ' || coalesce(group_name, 'grupi yt'),
           coalesce(new.author_name, 'Dikush') || ': ' || coalesce(nullif(left(new.text, 70), ''), 'shiko postimin'),
           jsonb_build_object('postId', new.id, 'groupId', new.group_id),
           'post:' || new.id
    from public.community_group_members m
    where m.group_id = new.group_id and m.user_id <> new.author_id
      and public.notification_allowed(m.user_id, 'community_group_post')
    on conflict do nothing;
  end if;

  return new;
end
$$;
