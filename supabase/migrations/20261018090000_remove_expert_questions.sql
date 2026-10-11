-- =====================================================================
-- Heq "Pyet ekspertin" (vendim i 12 tetorit 2026): tabelat dhe funksionet e
-- migrimit 20261014090000_expert_questions.sql. S'ka trigger-a te tabelat e
-- tjera, ndaj asgjë tjetër s'preket (ekspertët, repartet, Komuniteti mbeten).
-- Mund të ekzekutohet sa herë të duash.
-- PA EKZEKUTUAR: ekzekutoje te Supabase → SQL Editor.
-- =====================================================================

begin;

drop function if exists public.ask_expert_question(text, text, integer);
drop function if exists public.expert_questions_remaining();
drop function if exists public.mark_answer_read(uuid);
drop function if exists public.close_expert_question(uuid);
drop function if exists public.list_expert_inbox();
drop function if exists public.claim_expert_question(uuid);
drop function if exists public.pass_expert_question(uuid);
drop function if exists public.answer_expert_question(uuid, text);

drop table if exists public.expert_question_skips;
drop table if exists public.expert_question_asks;
drop table if exists public.expert_questions;

drop function if exists public.my_expert_specialty();
drop function if exists public.is_verified_expert();

commit;
