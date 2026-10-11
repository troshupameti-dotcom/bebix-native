/**
 * Prova e "Pyetja e ditës" (v2: postimi bazë editorial + komentet si përgjigje) në një Postgres lokal (PGlite).
 * Nisja:  node supabase/tests/daily-questions.test.mjs   (me @electric-sql/pglite të instaluar)
 */
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";

const MIGRATION = new URL("../migrations/20261013090000_daily_questions.sql", import.meta.url);
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
const all = async (q, p) => (await db.query(q, p)).rows;
const as = async (uid) => { await db.exec(`reset role; select set_config('test.uid', '${uid ?? ""}', false); ${uid ? "set role authenticated;" : "set role anon;"}`); };
const fails = async (q, p) => { try { await db.query(q, p); return null; } catch (e) { return e.message; } };

await db.exec("reset role");
const mk = async (e) => (await one(`insert into auth.users (email) values ($1) returning id`, [e])).id;
const editor = await mk("info@bebix"), mom = await mk("mami@x"), dad = await mk("babi@x"), admin = await mk("admin@x");
await db.query(`insert into public.admins values ($1)`, [admin]);

// --- Pyetjet fillestare
const seeded = await all(`select active_date - public.daily_question_today() as d from public.community_daily_questions order by active_date`);
check("30 pyetje, nga e nesërmja, ditë pas dite, pa dyfishime pas ekzekutimit të dytë", seeded.length === 30 && seeded[0].d === 1 && seeded[29].d === 30);

await as(mom);
check("pyetjet e ardhshme s'lexohen ende", (await one(`select count(*)::int c from public.community_daily_questions`)).c === 0);
check("pa pyetje për sot: asgjë (s'ka kartë bosh)", (await all(`select * from public.today_daily_question()`)).length === 0);
check("prindi s'shton pyetje", !!(await fails(`insert into public.community_daily_questions (text, active_date) values ('Pyetje e re?', current_date)`)));

// Pyetja e parë bëhet e sotmja
await db.exec("reset role");
await db.exec(`update public.community_daily_questions set active_date = public.daily_question_today() where active_date = public.daily_question_today() + 1`);
await as(mom);
check("pa llogari editoriale: asgjë", (await all(`select * from public.today_daily_question()`)).length === 0);
check("prindi s'e cakton llogarinë editoriale", (await fails(`select public.set_daily_editorial($1)`, [mom]))?.includes("not_admin"));
await as(admin);
await db.query(`select public.set_daily_editorial($1)`, [editor]);
await db.exec("reset role");
check("llogaria editoriale s'merr njoftime 'Koment i ri'", (await one(`select prefs->>'community_comment' v from public.notification_settings where user_id = $1`, [editor])).v === "false");

// --- Postimi bazë
await as(mom);
const today = await one(`select * from public.today_daily_question()`);
check("pyetja e sotme me postimin bazë", !!today?.post_id && today.text.startsWith("Çka të ka ndihmu") && today.answer_count === 0);
const again = await one(`select * from public.today_daily_question()`);
check("postimi krijohet një herë", again.post_id === today.post_id && (await one(`select count(*)::int c from public.community_posts`)).c === 1);
const base = await one(`select author_id, author_name, kind, tag from public.community_posts where id = $1`, [today.post_id]);
check("postimi nga llogaria editoriale, me emrin Bebix", base.author_id === editor && base.author_name === "Bebix" && base.kind === "question" && base.tag === "Pyetja e ditës");

// --- Përgjigjet
const P = today.post_id;
await db.query(`insert into public.community_comments (post_id, author_id, text) values ($1, $2, 'Banjë e ngrohtë dhe dritë e ulët.')`, [P, mom]);
check("prindi përgjigjet", (await one(`select count(*)::int c from public.community_comments where post_id = $1`, [P])).c === 1);
check("përgjigja e dytë e të njëjtit prind refuzohet", (await fails(`insert into public.community_comments (post_id, author_id, text) values ($1, $2, 'Edhe një')`, [P, mom]))?.includes("daily_answer_exists"));
const myAnswer = (await one(`select id from public.community_comments where post_id = $1 and author_id = $2`, [P, mom])).id;

await as(dad);
check("përgjigje mbi 280 refuzohet", (await fails(`insert into public.community_comments (post_id, author_id, text) values ($1, $2, repeat('a', 281))`, [P, dad]))?.includes("daily_answer_length"));
await db.query(`insert into public.community_comments (post_id, author_id, text) values ($1, $2, 'Na ndihmon tundja e lehtë.')`, [P, dad]);
await db.query(`insert into public.community_comments (post_id, author_id, parent_id, text) values ($1, $2, $3, repeat('b', 500))`, [P, dad, myAnswer]);
check("përgjigjet ndaj përgjigjeve: si komentet e zakonshme (edhe mbi 280)", (await one(`select count(*)::int c from public.community_comments where parent_id = $1`, [myAnswer])).c === 1);
check("numri i përgjigjeve = komentet e para (2)", (await one(`select answer_count from public.today_daily_question()`)).answer_count === 2);
check("tjetri s'e ndryshon përgjigjen time", (await fails(`select public.edit_daily_answer($1, 'Ndryshim')`, [myAnswer]))?.includes("not_found"));

await as(mom);
await db.query(`select public.edit_daily_answer($1, '  Banjë   e ngrohtë  ')`, [myAnswer]);
check("e ndryshoj përgjigjen time (hapësirat pastrohen)", (await one(`select text from public.community_comments where id = $1`, [myAnswer])).text === "Banjë e ngrohtë");
check("ndryshimi mbi 280 refuzohet", (await fails(`select public.edit_daily_answer($1, repeat('c', 281))`, [myAnswer]))?.includes("daily_answer_length"));
await db.query(`delete from public.community_comments where id = $1`, [myAnswer]);
await db.query(`insert into public.community_comments (post_id, author_id, text) values ($1, $2, 'E shkruaj sërish pas fshirjes.')`, [P, mom]);
check("pas fshirjes, prindi përgjigjet sërish", (await one(`select count(*)::int c from public.community_comments where post_id = $1 and author_id = $2 and parent_id is null`, [P, mom])).c === 1);

// --- Postimet e zakonshme s'preken
const normal = (await one(`insert into public.community_posts (author_id, author_name, author_initial, text) values ($1, '', '', 'Postim i zakonshëm') returning id`, [mom])).id;
await db.query(`insert into public.community_comments (post_id, author_id, text) values ($1, $2, repeat('d', 600))`, [normal, mom]);
await db.query(`insert into public.community_comments (post_id, author_id, text) values ($1, $2, 'Koment i dytë')`, [normal, mom]);
check("te postimet e zakonshme: pa kufi një komenti dhe 280 shkronjash", (await one(`select count(*)::int c from public.community_comments where post_id = $1`, [normal])).c === 2);

// --- Rrjedha
const feed = await all(`select id, is_daily_question from public.community_feed`);
check("rrjedha e shënon postimin bazë (app-i e fsheh), postimet e tjera jo", feed.find((r) => r.id === P)?.is_daily_question === true && feed.find((r) => r.id === normal)?.is_daily_question === false);
await as(null);
check("pa llogari: pyetja e sotme lexohet, por s'thirret RPC-ja", (await one(`select count(*)::int c from public.community_daily_questions`)).c === 1 && !!(await fails(`select * from public.today_daily_question()`)));

console.log(`\n${pass} OK, ${fail} gabime`);
process.exit(fail ? 1 : 0);
