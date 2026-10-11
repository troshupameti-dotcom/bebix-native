/**
 * Prova e heqjes së "Pyetjes së ditës" në një Postgres lokal (PGlite).
 * Nisja:  node supabase/tests/remove-daily-questions.test.mjs   (me @electric-sql/pglite të instaluar)
 */
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";

const MIGRATION = new URL("../migrations/20261013090000_daily_questions.sql", import.meta.url);
const CLEANUP = new URL("../migrations/20261017090000_remove_daily_questions.sql", import.meta.url);
const SEED = new URL("../migrations/20261013090100_daily_questions_seed.sql", import.meta.url);
const db = new PGlite();
process.on("uncaughtException", (e) => { console.log("GABIM i papritur:", String(e.message).slice(0, 300)); process.exit(1); });

// Gjendja e prodhimit (sa i duhet testit): postimet, komentet me guard-et, bllokimet, grupet, pamja e vjetër e rrjedhës.
await db.exec(`
create schema auth;
create table auth.users (id uuid primary key default gen_random_uuid(), email text);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
create role anon; create role authenticated;
grant usage on schema public, auth to anon, authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated;
create table public.admins (user_id uuid primary key);
create function public.is_admin() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = (select auth.uid()));
$$;
grant execute on function public.is_admin() to anon, authenticated;
create table public.community_experts (user_id uuid unique, name text, kind text, specialty_key text);
create table public.community_groups (id uuid primary key default gen_random_uuid(), name text);
create table public.community_blocks (blocker_id uuid, blocked_id uuid);
create table public.notification_settings (user_id uuid primary key, prefs jsonb not null default '{}'::jsonb, updated_at timestamptz default now());
create table public.community_posts (
  id uuid primary key default gen_random_uuid(), author_id uuid not null references auth.users(id), author_name text not null, author_initial text not null,
  author_is_expert boolean not null default false, accent text not null default 'olive', kind text not null default 'text', text text not null, tag text,
  icon text not null default 'sparkle', group_id uuid, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  media jsonb not null default '[]', like_count int not null default 0, comment_count int not null default 0, open_report_count int not null default 0);
alter table public.community_posts enable row level security;
create policy posts_read on public.community_posts for select using (true);
create policy posts_insert on public.community_posts for insert with check (author_id = (select auth.uid()));
create function public.community_posts_guard() returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.author_name := coalesce(nullif(btrim(new.author_name), ''), 'Prind');
  new.author_initial := upper(left(new.author_name, 1));
  return new;
end $$;
create trigger community_posts_guard before insert on public.community_posts for each row execute function public.community_posts_guard();
create table public.community_comments (
  id uuid primary key default gen_random_uuid(), post_id uuid not null references public.community_posts(id) on delete cascade, author_id uuid not null,
  author_name text not null default '', parent_id uuid references public.community_comments(id) on delete cascade,
  text text not null check (char_length(text) between 1 and 1000), created_at timestamptz not null default now());
alter table public.community_comments enable row level security;
create policy comments_read on public.community_comments for select using (true);
create policy comments_insert on public.community_comments for insert with check (author_id = (select auth.uid()));
create policy comments_delete on public.community_comments for delete using (author_id = (select auth.uid()));
create function public.community_comments_guard() returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.author_name := coalesce(nullif(btrim(new.author_name), ''), 'Prind');
  return new;
end $$;
create trigger community_comments_guard before insert on public.community_comments for each row execute function public.community_comments_guard();
create view public.community_feed with (security_invoker = true) as
 select p.id, p.author_id, p.author_name, p.author_initial, p.author_is_expert, p.accent, p.kind, p.text, p.tag, p.icon, p.group_id,
    g.name as group_name, p.created_at, p.updated_at, p.like_count::bigint as like_count, p.comment_count::bigint as comment_count, p.media,
    (select e.specialty_key from public.community_experts e where e.user_id = p.author_id) as author_specialty
   from public.community_posts p left join public.community_groups g on g.id = p.group_id
  where not (exists (select 1 from public.community_blocks b where b.blocker_id = (select auth.uid()) and b.blocked_id = p.author_id))
    and (p.author_id = (select auth.uid()) or p.open_report_count < 3);
grant select on public.community_feed to anon, authenticated;
`);
for (const [name, file] of [["migrimi", MIGRATION], ["pyetjet fillestare", SEED]]) {
  try { await db.exec(fs.readFileSync(file, "utf8")); console.log(`OK  ${name} u ekzekutua pa gabime`); }
  catch (e) { console.log(`GABIM te ${name}:`, e.message); process.exit(1); }
}
try { await db.exec(fs.readFileSync(MIGRATION, "utf8")); await db.exec(fs.readFileSync(SEED, "utf8")); console.log("OK  të dy ekzekutohen sërish pa gabime (idempotent)"); }
catch (e) { console.log("GABIM: s'ekzekutohen dy herë:", e.message); process.exit(1); }

let pass = 0, fail = 0;
const check = (name, ok, extra = "") => { (ok ? pass++ : fail++); console.log((ok ? "OK  " : "GABIM ") + name + (extra ? "  -> " + extra : "")); };
const one = async (q, p) => (await db.query(q, p)).rows[0];
const fails = async (q, p) => { try { await db.query(q, p); return null; } catch (e) { return e.message; } };

await db.exec("reset role");
const mom = (await one(`insert into auth.users (email) values ('mami@x') returning id`)).id;
const post = (await one(`insert into public.community_posts (author_id, author_name, author_initial, text) values ($1, '', '', 'Postim') returning id`, [mom])).id;

for (let i = 1; i <= 2; i++) {
  try { await db.exec(fs.readFileSync(CLEANUP, "utf8")); console.log(`OK  pastrimi u ekzekutua (${i})`); }
  catch (e) { console.log("GABIM te pastrimi:", e.message); process.exit(1); }
}
const left = await one(`select to_regclass('public.community_daily_questions') q, to_regclass('public.community_daily_editorial') e,
  (select count(*)::int from pg_proc where proname in ('daily_answer_guard','edit_daily_answer','today_daily_question','set_daily_editorial','daily_question_today')) f,
  (select count(*)::int from pg_trigger where tgname = 'community_comments_daily_answer') t`);
check("tabelat, funksionet dhe trigger-i s'ekzistojnë më", left.q === null && left.e === null && left.f === 0 && left.t === 0, JSON.stringify(left));
check("komentet punojnë (pa kufi 280, pa limitin një)", !(await fails(`insert into public.community_comments (post_id, author_id, text) values ($1, $2, repeat('a', 600)), ($1, $2, 'sërish')`, [post, mom])));
const feed = await one(`select count(*)::int c, bool_or(is_daily_question) d from public.community_feed`);
check("rrjedha punon; kolona mbetet, gjithmonë false", feed.c === 1 && feed.d === false);

console.log(`\n${pass} OK, ${fail} gabime`);
process.exit(fail ? 1 : 0);
