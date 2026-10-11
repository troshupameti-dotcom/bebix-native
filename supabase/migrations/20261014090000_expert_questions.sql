-- =====================================================================
-- "Pyet ekspertin": prindi i dërgon një pyetje PRIVATE një eksperti të
-- verifikuar sipas repartit (community_specialties) dhe merr përgjigje.
-- Asgjë s'publikohet në feed.
--
-- Privatësia:
--  - prindi lexon dhe fshin vetëm pyetjet e veta (RLS);
--  - ekspertët S'E LEXOJNË tabelën: radhën e marrin nga list_expert_inbox(),
--    që kthen vetëm repartin, tekstin, moshën e bebit në muaj (kur prindi e
--    ndan) dhe kohën — asnjëherë asker_id, emër apo foto;
--  - shkrimi i fushave të ekspertit bëhet vetëm me funksionet më poshtë.
-- Limiti: 3 pyetje në 7 ditë, në bazë. Llogaritet nga expert_question_asks
-- (vetëm ora e dërgimit), që fshirja e një pyetjeje të mos e rihapë limitin.
-- Një përgjigje për pyetje: eksperti e "merr" kur e hap (30 min), dhe
-- përgjigjja kontrollohet me `for update` — dy ekspertë s'përgjigjen dot
-- njëkohësisht. "Kalo" e kthen në radhë dhe s'ia tregon më atij eksperti.
-- Njoftimi: enqueue_notification(..., 'community_expert_answer', ...). Push-i
-- është i pauzuar; app-i e tregon përgjigjen e palexuar edhe te Njoftimet.
--
-- PA EKZEKUTUAR: ekzekutoje te Supabase → SQL Editor.
-- =====================================================================

begin;

-- --- Eksperti i verifikuar dhe reparti i tij ------------------------------
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

create or replace function public.my_expert_specialty()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select specialty_key from public.community_experts where user_id = (select auth.uid());
$$;

revoke execute on function public.my_expert_specialty() from public, anon;
grant execute on function public.my_expert_specialty() to authenticated;

-- --- Tabelat ----------------------------------------------------------------
create table if not exists public.expert_questions (
  id              uuid primary key default gen_random_uuid(),
  asker_id        uuid not null references auth.users(id) on delete cascade,
  specialty_key   text not null references public.community_specialties(key) on update cascade,
  body            text not null check (char_length(btrim(body)) between 20 and 600),
  baby_age_months smallint check (baby_age_months is null or baby_age_months between 0 and 240),
  status          text not null default 'pending' check (status in ('pending', 'claimed', 'answered', 'closed')),
  expert_id       uuid references auth.users(id) on delete set null,
  claimed_at      timestamptz,
  answer          text check (answer is null or char_length(btrim(answer)) between 20 and 1500),
  created_at      timestamptz not null default now(),
  answered_at     timestamptz,
  answer_read_at  timestamptz,
  closed_at       timestamptz
);

create index if not exists expert_questions_asker_idx on public.expert_questions (asker_id, created_at desc);
create index if not exists expert_questions_inbox_idx on public.expert_questions (specialty_key, created_at) where status in ('pending', 'claimed');
create index if not exists expert_questions_expert_idx on public.expert_questions (expert_id);

alter table public.expert_questions enable row level security;

-- Prindi: lexon dhe fshin vetëm të vetat. S'ka INSERT/UPDATE nga klienti.
drop policy if exists "expert_questions_asker_read" on public.expert_questions;
create policy "expert_questions_asker_read"
  on public.expert_questions for select to authenticated
  using (asker_id = (select auth.uid()));

drop policy if exists "expert_questions_asker_delete" on public.expert_questions;
create policy "expert_questions_asker_delete"
  on public.expert_questions for delete to authenticated
  using (asker_id = (select auth.uid()));

drop policy if exists "expert_questions_admin_all" on public.expert_questions;
create policy "expert_questions_admin_all"
  on public.expert_questions for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- Ora e çdo dërgimi (pa tekst): për limitin javor, edhe pas fshirjes.
