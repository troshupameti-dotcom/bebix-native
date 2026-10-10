/**
 * Prova e "kujdesi për prindin" në një Postgres lokal (PGlite).
 * Nisja:  node supabase/tests/parent-care.test.mjs   (me @electric-sql/pglite të instaluar)
 */
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";

const MIGRATION = new URL("../migrations/20261012090000_parent_care.sql", import.meta.url);
const db = new PGlite();
process.on("uncaughtException", (e) => { console.log("GABIM i papritur:", String(e.message).slice(0, 300)); process.exit(1); });

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
const mom = await mk("mami@x"), dad = await mk("babi@x"), admin = await mk("admin@x");
await db.query(`insert into public.admins values ($1)`, [admin]);

// --- Si je sot? (privat)
await as(mom);
await db.query(`insert into public.parent_checkins (day, mood, note) values (current_date, 2, 'E lodhur')`);
await db.query(`insert into public.parent_checkins (day, mood) values (current_date, 4) on conflict (user_id, day) do update set mood = excluded.mood`);
check("mami e sheh check-in-in e vet", (await one(`select mood from public.parent_checkins`)).mood === 4);
check("notat jashtë 1–5 refuzohen", !!(await fails(`insert into public.parent_checkins (day, mood) values (current_date - 1, 6)`)));
check("s'shkruan dot për dikë tjetër", !!(await fails(`insert into public.parent_checkins (user_id, day, mood) values ($1, current_date, 3)`, [dad])));
await as(dad);
check("partneri s'e sheh", (await one(`select count(*)::int c from public.parent_checkins`)).c === 0);
await as(admin);
check("as admini s'e sheh nga app-i", (await one(`select count(*)::int c from public.parent_checkins`)).c === 0);
await as(null);
check("pa llogari: asgjë", (await fails(`select * from public.parent_checkins`)) !== null || (await one(`select count(*)::int c from public.parent_checkins`)).c === 0);

// --- Kalendari i zhvillimit
await as(null);
const rows = await all(`select lang, week_from, week_to from public.development_weeks order by lang, week_from`);
check("përmbajtja fillestare: 16 periudha × 2 gjuhë", rows.length === 32, String(rows.length));
for (const lang of ["sq", "en"]) {
  const list = rows.filter((r) => r.lang === lang);
  let ok = list[0]?.week_from === 0;
  for (let i = 1; i < list.length; i++) if (list[i].week_from !== list[i - 1].week_to + 1) ok = false;
  check(`${lang}: javët 0–104 pa vrima`, ok && list[list.length - 1].week_to === 104);
}
const w13 = await one(`select title, array_length(ideas, 1) n from public.development_weeks where lang = 'sq' and 13 between week_from and week_to`);
check("java 13: 'Kap sende' me 3 ide", w13?.title === "Kap sende" && w13.n === 3, JSON.stringify(w13));

await as(mom);
check("prindi s'e ndryshon kalendarin", (await all(`update public.development_weeks set title = 'X' returning id`)).length === 0);
check("prindi s'shton periudha", !!(await fails(`insert into public.development_weeks (lang, week_from, week_to, title, body, ideas) values ('sq', 200, 201, 'a', 'b', array['c'])`)));
await as(admin);
await db.query(`update public.development_weeks set title = 'Kap dhe shtrëngon' where lang = 'sq' and week_from = 12`);
check("admini e ndryshon", (await one(`select title from public.development_weeks where lang = 'sq' and week_from = 12`)).title === "Kap dhe shtrëngon");
await db.query(`update public.development_weeks set is_active = false where lang = 'en' and week_from = 12`);
await as(null);
check("periudha e fikur s'del te përdoruesit", (await one(`select count(*)::int c from public.development_weeks where lang = 'en' and week_from = 12`)).c === 0);

// Ri-ekzekutimi i migrimit s'i mbishkruan ndryshimet e adminit
await db.exec("reset role");
await db.exec(fs.readFileSync(MIGRATION, "utf8"));
check("ri-ekzekutimi i ruan ndryshimet e adminit", (await one(`select title from public.development_weeks where lang = 'sq' and week_from = 12`)).title === "Kap dhe shtrëngon");

console.log(`\n${pass} OK, ${fail} gabime`);
process.exit(fail ? 1 : 0);
