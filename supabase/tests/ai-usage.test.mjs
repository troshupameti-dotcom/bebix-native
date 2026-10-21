/**
 * Prova e kufirit ditor të AI-së (PGlite): numërohet deri te kufiri, pastaj refuzon; klienti s'e prek tabelën as
 * funksionin; migrimi ekzekutohet dy herë pa gabim.
 * Nisja:  node supabase/tests/ai-usage.test.mjs   (me @electric-sql/pglite të instaluar)
 */
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";

// Si Supabase pas 30 tetorit 2026: tabelat e reja s'marrin më leje vetë.
const AFTER_OCT_30 = "create role service_role bypassrls; alter default privileges in schema public revoke all on tables from anon, authenticated;";

const MIGRATION = new URL("../migrations/20261023090000_ai_usage.sql", import.meta.url);
const db = new PGlite();
process.on("uncaughtException", (e) => { console.log("GABIM i papritur:", String(e.message).slice(0, 300)); process.exit(1); });

await db.exec(`
create schema auth;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
create role anon; create role authenticated;
grant usage on schema public, auth to anon, authenticated;
create table public.admins (user_id uuid primary key);
create function public.is_admin() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = (select auth.uid()));
$$;
grant execute on function public.is_admin() to anon, authenticated;
`);
await db.exec(AFTER_OCT_30);
await db.exec("grant usage on schema public, auth to service_role;");
for (const name of ["i pari", "i dyti"]) {
  try { await db.exec(fs.readFileSync(MIGRATION, "utf8")); console.log(`OK  migrimi (${name})`); }
  catch (e) { console.log("GABIM te migrimi:", e.message); process.exit(1); }
}

let pass = 0, fail = 0;
const check = (name, ok) => { (ok ? pass++ : fail++); console.log((ok ? "OK  " : "GABIM ") + name); };
const fails = async (q) => { try { await db.query(q); return false; } catch { return true; } };
const user = "22222222-2222-2222-2222-222222222222";
await db.query(`insert into auth.users values ($1)`, [user]);

await db.exec("set role service_role");
const take = async () => (await db.query(`select public.ai_take_quota($1, 3) as ok`, [user])).rows[0].ok;
const results = [await take(), await take(), await take(), await take()];
check("tri pyetje lejohen, e katërta jo (kufiri 3)", JSON.stringify(results) === JSON.stringify([true, true, true, false]));
check("numëruesi mbetet te kufiri", (await db.query(`select count from public.ai_usage where user_id = $1`, [user])).rows[0].count === 3);
check("kufi i pavlefshëm: refuzohet", (await db.query(`select public.ai_take_quota($1, 0) as ok`, [user])).rows[0].ok === false);

await db.exec("reset role; set role authenticated");
check("i kyçuri s'e lexon tabelën", await fails(`select * from public.ai_usage`));
check("i kyçuri s'e thërret funksionin (s'ia rrit dot kufirin vetes as tjetrit)", await fails(`select public.ai_take_quota('${user}', 100)`));
await db.exec("reset role; set role anon");
check("mysafiri s'e lexon tabelën", await fails(`select * from public.ai_usage`));

// Raportimet e përgjigjeve.
const admin = "11111111-1111-1111-1111-111111111111", other = "33333333-3333-3333-3333-333333333333";
await db.exec("reset role");
await db.query(`insert into auth.users values ($1), ($2)`, [admin, other]);
await db.query(`insert into public.admins values ($1)`, [admin]);
const as = async (uid) => { await db.exec(`reset role; select set_config('test.uid', '${uid ?? ""}', false); ${uid ? "set role authenticated;" : "set role anon;"}`); };
const report = (extra = "") => `insert into public.ai_reports (question, answer, reason${extra ? ", note" : ""}) values ('Sa gjumë?', 'Rreth 14 orë.', 'wrong'${extra ? `, '${extra}'` : ""})`;
await as(user);
check("prindi raporton një përgjigje", !(await fails(report("E pasaktë"))));
check("prindi s'i lexon raportimet (as të vetat)", (await db.query(`select count(*)::int n from public.ai_reports`)).rows[0].n === 0);
check("prindi s'raporton në emër të tjetrit", await fails(`insert into public.ai_reports (user_id, question, answer, reason) values ('${other}', 'q', 'a', 'wrong')`));
check("prindi s'e shënon vetë si të shqyrtuar", await fails(`insert into public.ai_reports (question, answer, reason, status) values ('q', 'a', 'wrong', 'reviewed')`));
check("arsye e panjohur refuzohet", await fails(`insert into public.ai_reports (question, answer, reason) values ('q', 'a', 'spam')`));
await as(null);
check("mysafiri s'raporton", await fails(report()));
await as(admin);
check("admini i lexon raportimet", (await db.query(`select count(*)::int n from public.ai_reports`)).rows[0].n === 1);
await db.query(`update public.ai_reports set status = 'reviewed'`);
check("admini e shënon të shqyrtuar", (await db.query(`select status from public.ai_reports`)).rows[0].status === "reviewed");
check("admini s'e ndryshon përmbajtjen e raportimit", await fails(`update public.ai_reports set answer = 'tjetër'`));

console.log(`\n${pass} OK, ${fail} gabime`);
process.exit(fail ? 1 : 0);
