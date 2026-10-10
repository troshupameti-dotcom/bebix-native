-- =====================================================================
-- Pyetja e ditës te Komuniteti.
--
-- Një pyetje në ditë (sipas `active_date`), përgjigje të shkurtra (≤ 280
-- shkronja), një përgjigje për prind për pyetje — e ndryshueshme.
--
-- Pse tabelë e re dhe jo `community_comments`: komentet kërkojnë një
-- postim (`post_id` → community_posts). Një postim për çdo pyetje do të
-- dilte në rrjedhë dhe do të niste njoftimet "koment i ri".
--
-- RLS si te komentet: leximi publik, shkrimi vetëm nga autori, admini
-- gjithçka. Emri i autorit e vendos serveri (si te komentet:
-- `community_author_name` — eksperti me emrin e vet, ndryshe emri i
-- profilit ose "Prind").
--
-- PA EKZEKUTUAR: ekzekutoje te Supabase → SQL Editor.
-- =====================================================================

create table if not exists public.daily_questions (
  id          uuid primary key default gen_random_uuid(),
  text_sq     text not null check (char_length(btrim(text_sq)) between 5 and 200),
  text_en     text check (text_en is null or char_length(btrim(text_en)) between 5 and 200),
  active_date date not null unique,
  created_at  timestamptz not null default now()
);

alter table public.daily_questions enable row level security;

-- Pyetjet e ardhshme s'shihen para kohe (vetëm admini i sheh).
drop policy if exists "daily_questions_public_read" on public.daily_questions;
create policy "daily_questions_public_read"
  on public.daily_questions for select
  using (active_date <= current_date + 1 or (select public.is_admin()));

drop policy if exists "daily_questions_admin_all" on public.daily_questions;
create policy "daily_questions_admin_all"
  on public.daily_questions for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create table if not exists public.daily_question_answers (
  id          uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.daily_questions(id) on delete cascade,
  author_id   uuid not null references auth.users(id) on delete cascade,
  author_name text,
  text        text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint daily_question_answers_text_len check (char_length(btrim(text)) between 1 and 280),
  constraint daily_question_answers_one_per_user unique (question_id, author_id)
);

create index if not exists daily_question_answers_question_idx
  on public.daily_question_answers (question_id, created_at);

alter table public.daily_question_answers enable row level security;

drop policy if exists "daily_answers_public_read" on public.daily_question_answers;
create policy "daily_answers_public_read"
  on public.daily_question_answers for select
  using (true);

drop policy if exists "daily_answers_self_insert" on public.daily_question_answers;
create policy "daily_answers_self_insert"
  on public.daily_question_answers for insert
  with check ((select auth.uid()) = author_id);

drop policy if exists "daily_answers_self_update" on public.daily_question_answers;
create policy "daily_answers_self_update"
  on public.daily_question_answers for update
  using ((select auth.uid()) = author_id)
  with check ((select auth.uid()) = author_id);

drop policy if exists "daily_answers_self_delete" on public.daily_question_answers;
create policy "daily_answers_self_delete"
  on public.daily_question_answers for delete
  using ((select auth.uid()) = author_id);

drop policy if exists "daily_answers_admin_all" on public.daily_question_answers;
create policy "daily_answers_admin_all"
  on public.daily_question_answers for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- Serveri vendos emrin dhe orët; përgjigjet pranohen vetëm për pyetjen e
-- sotme (±1 ditë për zonat kohore); ndryshimi prek vetëm tekstin.
create or replace function public.daily_answers_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_date date;
begin
  if tg_op = 'INSERT' then
    select active_date into v_date from public.daily_questions where id = new.question_id;
    if v_date is null or v_date < current_date - 1 or v_date > current_date + 1 then
      raise exception 'Kjo pyetje s''pranon më përgjigje.';
    end if;
    new.author_name := public.community_author_name(new.author_id, new.author_name);
    new.created_at := now();
    new.updated_at := now();
  else
    new.question_id := old.question_id;
    new.author_id := old.author_id;
    new.author_name := old.author_name;
    new.created_at := old.created_at;
    new.updated_at := now();
  end if;
  new.text := btrim(new.text);
  return new;
end;
$$;

revoke execute on function public.daily_answers_guard() from public, anon, authenticated;

drop trigger if exists daily_answers_guard on public.daily_question_answers;
create trigger daily_answers_guard before insert or update on public.daily_question_answers
  for each row execute function public.daily_answers_guard();

-- 14 pyetjet e para: nga sot, një në ditë. `on conflict do nothing`: datat
-- që ke caktuar vetë s'mbishkruhen kur ky skedar ekzekutohet sërish.
insert into public.daily_questions (text_sq, text_en, active_date) values
  ($$Cili është rituali juaj i vogël para gjumit që e qetëson bebin?$$, $$What's your little bedtime ritual that calms your baby?$$, current_date),
  ($$Çfarë ju ndihmon më shumë kur bebi zgjohet shpesh natën?$$, $$What helps you most when your baby wakes often at night?$$, current_date + 1),
  ($$Cila ishte shija e parë që i pëlqeu bebit me ushqimet e forta?$$, $$What was the first solid food your baby loved?$$, current_date + 2),
  ($$Si e keni lehtësuar daljen e dhëmbëve? Çfarë funksionoi te ju?$$, $$How have you eased teething? What worked for you?$$, current_date + 3),
  ($$Kur ndiheni të lodhur, çfarë ju jep pak forcë gjatë ditës?$$, $$When you're exhausted, what gives you a little strength during the day?$$, current_date + 4),
  ($$Cila është këshilla më e mirë që keni marrë si prindër të rinj?$$, $$What's the best advice you got as new parents?$$, current_date + 5),
  ($$Si e organizoni ushqyerjen kur jeni jashtë shtëpisë?$$, $$How do you handle feeding when you're out of the house?$$, current_date + 6),
  ($$Çfarë do t'i thoshit vetes në javën e parë me bebin?$$, $$What would you tell yourself in the first week with your baby?$$, current_date + 7),
  ($$Si i ndani netët me partnerin, apo kush ju ndihmon?$$, $$How do you share nights with your partner, or who helps you?$$, current_date + 8),
  ($$Cili ushqim i fortë ishte më i vështirë për t'u pranuar, dhe si ia dolët?$$, $$Which solid food was hardest to accept, and how did you manage?$$, current_date + 9),
  ($$Cili është momenti i ditës që e prisni më shumë me bebin?$$, $$What's the moment of the day you look forward to most with your baby?$$, current_date + 10),
  ($$Një gjë e vogël që e bëni vetëm për veten, edhe 10 minuta?$$, $$One small thing you do just for yourself, even 10 minutes?$$, current_date + 11),
  ($$Si e kuptoni që bebi është i uritur apo thjesht kërkon afërsi?$$, $$How do you tell if your baby is hungry or just wants closeness?$$, current_date + 12),
  ($$Cila lodër apo lojë e bën bebin të qeshë më shumë?$$, $$Which toy or game makes your baby laugh the most?$$, current_date + 13)
on conflict (active_date) do nothing;
