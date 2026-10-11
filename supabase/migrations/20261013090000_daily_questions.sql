-- =====================================================================
-- "Pyetja e ditës" te Komuniteti: një pyetje e redaksisë në ditë; prindërit
-- përgjigjen me 1–2 fjali.
--
-- Modeli: çdo pyetje ka një "postim bazë" (community_posts) nga llogaria
-- editoriale e Bebix-it, dhe përgjigjet janë KOMENTET e atij postimi. Kështu
-- ripërdoren raportimi, bllokimi, numëruesit dhe njoftimet e komenteve.
--
--  - community_daily_questions: pyetjet sipas datës (Europe/Belgrade). Lexim
--    publik për ditët që kanë ardhur; shkrim vetëm nga admini.
--  - community_daily_editorial: cila llogari e publikon postimin bazë.
--    E cakton admini një herë:  select public.set_daily_editorial('<uuid>');
--  - today_daily_question(): pyetja e sotme; postimin bazë e krijon herën e
--    parë që dikush e hap (jo kur futen pyetjet, që 30 pyetjet fillestare të
--    mos bëhen 30 postime njëherësh).
--  - Një përgjigje (koment i parë) për prind për pyetje, 1–280 shkronja, e
--    kontrolluar në bazë. Përgjigjet ndaj përgjigjeve mbeten si komentet e
--    zakonshme (1–1000). Ndryshimi: edit_daily_answer() (komentet s'kanë UPDATE).
--  - community_feed merr kolonën is_daily_question: app-i e fsheh postimin
--    bazë nga rrjedha (karta është hyrja), por thread-i hapet normalisht.
--
-- Pyetjet fillestare janë te skedari tjetër: 20261013090100_daily_questions_seed.sql.
-- PA EKZEKUTUAR: ekzekutoje te Supabase → SQL Editor.
-- =====================================================================

begin;

-- --- Dita e Komunitetit ---------------------------------------------------
create or replace function public.daily_question_today()
returns date
language sql
stable
set search_path = public
as $$
  select (now() at time zone 'Europe/Belgrade')::date;
$$;

grant execute on function public.daily_question_today() to anon, authenticated;

-- --- Pyetjet ----------------------------------------------------------------
create table if not exists public.community_daily_questions (
  id          uuid primary key default gen_random_uuid(),
  text        text not null check (char_length(btrim(text)) between 5 and 200),
  text_en     text check (text_en is null or char_length(btrim(text_en)) between 5 and 200),
  active_date date not null unique,
  post_id     uuid unique references public.community_posts(id) on delete set null,
  created_at  timestamptz not null default now()
);

alter table public.community_daily_questions enable row level security;

drop policy if exists "community_daily_questions_read" on public.community_daily_questions;
create policy "community_daily_questions_read"
  on public.community_daily_questions for select to anon, authenticated
  using (active_date <= public.daily_question_today() or (select public.is_admin()));

drop policy if exists "community_daily_questions_admin" on public.community_daily_questions;
create policy "community_daily_questions_admin"
  on public.community_daily_questions for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- --- Llogaria editoriale ----------------------------------------------------
create table if not exists public.community_daily_editorial (
  singleton  boolean primary key default true check (singleton),
  user_id    uuid not null references auth.users(id) on delete cascade,
  updated_at timestamptz not null default now()
);

alter table public.community_daily_editorial enable row level security;

drop policy if exists "community_daily_editorial_admin" on public.community_daily_editorial;
create policy "community_daily_editorial_admin"
  on public.community_daily_editorial for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- Cakto llogarinë editoriale (vetëm admini, ose nga SQL Editor). Fik njoftimet
-- "Koment i ri" për të: përndryshe çdo përgjigje do t'i dërgonte një njoftim.
create or replace function public.set_daily_editorial(p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select auth.uid()) is not null and not public.is_admin() then
    raise exception 'not_admin';
  end if;
  if not exists (select 1 from auth.users where id = p_user) then
    raise exception 'unknown_user';
  end if;
  insert into public.community_daily_editorial (singleton, user_id, updated_at) values (true, p_user, now())
  on conflict (singleton) do update set user_id = excluded.user_id, updated_at = now();
  insert into public.notification_settings (user_id, prefs) values (p_user, '{"community_comment": false}'::jsonb)
  on conflict (user_id) do update set prefs = public.notification_settings.prefs || '{"community_comment": false}'::jsonb, updated_at = now();
end;
$$;

revoke execute on function public.set_daily_editorial(uuid) from public, anon;
grant execute on function public.set_daily_editorial(uuid) to authenticated;

-- --- Pyetja e sotme ---------------------------------------------------------
-- Kthen pyetjen e sotme me postimin bazë (e krijon herën e parë) dhe numrin e
-- përgjigjeve (komentet e para). Pa pyetje për sot ose pa llogari editoriale:
-- asnjë rresht (karta s'shfaqet).
create or replace function public.today_daily_question()
returns table (id uuid, text text, text_en text, active_date date, post_id uuid, answer_count integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_q public.community_daily_questions;
  v_editor uuid;
  v_post uuid;
begin
  select * into v_q from public.community_daily_questions q where q.active_date = public.daily_question_today();
  if v_q.id is null then
    return;
  end if;

  if v_q.post_id is null then
    select e.user_id into v_editor from public.community_daily_editorial e where e.singleton;
    if v_editor is null then
      return;
    end if;
    -- Një postim i vetëm edhe kur dy prindër e hapin njëkohësisht.
    select * into v_q from public.community_daily_questions q where q.id = v_q.id for update;
    if v_q.post_id is null then
      insert into public.community_posts (author_id, author_name, author_initial, kind, text, tag)
      values (v_editor, 'Bebix', 'B', 'question', btrim(v_q.text), 'Pyetja e ditës')
      returning community_posts.id into v_post;
      update public.community_daily_questions set post_id = v_post where community_daily_questions.id = v_q.id;
      v_q.post_id := v_post;
    end if;
  end if;

  return query
    select v_q.id, v_q.text, v_q.text_en, v_q.active_date, v_q.post_id,
           (select count(*)::int from public.community_comments c where c.post_id = v_q.post_id and c.parent_id is null);
end;
$$;

revoke execute on function public.today_daily_question() from public, anon;
grant execute on function public.today_daily_question() to authenticated;

-- --- Përgjigjet: një për prind, 1–280 ----------------------------------------
create or replace function public.daily_answer_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.parent_id is not null then
    return new;
  end if;
  if not exists (select 1 from public.community_daily_questions d where d.post_id = new.post_id) then
    return new;
  end if;
  if char_length(btrim(new.text)) < 1 or char_length(btrim(new.text)) > 280 then
    raise exception 'daily_answer_length';
  end if;
  -- Kyçi i prindit për këtë pyetje: dy dërgime njëkohësisht s'bëjnë dy përgjigje.
  perform pg_advisory_xact_lock(hashtext('daily_answer:' || new.post_id::text || ':' || new.author_id::text));
  if exists (select 1 from public.community_comments c where c.post_id = new.post_id and c.author_id = new.author_id and c.parent_id is null) then
    raise exception 'daily_answer_exists';
  end if;
  return new;
end;
$$;

revoke execute on function public.daily_answer_guard() from public, anon, authenticated;

drop trigger if exists community_comments_daily_answer on public.community_comments;
create trigger community_comments_daily_answer before insert on public.community_comments
  for each row execute function public.daily_answer_guard();

-- Ndrysho përgjigjen time (vetëm komenti i parë te një pyetje e ditës).
create or replace function public.edit_daily_answer(p_comment uuid, p_text text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_text text := btrim(regexp_replace(coalesce(p_text, ''), '\s+', ' ', 'g'));
begin
  if char_length(v_text) < 1 or char_length(v_text) > 280 then
    raise exception 'daily_answer_length';
  end if;
  update public.community_comments c
  set text = v_text
  where c.id = p_comment
    and c.author_id = (select auth.uid())
    and c.parent_id is null
    and exists (select 1 from public.community_daily_questions d where d.post_id = c.post_id);
  if not found then
    raise exception 'not_found';
  end if;
end;
$$;

revoke execute on function public.edit_daily_answer(uuid, text) from public, anon;
grant execute on function public.edit_daily_answer(uuid, text) to authenticated;

-- --- Rrjedha: kolona is_daily_question (e njëjta pamje + një kolonë në fund) ---
create or replace view public.community_feed with (security_invoker = true) as
 select p.id,
    p.author_id,
    p.author_name,
    p.author_initial,
    p.author_is_expert,
    p.accent,
    p.kind,
    p.text,
    p.tag,
    p.icon,
    p.group_id,
    g.name as group_name,
    p.created_at,
    p.updated_at,
    p.like_count::bigint as like_count,
    p.comment_count::bigint as comment_count,
    p.media,
    (select e.specialty_key from public.community_experts e where e.user_id = p.author_id) as author_specialty,
    exists (select 1 from public.community_daily_questions d where d.post_id = p.id) as is_daily_question
   from public.community_posts p
     left join public.community_groups g on g.id = p.group_id
  where not (exists (select 1 from public.community_blocks b
          where b.blocker_id = (select auth.uid()) and b.blocked_id = p.author_id))
    and (p.author_id = (select auth.uid()) or p.open_report_count < 3);

commit;
