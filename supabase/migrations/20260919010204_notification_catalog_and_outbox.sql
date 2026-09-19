-- =====================================================================
-- Katalogu i njoftimeve dhe radha e dergimit.
--
-- Deri tani cilesimet ishin dy fusha (vaksina, porosia) dhe ekrani i
-- cilesimeve premtonte gjera qe s'dergoheshin fare: email, SMS, raporte
-- javore, "emergency alerts". Tani cdo celes ka nje dergues te vertete.
--
-- Nje rruge e vetme dergimi: triggerat dhe kujtesat SHKRUAJNE ne radhe,
-- dhe nje funksion i vetem e zbraz ate. Pa kete, nje postim i nje eksperti
-- me 500 ndjekes do te thoshte 500 thirrje HTTP nga nje trigger.
--
-- APLIKUAR TASHME ne projekt (version 20260919010204).
-- =====================================================================

alter table public.notification_settings
  add column if not exists prefs jsonb not null default '{}'::jsonb,
  -- Oret e qeta: 22:00-07:00 si parazgjedhje. Njoftimi nuk humbet, pret.
  add column if not exists quiet_from smallint not null default 22,
  add column if not exists quiet_to   smallint not null default 7;

update public.notification_settings
set prefs = jsonb_build_object('baby_vaccine', vaccine_reminders, 'shop_order', order_updates)
where prefs = '{}'::jsonb;

alter table public.notification_settings drop column if exists vaccine_reminders;
alter table public.notification_settings drop column if exists order_updates;

-- Marketingu eshte i fikur derisa perdoruesi ta ndezi vete.
create or replace function public.notification_default(p_key text)
returns boolean language sql immutable as $$
  select case when p_key in ('shop_offers') then false else true end;
$$;

create or replace function public.notification_allowed(p_user uuid, p_key text)
returns boolean language sql stable security definer set search_path = public as $$
  select case
    when coalesce((s.prefs->>'push')::boolean, true) is false then false
    else coalesce((s.prefs->>p_key)::boolean, public.notification_default(p_key))
  end
  from (select prefs from public.notification_settings where user_id = p_user) s
  union all
  select public.notification_default(p_key)
  where not exists (select 1 from public.notification_settings where user_id = p_user)
  limit 1;
$$;

create or replace function public.in_quiet_hours(p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (
      select case
        when s.quiet_from = s.quiet_to then false
        when s.quiet_from < s.quiet_to then h >= s.quiet_from and h < s.quiet_to
        else h >= s.quiet_from or h < s.quiet_to
      end
      from public.notification_settings s,
           lateral (select extract(hour from now() at time zone 'Europe/Belgrade')::int as h) t
      where s.user_id = p_user
    ),
    (select h >= 22 or h < 7 from (select extract(hour from now() at time zone 'Europe/Belgrade')::int as h) d)
  );
$$;

create table if not exists public.notification_outbox (
  id          bigserial primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  key         text not null,
  title       text not null,
  body        text not null,
  data        jsonb not null default '{}'::jsonb,
  dedupe_key  text,
  send_after  timestamptz not null default now(),
  created_at  timestamptz not null default now(),
  sent_at     timestamptz,
  attempts    smallint not null default 0,
  error       text
);

create unique index if not exists notification_outbox_dedupe_idx
  on public.notification_outbox (user_id, dedupe_key) where dedupe_key is not null;
create index if not exists notification_outbox_pending_idx
  on public.notification_outbox (send_after) where sent_at is null;

-- Pa politika me qellim: vetem service_role e prek.
alter table public.notification_outbox enable row level security;

create or replace function public.enqueue_notification(
  p_user uuid, p_key text, p_title text, p_body text,
  p_data jsonb default '{}'::jsonb, p_dedupe text default null,
  p_send_after timestamptz default now()
)
returns void language plpgsql security definer set search_path = public as $fn$
begin
  if p_user is null then return; end if;
  -- Filtri i cilesimeve behet ketu: nje njoftim i padeshiruar nuk hyn fare
  -- ne radhe, qe te mos mbetet aty si mbeturine.
  if not public.notification_allowed(p_user, p_key) then return; end if;

  insert into public.notification_outbox (user_id, key, title, body, data, dedupe_key, send_after)
  values (p_user, p_key, p_title, p_body, coalesce(p_data, '{}'::jsonb), p_dedupe, coalesce(p_send_after, now()))
  on conflict do nothing;
end
$fn$;

-- --- Komuniteti -------------------------------------------------------
create or replace function public.notify_on_comment()
returns trigger language plpgsql security definer set search_path = public as $fn$
declare
  post_author uuid;
  post_text   text;
  parent_author uuid;
  who text := coalesce(new.author_name, 'Dikush');
begin
  select author_id, left(text, 60) into post_author, post_text
  from public.community_posts where id = new.post_id;

  if new.parent_id is not null then
    select author_id into parent_author from public.community_comments where id = new.parent_id;
    if parent_author is not null and parent_author <> new.author_id then
      perform public.enqueue_notification(
        parent_author, 'community_reply', 'Përgjigje për ty',
        who || ' iu përgjigj komentit tënd.',
        jsonb_build_object('postId', new.post_id, 'commentId', new.id));
    end if;
  end if;

  if post_author is not null and post_author <> new.author_id and post_author is distinct from parent_author then
    perform public.enqueue_notification(
      post_author, 'community_comment', 'Koment i ri',
      who || ' komentoi te postimi yt.',
      jsonb_build_object('postId', new.post_id, 'commentId', new.id));
  end if;

  return new;
