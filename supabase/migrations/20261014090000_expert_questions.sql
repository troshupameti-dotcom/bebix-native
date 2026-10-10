-- =====================================================================
-- "Pyet ekspertin": prindi i dërgon një pyetje private një eksperti të
-- verifikuar (community_experts.user_id) dhe merr përgjigje.
--
-- Privatësia:
--  - prindi lexon vetëm pyetjet e veta (RLS);
--  - ekspertët S'E LEXOJNË tabelën: radhën e marrin nga
--    expert_question_queue(), që kthen vetëm kategorinë, tekstin dhe kohën —
--    asnjëherë kush e pyeti;
--  - shkrimi bëhet vetëm me funksionet më poshtë (limiti 3 në javë, kush
--    përgjigjet, kur).
-- "Kalo": pyetja "merret" kur eksperti e hap (që dy ekspertë të mos
-- përgjigjen njëherësh; skadon pas 30 minutash). "Kalo" e lëshon menjëherë
-- dhe s'ia tregon më atij eksperti.
-- Publikimi pa emër (zgjedhja e prindit): pas përgjigjes, serveri krijon një
-- postim në emër të EKSPERTIT me etiketën "Pyetje për ekspert" — pa asnjë
-- të dhënë të prindit.
-- Pa njoftime push.
--
-- PA EKZEKUTUAR: ekzekutoje te Supabase → SQL Editor.
-- =====================================================================

create or replace function public.is_verified_expert()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.community_experts where user_id = (select auth.uid()));
$$;

revoke execute on function public.is_verified_expert() from public, anon;
grant execute on function public.is_verified_expert() to authenticated;

create table if not exists public.expert_questions (
  id                  uuid primary key default gen_random_uuid(),
  asker_id            uuid not null references auth.users(id) on delete cascade,
  category            text not null check (category in ('sleep', 'feeding', 'health', 'development', 'other')),
  body                text not null check (char_length(btrim(body)) between 20 and 600),
  status              text not null default 'pending' check (status in ('pending', 'claimed', 'answered')),
  publish_anonymously boolean not null default false,
  expert_id           uuid references auth.users(id) on delete set null,
  claimed_at          timestamptz,
  answer              text check (answer is null or char_length(btrim(answer)) between 1 and 1500),
  created_at          timestamptz not null default now(),
  answered_at         timestamptz,
  answer_read_at      timestamptz,
  published_post_id   uuid references public.community_posts(id) on delete set null
);

create index if not exists expert_questions_asker_idx on public.expert_questions (asker_id, created_at desc);
create index if not exists expert_questions_queue_idx on public.expert_questions (created_at) where status <> 'answered';

alter table public.expert_questions enable row level security;

-- Prindi: vetëm të vetat, vetëm lexim (shkrimi me funksionet).
drop policy if exists "expert_questions_asker_read" on public.expert_questions;
create policy "expert_questions_asker_read"
  on public.expert_questions for select to authenticated
  using (asker_id = (select auth.uid()));

