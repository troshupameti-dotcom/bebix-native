-- =====================================================================
-- Mesazhet private (inbox) dhe ndjekja mes prindërve.
--
--  - community_user_profiles: emri publik i çdo përdoruesi në Komunitet
--    (i njëjti rregull si te postimet: ekspertët me emrin e tyre, emrat e
--    ekspertëve të rezervuar). Lexohet nga të kyçurit.
--  - community_user_follows: kush ndjek kë. E sheh vetëm ai që ndjek dhe ai
--    që ndiqet; numrat jepen nga community_public_profile().
--  - dm_conversations + dm_messages: biseda mes dy vetëve. Mund të shkruajnë
--    vetëm kur NJËRI ndjek tjetrin (prind ose ekspert; s'duhet të dy) dhe
--    asnjëri s'e ka bllokuar tjetrin. Mesazhet ruhen si në çdo rrjet social;
--    dërguesi e fshin mesazhin e vet.
--  - Kufi kundër spam-it: 30 mesazhe në minutë për dërgues.
--  - Njoftimi: enqueue_notification(..., 'community_message', ...). Push-i
--    është i pauzuar; app-i tregon pikën te inbox-i.
--  - dm_messages hyn te supabase_realtime: mesazhet vijnë menjëherë (RLS vlen).
--
-- PA EKZEKUTUAR: ekzekutoje te Supabase → SQL Editor.
-- =====================================================================

begin;

-- --- Emri publik ------------------------------------------------------------
create table if not exists public.community_user_profiles (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 60),
  updated_at   timestamptz not null default now()
);

alter table public.community_user_profiles enable row level security;

drop policy if exists "community_user_profiles_read" on public.community_user_profiles;
create policy "community_user_profiles_read"
  on public.community_user_profiles for select to authenticated
  using (true);
-- Shkrimi vetëm me set_my_community_name().

create or replace function public.set_my_community_name(p_name text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := (select auth.uid());
  v_name text;
begin
  if v_me is null then
    raise exception 'not_authenticated';
  end if;
  v_name := public.community_author_name(v_me, p_name);
  insert into public.community_user_profiles (user_id, display_name, updated_at) values (v_me, v_name, now())
  on conflict (user_id) do update set display_name = excluded.display_name, updated_at = now()
  where public.community_user_profiles.display_name is distinct from excluded.display_name;
  return v_name;
end;
$$;

revoke execute on function public.set_my_community_name(text) from public, anon;
grant execute on function public.set_my_community_name(text) to authenticated;

-- Emri që shfaqet për një përdorues: eksperti me emrin e vet, pastaj emri publik, pastaj "Prind".
create or replace function public.community_display_name(p_user uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select e.name from public.community_experts e where e.user_id = p_user),
    (select p.display_name from public.community_user_profiles p where p.user_id = p_user),
    'Prind'
  );
$$;

revoke execute on function public.community_display_name(uuid) from public, anon, authenticated;

-- --- Ndjekja ----------------------------------------------------------------
create table if not exists public.community_user_follows (
  follower_id uuid not null references auth.users(id) on delete cascade,
  followee_id uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);

create index if not exists community_user_follows_followee_idx on public.community_user_follows (followee_id);

alter table public.community_user_follows enable row level security;

drop policy if exists "community_user_follows_read" on public.community_user_follows;
create policy "community_user_follows_read"
  on public.community_user_follows for select to authenticated
  using ((select auth.uid()) in (follower_id, followee_id));

drop policy if exists "community_user_follows_insert" on public.community_user_follows;
create policy "community_user_follows_insert"
  on public.community_user_follows for insert to authenticated
  with check (
    follower_id = (select auth.uid())
    and not exists (
      select 1 from public.community_blocks b
      where (b.blocker_id = follower_id and b.blocked_id = followee_id)
         or (b.blocker_id = followee_id and b.blocked_id = follower_id)
    )
  );

drop policy if exists "community_user_follows_delete" on public.community_user_follows;
create policy "community_user_follows_delete"
  on public.community_user_follows for delete to authenticated
  using (follower_id = (select auth.uid()));