create table if not exists public.expert_question_asks (
  asker_id   uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists expert_question_asks_idx on public.expert_question_asks (asker_id, created_at desc);
alter table public.expert_question_asks enable row level security;
-- Pa politika: vetëm funksionet e prekin.

-- "Kalo": cili ekspert e kaloi cilën pyetje (që s'i del më).
create table if not exists public.expert_question_skips (
  question_id uuid not null references public.expert_questions(id) on delete cascade,
  expert_id   uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (question_id, expert_id)
);
create index if not exists expert_question_skips_expert_idx on public.expert_question_skips (expert_id);
alter table public.expert_question_skips enable row level security;
-- Pa politika: vetëm funksionet e prekin.

-- --- Prindi -------------------------------------------------------------

-- Dërgo pyetjen. Më së shumti 3 në 7 ditët e fundit. Mosha: vetëm muajt.
create or replace function public.ask_expert_question(p_specialty text, p_body text, p_baby_age_months integer default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := (select auth.uid());
  v_body text := btrim(regexp_replace(coalesce(p_body, ''), '[ \t]+', ' ', 'g'));
  v_id uuid;
begin
  if v_me is null then
    raise exception 'not_authenticated';
  end if;
  if char_length(v_body) < 20 or char_length(v_body) > 600 then
    raise exception 'bad_body';
  end if;
  if not exists (select 1 from public.community_specialties where key = p_specialty) then
    raise exception 'bad_specialty';
  end if;
  if p_baby_age_months is not null and (p_baby_age_months < 0 or p_baby_age_months > 240) then
    raise exception 'bad_age';
  end if;
  -- Kyçi i përdoruesit: dy dërgime njëkohësisht s'e kalojnë dot limitin.
  perform pg_advisory_xact_lock(hashtext('expert_ask:' || v_me::text));
  if (select count(*) from public.expert_question_asks where asker_id = v_me and created_at > now() - interval '7 days') >= 3 then
    raise exception 'weekly_limit';
  end if;

  insert into public.expert_question_asks (asker_id) values (v_me);
  insert into public.expert_questions (asker_id, specialty_key, body, baby_age_months)
  values (v_me, p_specialty, v_body, p_baby_age_months)
  returning id into v_id;
  return v_id;
end;
$$;

revoke execute on function public.ask_expert_question(text, text, integer) from public, anon;
grant execute on function public.ask_expert_question(text, text, integer) to authenticated;

-- Sa pyetje mund të dërgojë ende këtë javë (tregohet mbi formë).
create or replace function public.expert_questions_remaining()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select greatest(0, 3 - (select count(*)::int from public.expert_question_asks
    where asker_id = (select auth.uid()) and created_at > now() - interval '7 days'));
$$;

revoke execute on function public.expert_questions_remaining() from public, anon;
grant execute on function public.expert_questions_remaining() to authenticated;

-- Shëno të lexuar një përgjigje (p_id) ose të gjitha (null).
create or replace function public.mark_answer_read(p_id uuid default null)
returns void
language sql
security definer
set search_path = public
as $$
  update public.expert_questions
  set answer_read_at = now()
  where asker_id = (select auth.uid())
    and status = 'answered'
    and answer_read_at is null
    and (p_id is null or id = p_id);
$$;

revoke execute on function public.mark_answer_read(uuid) from public, anon;
grant execute on function public.mark_answer_read(uuid) to authenticated;

-- Mbyll pyetjen (s'pret më përgjigje): del nga radha e ekspertëve.
create or replace function public.close_expert_question(p_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.expert_questions
  set status = 'closed', closed_at = now(), expert_id = null, claimed_at = null
  where id = p_id and asker_id = (select auth.uid()) and status in ('pending', 'claimed');
  return found;
end;
$$;

revoke execute on function public.close_expert_question(uuid) from public, anon;
grant execute on function public.close_expert_question(uuid) to authenticated;

-- --- Eksperti -----------------------------------------------------------

-- Radha e repartit tim: në pritje (ose të marra që kanë skaduar, ose të marra
-- nga unë), më të vjetrat para. PA asker_id. Pyetjet e mia si prind s'më dalin.
create or replace function public.list_expert_inbox()
returns table (id uuid, specialty_key text, body text, baby_age_months smallint, created_at timestamptz, claimed_by_me boolean)
language sql
stable
security definer
set search_path = public
as $$
  select q.id, q.specialty_key, q.body, q.baby_age_months, q.created_at,
         (q.status = 'claimed' and q.expert_id = (select auth.uid()))
  from public.expert_questions q
  where q.specialty_key = public.my_expert_specialty()
    and q.asker_id <> (select auth.uid())
    and (
      q.status = 'pending'
      or (q.status = 'claimed' and (q.expert_id = (select auth.uid()) or q.claimed_at < now() - interval '30 minutes'))
    )
    and not exists (select 1 from public.expert_question_skips s where s.question_id = q.id and s.expert_id = (select auth.uid()))
  order by q.created_at asc
  limit 100;
$$;

revoke execute on function public.list_expert_inbox() from public, anon;
grant execute on function public.list_expert_inbox() to authenticated;

-- Merre pyetjen (kur eksperti e hap). false = e mori dikush tjetër ose s'është e repartit tim.
create or replace function public.claim_expert_question(p_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := (select auth.uid());
  v_spec text := public.my_expert_specialty();
begin
  if not public.is_verified_expert() then
    raise exception 'not_an_expert';
  end if;
  update public.expert_questions
  set status = 'claimed', expert_id = v_me, claimed_at = now()
  where id = p_id
    and specialty_key = v_spec
    and asker_id <> v_me
    and (status = 'pending' or (status = 'claimed' and (expert_id = v_me or claimed_at < now() - interval '30 minutes')));
  return found;
end;
$$;

revoke execute on function public.claim_expert_question(uuid) from public, anon;
grant execute on function public.claim_expert_question(uuid) to authenticated;

-- "Kalo": e kthen në radhë për të tjerët dhe s'ia tregon më këtij eksperti.
create or replace function public.pass_expert_question(p_id uuid)
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
  if not exists (select 1 from public.expert_questions where id = p_id and specialty_key = public.my_expert_specialty() and asker_id <> v_me) then
    raise exception 'not_found';
  end if;
  update public.expert_questions
  set status = 'pending', expert_id = null, claimed_at = null
  where id = p_id and status = 'claimed' and expert_id = v_me;
  insert into public.expert_question_skips (question_id, expert_id) values (p_id, v_me)
  on conflict do nothing;
end;
$$;

revoke execute on function public.pass_expert_question(uuid) from public, anon;
grant execute on function public.pass_expert_question(uuid) to authenticated;

-- Përgjigju (20–1500). Vetëm eksperti i repartit; një herë për pyetje.
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
  v_lang text;
  v_name text;
begin
  if not public.is_verified_expert() then
    raise exception 'not_an_expert';
  end if;
  if char_length(v_answer) < 20 or char_length(v_answer) > 1500 then
    raise exception 'bad_answer';
  end if;

  select * into v_q from public.expert_questions where id = p_id for update;
  if v_q.id is null or v_q.asker_id = v_me or v_q.specialty_key is distinct from public.my_expert_specialty() then
    raise exception 'not_found';
  end if;
  if v_q.status = 'answered' then
    raise exception 'already_answered';
  end if;
  if v_q.status = 'closed' then
    raise exception 'closed';
  end if;
  if v_q.status = 'claimed' and v_q.expert_id <> v_me and v_q.claimed_at >= now() - interval '30 minutes' then
    raise exception 'claimed_by_other';
  end if;

  update public.expert_questions
  set status = 'answered', expert_id = v_me, answer = v_answer, answered_at = now(), claimed_at = coalesce(claimed_at, now())
  where id = p_id;

  -- Njoftimi te prindi, në gjuhën e tij (si te ekipi i familjes). Pa asnjë të dhënë të prindit te eksperti.
  v_lang := coalesce((select lang from public.household_member_profiles where user_id = v_q.asker_id), 'sq');
  v_name := coalesce((select name from public.community_experts where user_id = v_me), '');
  perform public.enqueue_notification(
    v_q.asker_id, 'community_expert_answer',
    case when v_lang = 'en' then 'An expert answered 💬' else 'Eksperti u përgjigj 💬' end,
    case
      when v_name = '' and v_lang = 'en' then 'Your question has an answer.'
      when v_name = '' then 'Pyetja jote ka përgjigje.'
      when v_lang = 'en' then v_name || ' answered your question.'
      else v_name || ' iu përgjigj pyetjes sate.'
    end,
    jsonb_build_object('type', 'expert_answer', 'questionId', p_id),
    'expert_answer:' || p_id::text, now(), now() + interval '7 days'
  );
end;
$$;

revoke execute on function public.answer_expert_question(uuid, text) from public, anon;
grant execute on function public.answer_expert_question(uuid, text) to authenticated;

commit;