drop policy if exists "expert_questions_admin_all" on public.expert_questions;
create policy "expert_questions_admin_all"
  on public.expert_questions for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- "Kalo": cili ekspert e kaloi cilën pyetje (që s'i del më).
create table if not exists public.expert_question_skips (
  question_id uuid not null references public.expert_questions(id) on delete cascade,
  expert_id   uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (question_id, expert_id)
);

alter table public.expert_question_skips enable row level security;
-- Pa politika: vetëm funksionet e prekin.

-- --- Prindi -------------------------------------------------------------

-- Dërgo pyetjen. Më së shumti 3 në 7 ditët e fundit.
create or replace function public.ask_expert(p_category text, p_body text, p_publish boolean default false)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := (select auth.uid());
  v_id uuid;
begin
  if v_me is null then
    raise exception 'not_authenticated';
  end if;
  if (select count(*) from public.expert_questions where asker_id = v_me and created_at > now() - interval '7 days') >= 3 then
    raise exception 'weekly_limit';
  end if;
  insert into public.expert_questions (asker_id, category, body, publish_anonymously)
  values (v_me, p_category, btrim(p_body), coalesce(p_publish, false))
  returning id into v_id;
  return v_id;
end;
$$;

revoke execute on function public.ask_expert(text, text, boolean) from public, anon;
grant execute on function public.ask_expert(text, text, boolean) to authenticated;

-- Përgjigjet e palexuara u shënohen si të lexuara (hapja e "Pyetjet e mia").
create or replace function public.mark_expert_answers_read()
returns void
language sql
security definer
set search_path = public
as $$
  update public.expert_questions
  set answer_read_at = now()
  where asker_id = (select auth.uid()) and status = 'answered' and answer_read_at is null;
$$;

revoke execute on function public.mark_expert_answers_read() from public, anon;
grant execute on function public.mark_expert_answers_read() to authenticated;

-- --- Eksperti -----------------------------------------------------------

-- Radha: në pritje (ose të marra që kanë skaduar, ose të marra nga unë), më të
-- vjetrat para. PA asker_id. Pyetjet e mia si prind s'më dalin.
create or replace function public.expert_question_queue()
returns table (id uuid, category text, body text, created_at timestamptz, claimed_by_me boolean)
language sql
stable
security definer
set search_path = public
as $$
  select q.id, q.category, q.body, q.created_at, (q.status = 'claimed' and q.expert_id = (select auth.uid()))
  from public.expert_questions q
  where public.is_verified_expert()
    and q.asker_id <> (select auth.uid())
    and (
      q.status = 'pending'
      or (q.status = 'claimed' and (q.expert_id = (select auth.uid()) or q.claimed_at < now() - interval '30 minutes'))
    )
    and not exists (select 1 from public.expert_question_skips s where s.question_id = q.id and s.expert_id = (select auth.uid()))
  order by q.created_at asc
  limit 100;
$$;

revoke execute on function public.expert_question_queue() from public, anon;
grant execute on function public.expert_question_queue() to authenticated;

-- Merre pyetjen (kur eksperti e hap). false = e mori dikush tjetër.
create or replace function public.claim_expert_question(p_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := (select auth.uid());
begin
  if not public.is_verified_expert() then
    raise exception 'not_an_expert';
  end if;
  update public.expert_questions
  set status = 'claimed', expert_id = v_me, claimed_at = now()
  where id = p_id
    and asker_id <> v_me
    and (status = 'pending' or (status = 'claimed' and (expert_id = v_me or claimed_at < now() - interval '30 minutes')));
  return found;
end;
$$;

revoke execute on function public.claim_expert_question(uuid) from public, anon;
grant execute on function public.claim_expert_question(uuid) to authenticated;

-- "Kalo": e kthen në radhë për të tjerët dhe s'ia tregon më këtij eksperti.
create or replace function public.skip_expert_question(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := (select auth.uid());
begin
  if not public.is_verified_expert() then
    raise exception 'not_an_expert';
  end if;
  update public.expert_questions
  set status = 'pending', expert_id = null, claimed_at = null
  where id = p_id and status = 'claimed' and expert_id = v_me;
  insert into public.expert_question_skips (question_id, expert_id) values (p_id, v_me)
  on conflict do nothing;
end;
$$;

revoke execute on function public.skip_expert_question(uuid) from public, anon;
grant execute on function public.skip_expert_question(uuid) to authenticated;

-- Përgjigju. Kur prindi e ka zgjedhur, publikohet pa emër si postim i ekspertit.
create or replace function public.answer_expert_question(p_id uuid, p_answer text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := (select auth.uid());
  v_q public.expert_questions;
  v_answer text := btrim(coalesce(p_answer, ''));
  v_head text;
  v_text text;
  v_post uuid;
begin
  if not public.is_verified_expert() then
    raise exception 'not_an_expert';
  end if;
  if char_length(v_answer) < 1 or char_length(v_answer) > 1500 then
    raise exception 'bad_answer';
  end if;

  select * into v_q from public.expert_questions where id = p_id for update;
  if v_q.id is null or v_q.asker_id = v_me then
    raise exception 'not_found';
  end if;
  if v_q.status = 'answered' then
    raise exception 'already_answered';
  end if;
  if v_q.status = 'claimed' and v_q.expert_id <> v_me and v_q.claimed_at >= now() - interval '30 minutes' then
    raise exception 'claimed_by_other';
  end if;

  update public.expert_questions
  set status = 'answered', expert_id = v_me, answer = v_answer, answered_at = now(), claimed_at = coalesce(claimed_at, now())
  where id = p_id;

  if v_q.publish_anonymously then
    -- Postimi i ekspertit: pyetja + përgjigjja. Kufiri i postimeve është 2000:
    -- vetëm përgjigjja shkurtohet, me "…", kur kalon.
    v_head := '❓ ' || btrim(v_q.body) || E'\n\n' || '💬 ';
    v_text := v_head || v_answer;
    if char_length(v_text) > 2000 then
      v_text := v_head || left(v_answer, 2000 - char_length(v_head) - 1) || '…';
    end if;
    insert into public.community_posts (author_id, author_name, author_initial, kind, text, tag)
    values (v_me, '', '', 'question', v_text, 'Pyetje për ekspert')
    returning id into v_post;
    update public.expert_questions set published_post_id = v_post where id = p_id;
  end if;
end;
$$;

revoke execute on function public.answer_expert_question(uuid, text) from public, anon;
grant execute on function public.answer_expert_question(uuid, text) to authenticated;
