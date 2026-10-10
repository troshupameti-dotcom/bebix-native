/**
 * Prova e "Pyetja e ditës" në një Postgres lokal (PGlite).
 * Nisja:  node supabase/tests/daily-questions.test.mjs   (me @electric-sql/pglite të instaluar)
 */
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";

const MIGRATION = new URL("../migrations/20261013090000_daily_questions.sql", import.meta.url);
const db = new PGlite();
process.on("uncaughtException", (e) => { console.log("GABIM i papritur:", String(e.message).slice(0, 300)); process.exit(1); });

// Si në prodhim: auth, rolet, adminët, ekspertët dhe emri i autorit i komuniteteve.
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
create table public.community_experts (user_id uuid, name text);
create function public.community_author_name(p_author uuid, p_requested text) returns text language plpgsql stable security definer set search_path = public as $$
declare v_expert_name text; v_name text := left(regexp_replace(btrim(coalesce(p_requested, '')), '\\s+', ' ', 'g'), 60);
begin
  select name into v_expert_name from public.community_experts where user_id = p_author;
  if v_expert_name is not null then return v_expert_name; end if;
  if v_name = '' then return 'Prind'; end if;
  return v_name;
end; $$;
revoke execute on function public.community_author_name(uuid, text) from public, anon, authenticated;
`);
try { await db.exec(fs.readFileSync(MIGRATION, "utf8")); console.log("OK  migrimi u ekzekutua pa gabime"); }
catch (e) { console.log("GABIM te migrimi:", e.message); process.exit(1); }

let pass = 0, fail = 0;
const check = (name, ok, extra = "") => { (ok ? pass++ : fail++); console.log((ok ? "OK  " : "GABIM ") + name + (extra ? "  -> " + extra : "")); };
const one = async (q, p) => (await db.query(q, p)).rows[0];
const as = async (uid) => { await db.exec(`reset role; select set_config('test.uid', '${uid ?? ""}', false); ${uid ? "set role authenticated;" : "set role anon;"}`); };
const fails = async (q, p) => { try { await db.query(q, p); return null; } catch (e) { return e.message; } };

await db.exec("reset role");
const mk = async (e) => (await one(`insert into auth.users (email) values ($1) returning id`, [e])).id;
const mom = await mk("mami@x"), dad = await mk("babi@x"), doc = await mk("dr@x"), admin = await mk("admin@x");
await db.query(`insert into public.admins values ($1)`, [admin]);
await db.query(`insert into public.community_experts values ($1, 'Dr. Arta')`, [doc]);
check("14 pyetje fillestare", (await one(`select count(*)::int c from public.daily_questions`)).c === 14);

// Leximi: e sotmja po; e ardhshmja (pas nesër) jo
await as(null);
const today = await one(`select id, text_sq from public.daily_questions where active_date = current_date`);
check("pyetja e sotme lexohet pa llogari", !!today?.id, today?.text_sq);
check("pyetjet pas nesër s'shihen para kohe", (await one(`select count(*)::int c from public.daily_questions where active_date > current_date + 1`)).c === 0);
await as(admin);
check("admini i sheh të gjitha", (await one(`select count(*)::int c from public.daily_questions`)).c === 14);

// Përgjigjet
await as(mom);
await db.query(`insert into public.daily_question_answers (question_id, author_id, author_name, text) values ($1, $2, '', '  Banjë e ngrohtë dhe këngë  ')`, [today.id, mom]);
let a = await one(`select author_name, text from public.daily_question_answers where author_id = $1`, [mom]);
check("pa emër: 'Prind'; teksti pastrohet", a.author_name === "Prind" && a.text === "Banjë e ngrohtë dhe këngë", JSON.stringify(a));
check("një përgjigje për prind", !!(await fails(`insert into public.daily_question_answers (question_id, author_id, text) values ($1, $2, 'e dyta')`, [today.id, mom])));
await db.query(`insert into public.daily_question_answers (question_id, author_id, text) values ($1, $2, 'Libër me figura') on conflict (question_id, author_id) do update set text = excluded.text`, [today.id, mom]);
check("përgjigja ndryshohet (upsert)", (await one(`select text from public.daily_question_answers where author_id = $1`, [mom])).text === "Libër me figura");
await db.query(`update public.daily_question_answers set author_name = 'Dr. Fals', text = 'Libër dhe gjumë' where author_id = $1`, [mom]);
a = await one(`select author_name, text from public.daily_question_answers where author_id = $1`, [mom]);
check("ndryshimi prek vetëm tekstin (emri s'falsifikohet)", a.author_name === "Prind" && a.text === "Libër dhe gjumë");
check("mbi 280 shkronja refuzohet", !!(await fails(`update public.daily_question_answers set text = repeat('a', 281) where author_id = $1`, [mom])));
check("bosh refuzohet", !!(await fails(`update public.daily_question_answers set text = '   ' where author_id = $1`, [mom])));
check("s'përgjigjet në emër të tjetrit", !!(await fails(`insert into public.daily_question_answers (question_id, author_id, text) values ($1, $2, 'x')`, [today.id, dad])));

await as(doc);
await db.query(`insert into public.daily_question_answers (question_id, author_id, author_name, text) values ($1, $2, 'Emër tjetër', 'Rutinë e njëjtë çdo natë')`, [today.id, doc]);
check("eksperti del me emrin e verifikuar", (await one(`select author_name from public.daily_question_answers where author_id = $1`, [doc])).author_name === "Dr. Arta");

await as(dad);
check("babi s'e ndryshon përgjigjen e mamit", (await db.query(`update public.daily_question_answers set text = 'hack' where author_id = $1 returning id`, [mom])).rows.length === 0);
check("babi s'e fshin përgjigjen e mamit", (await db.query(`delete from public.daily_question_answers where author_id = $1 returning id`, [mom])).rows.length === 0);
await as(null);
check("përgjigjet lexohen nga të gjithë", (await one(`select count(*)::int c from public.daily_question_answers`)).c === 2);

// Pyetjet e vjetra s'pranojnë përgjigje
await db.exec("reset role");
const old = (await one(`insert into public.daily_questions (text_sq, active_date) values ('Pyetje e vjetër këtu', current_date - 5) returning id`)).id;
await as(dad);
check("pyetja e vjetër s'pranon përgjigje të reja", (await fails(`insert into public.daily_question_answers (question_id, author_id, text) values ($1, $2, 'vonë')`, [old, dad]))?.includes("s'pranon"));
check("prindi s'shton pyetje", !!(await fails(`insert into public.daily_questions (text_sq, active_date) values ('Pyetja ime e re', current_date + 30)`)));

await as(mom);
await db.query(`delete from public.daily_question_answers where author_id = $1`, [mom]);
check("autori e fshin përgjigjen e vet", (await one(`select count(*)::int c from public.daily_question_answers where author_id = $1`, [mom])).c === 0);

await db.exec("reset role");
await db.exec(fs.readFileSync(MIGRATION, "utf8"));
check("ri-ekzekutimi s'dyfishon pyetjet", (await one(`select count(*)::int c from public.daily_questions`)).c === 15);

console.log(`\n${pass} OK, ${fail} gabime`);
process.exit(fail ? 1 : 0);
