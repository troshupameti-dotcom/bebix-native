-- =====================================================================
-- Heq "Pyetjen e ditës" (vendim i 11 tetorit 2026): tabelat, funksionet dhe
-- trigger-in te komentet. Postimet dhe komentet e Komunitetit s'preken.
--
-- Radha ka rëndësi:
--  1) rrjedha s'e lexon më tabelën (kolona is_daily_question mbetet, gjithmonë
--     false, që build-et që e kërkojnë të mos prishen);
--  2) trigger-i i komenteve hiqet PARA tabelës — përndryshe çdo koment i ri do
--     të dështonte;
--  3) funksionet dhe tabelat.
-- Mund të ekzekutohet sa herë të duash.
-- PA EKZEKUTUAR: ekzekutoje te Supabase → SQL Editor.
-- =====================================================================

begin;

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
    false as is_daily_question
   from public.community_posts p
     left join public.community_groups g on g.id = p.group_id
  where not (exists (select 1 from public.community_blocks b
          where b.blocker_id = (select auth.uid()) and b.blocked_id = p.author_id))
    and (p.author_id = (select auth.uid()) or p.open_report_count < 3);

drop trigger if exists community_comments_daily_answer on public.community_comments;

drop function if exists public.daily_answer_guard();
drop function if exists public.edit_daily_answer(uuid, text);
drop function if exists public.today_daily_question();
drop function if exists public.set_daily_editorial(uuid);

drop table if exists public.community_daily_editorial;
drop table if exists public.community_daily_questions;

drop function if exists public.daily_question_today();

commit;
