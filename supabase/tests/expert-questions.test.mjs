/**
 * Prova e "Pyet ekspertin" në një Postgres lokal (PGlite).
 * Nisja:  node supabase/tests/expert-questions.test.mjs   (me @electric-sql/pglite të instaluar)
 */
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";

const MIGRATION = new URL("../migrations/20261014090000_expert_questions.sql", import.meta.url);
const db = new PGlite();
process.on("uncaughtException", (e) => { console.log("GABIM i papritur:", String(e.message).slice(0, 300)); process.exit(1); });

// Gjendja e prodhimit (sa i duhet testit): auth, adminët, ekspertët, postimet me trigger-in e autorit.
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
create table public.community_posts (
  id uuid primary key default gen_random_uuid(), author_id uuid not null, author_name text not null, author_initial text not null,
  author_is_expert boolean not null default false, kind text not null default 'text', text text not null, tag text,
  created_at timestamptz not null default now(),
  constraint community_posts_text_len check (char_length(text) <= 2000),
  constraint community_posts_kind_check check (kind in ('text','question','poll','milestone','review')));
create function public.community_posts_guard() returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.author_is_expert := exists (select 1 from public.community_experts where user_id = new.author_id);
  new.author_name := coalesce((select name from public.community_experts where user_id = new.author_id), 'Prind');
  new.author_initial := upper(left(new.author_name, 1));
  return new;
