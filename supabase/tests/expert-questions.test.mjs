/**
 * Prova e "Pyet ekspertin" (v2: repartet, mosha në muaj, mbyllja/fshirja, njoftimi) në një Postgres lokal (PGlite).
 * Nisja:  node supabase/tests/expert-questions.test.mjs   (me @electric-sql/pglite të instaluar)
 */
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";

const MIGRATION = new URL("../migrations/20261014090000_expert_questions.sql", import.meta.url);
const db = new PGlite();
process.on("uncaughtException", (e) => { console.log("GABIM i papritur:", String(e.message).slice(0, 300)); process.exit(1); });

// Gjendja e prodhimit (sa i duhet testit): auth, adminët, repartet, ekspertët, gjuha, radha e njoftimeve.
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
create table public.community_specialties (key text primary key, label text);
insert into public.community_specialties values ('pediatrician', 'Pediatër'), ('lactation', 'Laktacion');
create table public.community_experts (user_id uuid unique, name text, kind text, specialty_key text references public.community_specialties(key));
create table public.household_member_profiles (user_id uuid primary key, lang text);
create table public.notification_outbox (user_id uuid, key text, title text, body text, data jsonb, dedupe_key text, send_after timestamptz, expires_at timestamptz);
create function public.enqueue_notification(p_user uuid, p_key text, p_title text, p_body text, p_data jsonb default '{}'::jsonb,
  p_dedupe text default null, p_send_after timestamptz default now(), p_expires_at timestamptz default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.notification_outbox values (p_user, p_key, p_title, p_body, p_data, p_dedupe, p_send_after, p_expires_at);
end $$;
`);
try { await db.exec(fs.readFileSync(MIGRATION, "utf8")); console.log("OK  migrimi u ekzekutua pa gabime"); }
catch (e) { console.log("GABIM te migrimi:", e.message); process.exit(1); }
try { await db.exec(fs.readFileSync(MIGRATION, "utf8")); console.log("OK  migrimi ekzekutohet sërish pa gabime (idempotent)"); }
catch (e) { console.log("GABIM: migrimi s'ekzekutohet dy herë:", e.message); process.exit(1); }

let pass = 0, fail = 0;
const check = (name, ok, extra = "") => { (ok ? pass++ : fail++); console.log((ok ? "OK  " : "GABIM ") + name + (extra ? "  -> " + extra : "")); };
const one = async (q, p) => (await db.query(q, p)).rows[0];
const all = async (q, p) => (await db.query(q, p)).rows;
const as = async (uid) => { await db.exec(`reset role; select set_config('test.uid', '${uid ?? ""}', false); ${uid ? "set role authenticated;" : "set role anon;"}`); };
const fails = async (q, p) => { try { await db.query(q, p); return null; } catch (e) { return e.message; } };

await db.exec("reset role");
const mk = async (e) => (await one(`insert into auth.users (email) values ($1) returning id`, [e])).id;
const mom = await mk("mami@x"), dad = await mk("babi@x"), drA = await mk("dra@x"), drB = await mk("drb@x"), lac = await mk("lac@x");
await db.query(`insert into public.community_experts values ($1, 'Dr. Arta', 'doctor', 'pediatrician'), ($2, 'Dr. Besa', 'doctor', 'pediatrician'), ($3, 'Mira', 'consultant', 'lactation')`, [drA, drB, lac]);
await db.query(`insert into public.household_member_profiles values ($1, 'en')`, [dad]);

const Q = "Bebi zgjohet çdo orë natën, a është normale në 4 muaj?";

// --- Prindi pyet
await as(mom);
const q1 = (await one(`select public.ask_expert_question('pediatrician', $1, 4) as id`, [Q])).id;
check("prindi dërgon pyetjen (reparti + mosha në muaj)", !!q1);
check("tekst shumë i shkurtër refuzohet", (await fails(`select public.ask_expert_question('pediatrician', 'shkurt')`))?.includes("bad_body"));
check("tekst mbi 600 refuzohet", (await fails(`select public.ask_expert_question('pediatrician', repeat('a', 601))`))?.includes("bad_body"));
check("repart i panjohur refuzohet", (await fails(`select public.ask_expert_question('magji', $1)`, [Q]))?.includes("bad_specialty"));
check("mosha jashtë kufijve refuzohet", (await fails(`select public.ask_expert_question('pediatrician', $1, 500)`, [Q]))?.includes("bad_age"));
check("s'shkruan direkt në tabelë", !!(await fails(`insert into public.expert_questions (asker_id, specialty_key, body) values ($1, 'pediatrician', $2)`, [mom, Q])));
check("s'e ndryshon dot përgjigjen vetë", (await all(`update public.expert_questions set answer = 'vetë' where id = $1 returning id`, [q1]).catch(() => [])).length === 0);
check("mbeten 2 këtë javë", (await one(`select public.expert_questions_remaining() as n`)).n === 2);
const q2 = (await one(`select public.ask_expert_question('lactation', $1) as id`, [Q + " (2)"])).id;
const q3 = (await one(`select public.ask_expert_question('pediatrician', $1) as id`, [Q + " (3)"])).id;
check("limiti 3 në javë (në bazë)", (await fails(`select public.ask_expert_question('pediatrician', $1)`, [Q + " (4)"]))?.includes("weekly_limit"));
await db.query(`delete from public.expert_questions where id = $1`, [q3]);
check("prindi e fshin pyetjen e vet", (await one(`select count(*)::int c from public.expert_questions`)).c === 2);
check("fshirja s'e rihap limitin", (await fails(`select public.ask_expert_question('pediatrician', $1)`, [Q + " (5)"]))?.includes("weekly_limit"));

await as(dad);
check("prindi tjetër s'i sheh", (await one(`select count(*)::int c from public.expert_questions`)).c === 0);
check("prindi tjetër s'i fshin", (await all(`delete from public.expert_questions where id = $1 returning id`, [q1])).length === 0);
check("prindi s'e lexon radhën e ekspertëve", (await all(`select * from public.list_expert_inbox()`)).length === 0);
check("prindi s'i mbyll pyetjet e tjetrit", (await one(`select public.close_expert_question($1) as ok`, [q1])).ok === false);

// --- Eksperti (pediatri)
await as(drA);
check("eksperti s'e lexon tabelën direkt (s'sheh kush pyeti)", (await one(`select count(*)::int c from public.expert_questions`)).c === 0);
let inbox = await all(`select * from public.list_expert_inbox()`);
check("radha: vetëm pyetjet e repartit tim", inbox.length === 1 && inbox[0].id === q1, JSON.stringify(inbox.map((r) => r.specialty_key)));
check("radha s'ka asker_id; ka moshën në muaj", !("asker_id" in inbox[0]) && inbox[0].baby_age_months === 4 && inbox[0].specialty_key === "pediatrician");
check("s'e merr dot pyetjen e një reparti tjetër", (await one(`select public.claim_expert_question($1) as ok`, [q2])).ok === false);
check("s'i përgjigjet dot pyetjes së një reparti tjetër", (await fails(`select public.answer_expert_question($1, repeat('a', 30))`, [q2]))?.includes("not_found"));
check("eksperti e merr pyetjen", (await one(`select public.claim_expert_question($1) as ok`, [q1])).ok === true);

await as(drB);
check("eksperti tjetër s'e sheh pyetjen e marrë", !(await all(`select id from public.list_expert_inbox()`)).some((r) => r.id === q1));
check("as s'e merr dot", (await one(`select public.claim_expert_question($1) as ok`, [q1])).ok === false);
check("as s'përgjigjet dot", (await fails(`select public.answer_expert_question($1, repeat('p', 30))`, [q1]))?.includes("claimed_by_other"));

await as(drA);
await db.query(`select public.pass_expert_question($1)`, [q1]);
check("'Kalo': s'i del më atij eksperti", !(await all(`select id from public.list_expert_inbox()`)).some((r) => r.id === q1));
await as(drB);
check("'Kalo': i kthehet radhës për të tjerët", (await all(`select id from public.list_expert_inbox()`)).some((r) => r.id === q1));
await db.query(`select public.claim_expert_question($1)`, [q1]);
check("përgjigje nën 20 refuzohet", (await fails(`select public.answer_expert_question($1, 'shkurt')`, [q1]))?.includes("bad_answer"));
check("përgjigje mbi 1500 refuzohet", (await fails(`select public.answer_expert_question($1, repeat('a', 1501))`, [q1]))?.includes("bad_answer"));
const ANSWER = "Në 4 muaj zgjimet e shpeshta janë të zakonshme (regresi i gjumit). Rutinë e qetë dhe errësirë ndihmojnë.";
await db.query(`select public.answer_expert_question($1, $2)`, [q1, ANSWER]);
check("përgjigja e dytë refuzohet", (await fails(`select public.answer_expert_question($1, repeat('s', 30))`, [q1]))?.includes("already_answered"));
check("e përgjigjura del nga radha", !(await all(`select id from public.list_expert_inbox()`)).some((r) => r.id === q1));

// --- Njoftimi te prindi
await db.exec("reset role");
const notif = await all(`select * from public.notification_outbox`);
check("njoftimi 'community_expert_answer' shkon te prindi, në shqip", notif.length === 1 && notif[0].user_id === mom && notif[0].key === "community_expert_answer" && notif[0].body.includes("Dr. Besa") && notif[0].title.startsWith("Eksperti"));
check("njoftimi hap 'Pyetjet e mia' (type + id), pa asnjë gjurmë të prindit te eksperti", notif[0].data.type === "expert_answer" && notif[0].data.questionId === q1);

// --- Prindi e lexon përgjigjen
await as(mom);
let row = await one(`select status, answer, expert_id, answered_at, answer_read_at from public.expert_questions where id = $1`, [q1]);
check("statusi 'answered', me orë dhe ekspert", row.status === "answered" && row.answer === ANSWER && row.expert_id === drB && !!row.answered_at);
check("e palexuar (pika e kuqe)", row.answer_read_at === null);
await db.query(`select public.mark_answer_read($1)`, [q1]);
check("pas hapjes: e lexuar", (await one(`select answer_read_at from public.expert_questions where id = $1`, [q1])).answer_read_at !== null);
check("s'mbyllet dot pasi ka përgjigje", (await one(`select public.close_expert_question($1) as ok`, [q1])).ok === false);

// --- Mbyllja
check("prindi e mbyll pyetjen në pritje", (await one(`select public.close_expert_question($1) as ok`, [q2])).ok === true);
await as(lac);
check("e mbyllura s'i del më ekspertit", (await all(`select id from public.list_expert_inbox()`)).length === 0);
check("as s'i përgjigjet dot", (await fails(`select public.answer_expert_question($1, repeat('m', 30))`, [q2]))?.includes("closed"));

// --- Gjuha e njoftimit dhe eksperti si prind
await as(dad);
const qd = (await one(`select public.ask_expert_question('pediatrician', $1) as id`, [Q + " nga babi"])).id;
await as(drA);
await db.query(`select public.claim_expert_question($1)`, [qd]);
await db.query(`select public.answer_expert_question($1, $2)`, [qd, ANSWER]);
await db.exec("reset role");
check("njoftimi në anglisht kur prindi ka zgjedhur anglishten", (await one(`select title from public.notification_outbox where user_id = $1`, [dad])).title.startsWith("An expert"));

await as(drA);
const own = (await one(`select public.ask_expert_question('pediatrician', $1) as id`, [Q + " nga mjeku"])).id;
check("pyetja ime si prind s'më del në radhë", !(await all(`select id from public.list_expert_inbox()`)).some((r) => r.id === own));
check("as s'e marr dot", (await one(`select public.claim_expert_question($1) as ok`, [own])).ok === false);
await as(mom);
check("jo-eksperti s'merr pyetje", (await fails(`select public.claim_expert_question($1)`, [own]))?.includes("not_an_expert"));
await as(null);
check("pa llogari: s'pyet", !!(await fails(`select public.ask_expert_question('pediatrician', $1)`, [Q])));

console.log(`\n${pass} OK, ${fail} gabime`);
process.exit(fail ? 1 : 0);