-- Njëri ndjek tjetrin (si prind, ose si ekspert te community_expert_follows), dhe s'ka bllokim.
create or replace function public.dm_allowed(p_a uuid, p_b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_a is not null and p_b is not null and p_a <> p_b
    and not exists (
      select 1 from public.community_blocks b
      where (b.blocker_id = p_a and b.blocked_id = p_b) or (b.blocker_id = p_b and b.blocked_id = p_a)
    )
    and (
      exists (select 1 from public.community_user_follows f
              where (f.follower_id = p_a and f.followee_id = p_b) or (f.follower_id = p_b and f.followee_id = p_a))
      or exists (select 1 from public.community_expert_follows ef join public.community_experts e on e.id = ef.expert_id
                 where (ef.user_id = p_a and e.user_id = p_b) or (ef.user_id = p_b and e.user_id = p_a))
    );
$$;

revoke execute on function public.dm_allowed(uuid, uuid) from public, anon, authenticated;

-- Profili publik: emri, a është ekspert, numrat dhe çfarë mund të bëj unë.
create or replace function public.community_public_profile(p_user uuid)
returns table (
  user_id uuid, display_name text, expert_id uuid, followers integer, following integer,
  i_follow boolean, follows_me boolean, can_message boolean, blocked boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select p_user,
    public.community_display_name(p_user),
    (select e.id from public.community_experts e where e.user_id = p_user),
    (select count(*)::int from public.community_user_follows f where f.followee_id = p_user),
    (select count(*)::int from public.community_user_follows f where f.follower_id = p_user),
    exists (select 1 from public.community_user_follows f where f.follower_id = (select auth.uid()) and f.followee_id = p_user),
    exists (select 1 from public.community_user_follows f where f.follower_id = p_user and f.followee_id = (select auth.uid())),
    public.dm_allowed((select auth.uid()), p_user),
    exists (select 1 from public.community_blocks b where b.blocker_id = (select auth.uid()) and b.blocked_id = p_user)
  where (select auth.uid()) is not null;
$$;

revoke execute on function public.community_public_profile(uuid) from public, anon;
grant execute on function public.community_public_profile(uuid) to authenticated;

-- --- Bisedat ----------------------------------------------------------------
create table if not exists public.dm_conversations (
  id                   uuid primary key default gen_random_uuid(),
  user_a               uuid not null references auth.users(id) on delete cascade,
  user_b               uuid not null references auth.users(id) on delete cascade,
  created_at           timestamptz not null default now(),
  last_message_at      timestamptz,
  last_message_preview text,
  last_sender          uuid,
  a_last_read          timestamptz,
  b_last_read          timestamptz,
  unique (user_a, user_b),
  check (user_a < user_b)
);

create index if not exists dm_conversations_a_idx on public.dm_conversations (user_a, last_message_at desc);
create index if not exists dm_conversations_b_idx on public.dm_conversations (user_b, last_message_at desc);

alter table public.dm_conversations enable row level security;

drop policy if exists "dm_conversations_member_read" on public.dm_conversations;
create policy "dm_conversations_member_read"
  on public.dm_conversations for select to authenticated
  using ((select auth.uid()) in (user_a, user_b));
-- S'ka INSERT/UPDATE nga klienti: start_conversation() dhe trigger-i i mesazheve.

create table if not exists public.dm_messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.dm_conversations(id) on delete cascade,
  sender_id       uuid not null references auth.users(id) on delete cascade,
  kind            text not null default 'text' check (kind in ('text', 'screenshot')),
  body            text not null default '',
  created_at      timestamptz not null default now(),
  check ((kind = 'text' and char_length(btrim(body)) between 1 and 2000) or (kind = 'screenshot' and body = ''))
);

create index if not exists dm_messages_conversation_idx on public.dm_messages (conversation_id, created_at desc);
create index if not exists dm_messages_sender_idx on public.dm_messages (sender_id, created_at desc);

alter table public.dm_messages enable row level security;

-- Anëtar i bisedës (funksion që lexon pa RLS, që politika të mos thërrasë veten).
create or replace function public.dm_is_member(p_conversation uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.dm_conversations c where c.id = p_conversation and (select auth.uid()) in (c.user_a, c.user_b));
$$;

revoke execute on function public.dm_is_member(uuid) from public, anon;
grant execute on function public.dm_is_member(uuid) to authenticated;

create or replace function public.dm_can_send(p_conversation uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.dm_conversations c
    where c.id = p_conversation
      and (select auth.uid()) in (c.user_a, c.user_b)
      and public.dm_allowed(c.user_a, c.user_b)
  );
$$;

revoke execute on function public.dm_can_send(uuid) from public, anon;
grant execute on function public.dm_can_send(uuid) to authenticated;

drop policy if exists "dm_messages_member_read" on public.dm_messages;
create policy "dm_messages_member_read"
  on public.dm_messages for select to authenticated
  using (public.dm_is_member(conversation_id));

drop policy if exists "dm_messages_send" on public.dm_messages;
create policy "dm_messages_send"
  on public.dm_messages for insert to authenticated
  with check (sender_id = (select auth.uid()) and public.dm_can_send(conversation_id));

drop policy if exists "dm_messages_delete_own" on public.dm_messages;
create policy "dm_messages_delete_own"
  on public.dm_messages for delete to authenticated
  using (sender_id = (select auth.uid()));

-- Nis (ose gjej) bisedën me dikë. Gabim kur s'lejohet (s'ndiqet asnjëri, ose ka bllokim).
create or replace function public.start_conversation(p_other uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := (select auth.uid());
  v_a uuid := least(v_me, p_other);
  v_b uuid := greatest(v_me, p_other);
  v_id uuid;
begin
  if v_me is null then
    raise exception 'not_authenticated';
  end if;
  if not public.dm_allowed(v_me, p_other) then
    raise exception 'dm_not_allowed';
  end if;
  insert into public.dm_conversations (user_a, user_b) values (v_a, v_b)
  on conflict (user_a, user_b) do nothing;
  select id into v_id from public.dm_conversations where user_a = v_a and user_b = v_b;
  return v_id;
end;
$$;

revoke execute on function public.start_conversation(uuid) from public, anon;
grant execute on function public.start_conversation(uuid) to authenticated;

-- Inbox-i: bisedat e mia, më e reja para, me emrin e tjetrit dhe a ka të palexuara.
create or replace function public.dm_inbox()
returns table (
  id uuid, other_id uuid, other_name text, other_is_expert boolean,
  last_message_at timestamptz, last_message_preview text, last_from_me boolean, unread boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select c.id,
    case when c.user_a = (select auth.uid()) then c.user_b else c.user_a end as other_id,
    public.community_display_name(case when c.user_a = (select auth.uid()) then c.user_b else c.user_a end),
    exists (select 1 from public.community_experts e where e.user_id = case when c.user_a = (select auth.uid()) then c.user_b else c.user_a end),
    c.last_message_at,
    c.last_message_preview,
    c.last_sender = (select auth.uid()),
    c.last_message_at is not null
      and c.last_sender is distinct from (select auth.uid())
      and c.last_message_at > coalesce(case when c.user_a = (select auth.uid()) then c.a_last_read else c.b_last_read end, '-infinity'::timestamptz)
  from public.dm_conversations c
  where (select auth.uid()) in (c.user_a, c.user_b)
    and c.last_message_at is not null
    and not exists (
      select 1 from public.community_blocks b
      where b.blocker_id = (select auth.uid())
        and b.blocked_id = case when c.user_a = (select auth.uid()) then c.user_b else c.user_a end
    )
  order by c.last_message_at desc
  limit 200;
$$;

revoke execute on function public.dm_inbox() from public, anon;
grant execute on function public.dm_inbox() to authenticated;

-- E lexova bisedën (hapja e saj).
create or replace function public.mark_conversation_read(p_conversation uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.dm_conversations c
  set a_last_read = case when c.user_a = (select auth.uid()) then now() else c.a_last_read end,
      b_last_read = case when c.user_b = (select auth.uid()) then now() else c.b_last_read end
  where c.id = p_conversation and (select auth.uid()) in (c.user_a, c.user_b);
$$;

revoke execute on function public.mark_conversation_read(uuid) from public, anon;
grant execute on function public.mark_conversation_read(uuid) to authenticated;

-- Pas çdo mesazhi: kufiri kundër spam-it, mesazhi i fundit te biseda, njoftimi.
create or replace function public.dm_messages_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.created_at := now();
  new.body := btrim(new.body);
  if (select count(*) from public.dm_messages m where m.sender_id = new.sender_id and m.created_at > now() - interval '1 minute') >= 30 then
    raise exception 'dm_rate_limit';
  end if;
  return new;
end;
$$;

revoke execute on function public.dm_messages_before_insert() from public, anon, authenticated;

drop trigger if exists dm_messages_before_insert on public.dm_messages;
create trigger dm_messages_before_insert before insert on public.dm_messages
  for each row execute function public.dm_messages_before_insert();

create or replace function public.dm_messages_after_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_c public.dm_conversations;
  v_other uuid;
  v_name text;
  v_preview text;
begin
  select * into v_c from public.dm_conversations where id = new.conversation_id;
  v_other := case when v_c.user_a = new.sender_id then v_c.user_b else v_c.user_a end;
  v_preview := case when new.kind = 'screenshot' then '📸' else left(new.body, 80) end;

  update public.dm_conversations
  set last_message_at = new.created_at, last_message_preview = v_preview, last_sender = new.sender_id,
      a_last_read = case when user_a = new.sender_id then new.created_at else a_last_read end,
      b_last_read = case when user_b = new.sender_id then new.created_at else b_last_read end
  where id = new.conversation_id;

  if new.kind = 'text' then
    v_name := public.community_display_name(new.sender_id);
    perform public.enqueue_notification(
      v_other, 'community_message', v_name, v_preview,
      jsonb_build_object('type', 'message', 'conversationId', new.conversation_id),
      'dm:' || new.conversation_id::text || ':' || to_char(new.created_at, 'YYYYMMDDHH24MI'),
      now(), now() + interval '1 day'
    );
  end if;
  return new;
end;
$$;

revoke execute on function public.dm_messages_after_insert() from public, anon, authenticated;

drop trigger if exists dm_messages_after_insert on public.dm_messages;
create trigger dm_messages_after_insert after insert on public.dm_messages
  for each row execute function public.dm_messages_after_insert();

-- Mesazhet menjëherë (Realtime respekton RLS-në).
do $$
begin
  alter publication supabase_realtime add table public.dm_messages;
exception
  when duplicate_object then null;
  when undefined_object then null;
end;
$$;

commit;