end $$;
create trigger community_posts_guard before insert on public.community_posts for each row execute function public.community_posts_guard();
`);
try { await db.exec(fs.readFileSync(MIGRATION, "utf8")); console.log("OK  migrimi u ekzekutua pa gabime"); }
catch (e) { console.log("GABIM te migrimi:", e.message); process.exit(1); }

let pass = 0, fail = 0;
const check = (name, ok, extra = "") => { (ok ? pass++ : fail++); console.log((ok ? "OK  " : "GABIM ") + name + (extra ? "  -> " + extra : "")); };
const one = async (q, p) => (await db.query(q, p)).rows[0];
const all = async (q, p) => (await db.query(q, p)).rows;
const as = async (uid) => { await db.exec(`reset role; select set_config('test.uid', '${uid ?? ""}', false); ${uid ? "set role authenticated;" : "set role anon;"}`); };
const fails = async (q, p) => { try { await db.query(q, p); return null; } catch (e) { return e.message; } };

await db.exec("reset role");
const mk = async (e) => (await one(`insert into auth.users (email) values ($1) returning id`, [e])).id;
const mom = await mk("mami@x"), dad = await mk("babi@x"), drA = await mk("dra@x"), drB = await mk("drb@x");
await db.query(`insert into public.community_experts values ($1, 'Dr. Arta', 'doctor', 'pediatrics'), ($2, 'Dr. Besa', 'doctor', 'pediatrics')`, [drA, drB]);

const Q = "Bebi zgjohet çdo orë natën, a është normale në 4 muaj?";

// --- Prindi pyet
await as(mom);
const q1 = (await one(`select public.ask_expert('sleep', $1, true) as id`, [Q])).id;
check("prindi dërgon pyetjen", !!q1);
check("tekst shumë i shkurtër refuzohet", !!(await fails(`select public.ask_expert('sleep', 'shkurt', false)`)));
check("kategori e panjohur refuzohet", !!(await fails(`select public.ask_expert('magji', $1, false)`, [Q])));
check("s'shkruan direkt në tabelë", !!(await fails(`insert into public.expert_questions (asker_id, category, body) values ($1, 'sleep', $2)`, [mom, Q])));
await db.query(`select public.ask_expert('feeding', $1, false)`, [Q + " (2)"]);
await db.query(`select public.ask_expert('health', $1, false)`, [Q + " (3)"]);
check("limiti 3 në javë (në bazë)", (await fails(`select public.ask_expert('other', $1, false)`, [Q + " (4)"]))?.includes("weekly_limit"));
check("prindi i sheh pyetjet e veta", (await one(`select count(*)::int c from public.expert_questions`)).c === 3);

await as(dad);
check("prindi tjetër s'i sheh", (await one(`select count(*)::int c from public.expert_questions`)).c === 0);
check("prindi s'e lexon radhën e ekspertëve", (await all(`select * from public.expert_question_queue()`)).length === 0);

// --- Eksperti
await as(drA);
check("eksperti s'e lexon tabelën direkt (s'sheh kush pyeti)", (await one(`select count(*)::int c from public.expert_questions`)).c === 0);
const queue = await all(`select * from public.expert_question_queue()`);
check("radha: 3 pyetje, më e vjetra e para", queue.length === 3 && queue[0].id === q1);
check("radha s'ka asker_id", !("asker_id" in queue[0]) && queue[0].category === "sleep");
check("eksperti e merr pyetjen", (await one(`select public.claim_expert_question($1) as ok`, [q1])).ok === true);

await as(drB);
check("eksperti tjetër s'e sheh pyetjen e marrë", !(await all(`select id from public.expert_question_queue()`)).some((r) => r.id === q1));
check("as s'e merr dot", (await one(`select public.claim_expert_question($1) as ok`, [q1])).ok === false);
check("as s'përgjigjet dot", (await fails(`select public.answer_expert_question($1, 'po')`, [q1]))?.includes("claimed_by_other"));

await as(drA);
await db.query(`select public.skip_expert_question($1)`, [q1]);
check("'Kalo': s'i del më atij eksperti", !(await all(`select id from public.expert_question_queue()`)).some((r) => r.id === q1));
await as(drB);
check("'Kalo': i kthehet radhës për të tjerët", (await all(`select id from public.expert_question_queue()`)).some((r) => r.id === q1));
await db.query(`select public.claim_expert_question($1)`, [q1]);
check("përgjigje mbi 1500 refuzohet", (await fails(`select public.answer_expert_question($1, repeat('a', 1501))`, [q1]))?.includes("bad_answer"));
const ANSWER = "Në 4 muaj zgjimet e shpeshta janë të zakonshme (regresi i gjumit). Rutinë e qetë dhe errësirë ndihmojnë.";
await db.query(`select public.answer_expert_question($1, $2)`, [q1, ANSWER]);
check("përgjigja e dytë refuzohet", (await fails(`select public.answer_expert_question($1, 'sërish')`, [q1]))?.includes("already_answered"));
check("e përgjigjura del nga radha", !(await all(`select id from public.expert_question_queue()`)).some((r) => r.id === q1));

// --- Prindi e lexon përgjigjen
await as(mom);
let row = await one(`select status, answer, expert_id, answered_at, answer_read_at, published_post_id from public.expert_questions where id = $1`, [q1]);
check("statusi 'answered', me orë dhe ekspert", row.status === "answered" && row.answer === ANSWER && row.expert_id === drB && !!row.answered_at);
check("e palexuar (pika e kuqe)", row.answer_read_at === null);
await db.query(`select public.mark_expert_answers_read()`);
check("pas hapjes: e lexuar", (await one(`select answer_read_at from public.expert_questions where id = $1`, [q1])).answer_read_at !== null);

// --- Publikimi pa emër
await db.exec("reset role");
const post = await one(`select author_id, author_name, author_is_expert, kind, tag, text from public.community_posts where id = $1`, [row.published_post_id]);
check("postimi publik: i ekspertit, jo i prindit", post?.author_id === drB && post.author_name === "Dr. Besa" && post.author_is_expert === true);
check("me etiketën 'Pyetje për ekspert' dhe pyetjen + përgjigjen", post.kind === "question" && post.tag === "Pyetje për ekspert" && post.text.includes(Q) && post.text.includes(ANSWER));
check("pa asnjë gjurmë të prindit", !JSON.stringify(post).includes(mom));

// Pyetja pa publikim s'krijon postim; teksti i gjatë shkurtohet brenda 2000
await as(drA);
const q2 = (await all(`select id from public.expert_question_queue()`))[0].id;
await db.query(`select public.claim_expert_question($1)`, [q2]);
await db.query(`select public.answer_expert_question($1, 'Përgjigje e shkurtër dhe e qartë.')`, [q2]);
await db.exec("reset role");
check("pa 'Publiko': s'ka postim", (await one(`select published_post_id from public.expert_questions where id = $1`, [q2])).published_post_id === null);
await as(dad);
const q4 = (await one(`select public.ask_expert('other', $1, true) as id`, ["x".repeat(600)])).id;
await as(drA);
await db.query(`select public.claim_expert_question($1)`, [q4]);
await db.query(`select public.answer_expert_question($1, $2)`, [q4, "y".repeat(1500)]);
await db.exec("reset role");
const longPost = await one(`select char_length(p.text) n, right(p.text, 1) last from public.community_posts p join public.expert_questions q on q.published_post_id = p.id where q.id = $1`, [q4]);
check("postimi i gjatë mbetet brenda 2000 (me …)", longPost.n === 2000 && longPost.last === "…", JSON.stringify(longPost));

// Eksperti s'i sheh pyetjet e veta si prind në radhë
await as(drA);
const own = (await one(`select public.ask_expert('sleep', $1, false) as id`, [Q + " nga mjeku"])).id;
check("pyetja ime si prind s'më del në radhë", !(await all(`select id from public.expert_question_queue()`)).some((r) => r.id === own));
check("as s'e marr dot", (await one(`select public.claim_expert_question($1) as ok`, [own])).ok === false);
await as(dad);
check("jo-eksperti s'merr pyetje", (await fails(`select public.claim_expert_question($1)`, [own]))?.includes("not_an_expert"));

console.log(`\n${pass} OK, ${fail} gabime`);
process.exit(fail ? 1 : 0);
