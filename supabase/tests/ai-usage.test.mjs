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
create role anon; create role authenticated;
grant usage on schema public, auth to anon, authenticated;
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

console.log(`\n${pass} OK, ${fail} gabime`);
process.exit(fail ? 1 : 0);