end
$fn$;

drop trigger if exists community_comments_notify on public.community_comments;
create trigger community_comments_notify
  after insert on public.community_comments
  for each row execute function public.notify_on_comment();

create or replace function public.notify_on_like()
returns trigger language plpgsql security definer set search_path = public as $fn$
declare post_author uuid;
begin
  select author_id into post_author from public.community_posts where id = new.post_id;
  if post_author is null or post_author = new.user_id then return new; end if;

  perform public.enqueue_notification(
    post_author, 'community_like', 'Postimi yt ndihmoi',
    'Dikush shënoi "M''ndihmoi" te postimi yt.',
    jsonb_build_object('postId', new.post_id),
    -- Nje njoftim per postim ne dite: perndryshe dhjete pelqime =
    -- dhjete njoftime, dhe njerezit i fikin te gjitha.
    'like:' || new.post_id || ':' || to_char(now() at time zone 'Europe/Belgrade', 'YYYY-MM-DD'));
  return new;
end
$fn$;

drop trigger if exists community_likes_notify on public.community_post_likes;
create trigger community_likes_notify
  after insert on public.community_post_likes
  for each row execute function public.notify_on_like();

create or replace function public.notify_on_post()
returns trigger language plpgsql security definer set search_path = public as $fn$
declare
  expert record; follower record; member record; group_name text;
begin
  select e.id, e.name, e.kind into expert
  from public.community_experts e where e.user_id = new.author_id limit 1;

  if expert.id is not null then
    for follower in select f.user_id from public.community_expert_follows f where f.expert_id = expert.id loop
      if follower.user_id <> new.author_id then
        perform public.enqueue_notification(
          follower.user_id, 'community_expert_post',
          expert.name || ' postoi diçka',
          coalesce(nullif(left(new.text, 80), ''), 'Shiko postimin e ri.'),
          jsonb_build_object('postId', new.id, 'expertId', expert.id));
      end if;
    end loop;
  end if;

  if new.group_id is not null then
    select name into group_name from public.community_groups where id = new.group_id;
    for member in select m.user_id from public.community_group_members m where m.group_id = new.group_id loop
      if member.user_id <> new.author_id then
        perform public.enqueue_notification(
          member.user_id, 'community_group_post',
          'Postim i ri te ' || coalesce(group_name, 'grupi yt'),
          coalesce(new.author_name, 'Dikush') || ': ' || coalesce(nullif(left(new.text, 70), ''), 'shiko postimin'),
          jsonb_build_object('postId', new.id, 'groupId', new.group_id));
      end if;
    end loop;
  end if;

  return new;
end
$fn$;

drop trigger if exists community_posts_notify on public.community_posts;
create trigger community_posts_notify
  after insert on public.community_posts
  for each row execute function public.notify_on_post();

-- --- Dyqani: statusi kalon te radha, jo me thirrje HTTP nga triggeri ---
create or replace function public.notify_customer_order_status()
returns trigger language plpgsql security definer set search_path = public as $fn$
declare
  ref text := '#' || upper(left(new.id::text, 8));
  title text; body text;
begin
  if new.status is not distinct from old.status or new.user_id is null then
    return new;
  end if;

  select * into title, body from (values
    ('confirmed', 'Porosia u konfirmua', 'Porosia ' || ref || ' u konfirmua dhe po përgatitet.'),
    ('shipped',   'Porosia është nisur', 'Porosia ' || ref || ' është nisur. Paguan kur ta marrësh.'),
    ('delivered', 'Porosia u dorëzua',   'Porosia ' || ref || ' u dorëzua. Faleminderit!'),
    ('cancelled', 'Porosia u anulua',    'Porosia ' || ref || ' u anulua. Na shkruaj nëse nuk e prisje këtë.')
  ) as m(st, t, b) where m.st = new.status;

  if title is not null then
    perform public.enqueue_notification(
      new.user_id, 'shop_order', title, body,
      jsonb_build_object('orderId', new.id),
      'order:' || new.id || ':' || new.status);
  end if;

  -- Pas dorezimit, nje kerkese e vetme per vleresim — nje dite me vone,
  -- qe prindi ta kete provuar vertet produktin.
  if new.status = 'delivered' then
    perform public.enqueue_notification(
      new.user_id, 'shop_review_request', 'Si ishte?',
      'Shkruaj dy fjalë për atë që more — prindërit e tjerë vendosin duke lexuar përvoja të vërteta.',
      jsonb_build_object('orderId', new.id), 'review:' || new.id, now() + interval '1 day');
  end if;

  return new;
end
$fn$;

revoke execute on function public.notify_on_comment() from public, anon, authenticated;
revoke execute on function public.notify_on_like() from public, anon, authenticated;
revoke execute on function public.notify_on_post() from public, anon, authenticated;
revoke execute on function public.notify_customer_order_status() from public, anon, authenticated;
revoke execute on function public.enqueue_notification(uuid, text, text, text, jsonb, text, timestamptz) from public, anon, authenticated;
revoke execute on function public.notification_allowed(uuid, text) from public, anon;
revoke execute on function public.in_quiet_hours(uuid) from public, anon, authenticated;
revoke execute on function public.notification_default(text) from public, anon, authenticated;
