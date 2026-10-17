/**
 * Prova e tabelës `pregnancy_weeks` (PGlite): bosh, e lexueshme për të gjithë, e shkruajtshme vetëm nga admini.
 * Nisja:  node supabase/tests/pregnancy.test.mjs   (me @electric-sql/pglite të instaluar)
 */
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";

const MIGRATION = new URL("../migrations/20261021090400_age_system_05_pregnancy.sql", import.meta.url);
const db = new PGlite();
process.on("uncaughtException", (e) => { console.log("GABIM i papritur:", String(e.message).slice(0, 300)); process.exit(1); });

await db.exec(`
create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
create role anon; create role authenticated;
grant usage on schema public, auth to anon, authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated;
create table public.admins (user_id uuid primary key);
create function public.is_admin() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = (select auth.uid()));
$$;
grant execute on function public.is_admin() to anon, authenticated;
`);
for (const name of ["i pari", "i dyti"]) {
  try { await db.exec(fs.readFileSync(MIGRATION, "utf8")); console.log(`OK  migrimi (${name})`); }
  catch (e) { console.log("GABIM te migrimi:", e.message); process.exit(1); }
}

let pass = 0, fail = 0;
const check = (name, ok) => { (ok ? pass++ : fail++); console.log((ok ? "OK  " : "GABIM ") + name); };
const as = async (uid) => { await db.exec(`reset role; select set_config('test.uid', '${uid ?? ""}', false); ${uid ? "set role authenticated;" : "set role anon;"}`); };
const fails = async (q) => { try { await db.query(q); return false; } catch { return true; } };
const admin = "11111111-1111-1111-1111-111111111111", user = "22222222-2222-2222-2222-222222222222";

await db.exec("reset role");
check("tabela nis bosh (pa përmbajtje mjekësore të shpikur)", (await db.query(`select count(*)::int n from public.pregnancy_weeks`)).rows[0].n === 0);
await db.query(`insert into public.admins values ($1)`, [admin]);
await as(user);
check("përdoruesi s'shkruan dot", await fails(`insert into public.pregnancy_weeks (lang, week_from, week_to, title, body) values ('sq', 1, 1, 'T', 'B')`));
await as(admin);
await db.query(`insert into public.pregnancy_weeks (lang, week_from, week_to, title, body, ideas) values ('sq', 12, 13, 'Java 12', 'Teksti', array['Ide'])`);
check("admini shton një javë", (await db.query(`select count(*)::int n from public.pregnancy_weeks`)).rows[0].n === 1);
check("java jashtë 1–42 refuzohet", await fails(`insert into public.pregnancy_weeks (lang, week_from, week_to, title, body) values ('sq', 50, 50, 'T', 'B')`));
await as(null);
check("kushdo e lexon javën aktive", (await db.query(`select title from public.pregnancy_weeks where lang = 'sq' and week_from <= 12 and week_to >= 12`)).rows[0]?.title === "Java 12");

console.log(`\n${pass} OK, ${fail} gabime`);
process.exit(fail ? 1 : 0);
