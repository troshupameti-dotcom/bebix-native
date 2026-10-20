/**
 * Prova e "Ekipi sot" dhe e kujtesave sipas fëmijës aktiv (PGlite).
 * Nisja:  node supabase/tests/home-reminders.test.mjs   (me @electric-sql/pglite të instaluar)
 */
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";

// Si Supabase pas 30 tetorit 2026: tabelat e reja s'marrin më leje vetë (tabelat bazë më lart i kanë, si në prodhim).
// Kështu testi kap çdo tabelë të re pa GRANT, që në prodhim do të jepte "permission denied".
const AFTER_OCT_30 = "create role service_role bypassrls; alter default privileges in schema public revoke all on tables from anon, authenticated;";

const CHILDREN = new URL("../migrations/20261021090000_age_system_01_children.sql", import.meta.url);
const HOME = new URL("../migrations/20261021090300_age_system_04_home_reminders.sql", import.meta.url);
const db = new PGlite();
process.on("uncaughtException", (e) => { console.log("GABIM i papritur:", String(e.message).slice(0, 300)); process.exit(1); });

await db.exec(`
create schema auth;
create table auth.users (id uuid primary key default gen_random_uuid(), email text);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
create role anon; create role authenticated;
grant usage on schema public, auth to anon, authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated;
create table public.baby_household_members (owner_id uuid, member_id uuid, role text default 'parent');
create function public.my_data_owner() returns uuid language sql stable security definer set search_path = public as $$
  select coalesce((select owner_id from public.baby_household_members where member_id = (select auth.uid()) limit 1), (select auth.uid()));
$$;
create function public.can_access_baby_data(p_owner uuid) returns boolean language sql stable security definer set search_path = public as $$
  select p_owner = (select auth.uid()) or exists (select 1 from public.baby_household_members m where m.owner_id = p_owner and m.member_id = (select auth.uid()) and m.role = 'parent');
$$;
create function public.can_view_baby_data(p_owner uuid) returns boolean language sql stable security definer set search_path = public as $$
  select p_owner = (select auth.uid()) or exists (select 1 from public.baby_household_members m where m.owner_id = p_owner and m.member_id = (select auth.uid()));
$$;
grant execute on function public.my_data_owner(), public.can_access_baby_data(uuid), public.can_view_baby_data(uuid) to authenticated;
create table public.baby_profiles (user_id uuid primary key, baby_name text, baby_dob date, updated_at timestamptz,
  parent_name text, baby_photo_path text, parent_photo_path text, details jsonb not null default '{}'::jsonb);
create table public.baby_records (user_id uuid not null, id text not null, baby_id text, kind text not null, payload jsonb not null default '{}',
  occurred_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  deleted_at timestamptz, archived_at timestamptz, created_by uuid, primary key (user_id, id));
`);
await db.exec(AFTER_OCT_30);
for (const [name, file] of [["fëmijët", CHILDREN], ["kreu dhe kujtesat", HOME], ["kreu dhe kujtesat (sërish)", HOME]]) {
  try { await db.exec(fs.readFileSync(file, "utf8")); console.log(`OK  migrimi: ${name}`); }
  catch (e) { console.log(`GABIM te migrimi ${name}:`, e.message); process.exit(1); }
}

let pass = 0, fail = 0;
const check = (name, ok, extra = "") => { (ok ? pass++ : fail++); console.log((ok ? "OK  " : "GABIM ") + name + (extra ? "  -> " + extra : "")); };
const one = async (q, p) => (await db.query(q, p)).rows[0];
const all = async (q, p) => (await db.query(q, p)).rows;
const as = async (uid) => { await db.exec(`reset role; select set_config('test.uid', '${uid ?? ""}', false); ${uid ? "set role authenticated;" : "set role anon;"}`); };
const mk = async (e) => (await one(`insert into auth.users (email) values ($1) returning id`, [e])).id;

await db.exec("reset role");
const mom = await mk("mami@x"), dad = await mk("babi@x");
await db.query(`insert into public.baby_household_members (owner_id, member_id) values ($1, $2)`, [mom, dad]);
await db.query(`insert into public.user_plans (user_id, plan) values ($1, 'premium')`, [mom]);
await as(mom);
const ana = (await one(`select public.add_child('Ana', current_date - 200) id`)).id;
const ben = (await one(`select public.add_child('Ben', current_date - 2000) id`)).id;
await db.exec("reset role");
const rec = async (id, child, kind, minutesAgo, by) =>
  db.query(`insert into public.baby_records (user_id, id, baby_id, kind, occurred_at, created_by) values ($1, $2, $3, $4, now() - ($5 || ' minutes')::interval, $6)`,
    [mom, id, child, kind, String(minutesAgo), by]);
await rec("a1", ana, "feeding", 300, mom);
await rec("a2", ana, "diaper", 60, dad);
await rec("b1", ben, "feeding", 30, mom);
await rec("b2", ben, "feeding", 20, mom);

// --- Ekipi sot ------------------------------------------------------------------
await as(mom);
const sum = async () => (await all(`select kind, sum(n)::int n from public.household_day_summary(now() - interval '1 day', now() + interval '1 hour') group by kind order by kind`));
const anaDay = await sum();
check("Ana aktive: 1 ushqyerje dhe 1 pelenë (jo ushqyerjet e Benit)", JSON.stringify(anaDay) === JSON.stringify([{ kind: "diaper", n: 1 }, { kind: "feeding", n: 1 }]), JSON.stringify(anaDay));
await db.query(`select public.set_active_child($1)`, [ben]);
check("Beni aktiv: 2 ushqyerje, pa pelenën e Anës", JSON.stringify(await sum()) === JSON.stringify([{ kind: "feeding", n: 2 }]));

// --- Kujtesat ------------------------------------------------------------------
await db.exec("reset role");
const latest = await all(`select baby_id, id from public.latest_baby_record_per_child('feeding', now() - interval '1 day') order by id`);
check("ushqyerja e fundit për ÇDO fëmijë (jo një për familje)", latest.length === 2 && latest.find((r) => r.baby_id === ben).id === "b2" && latest.find((r) => r.baby_id === ana).id === "a1", JSON.stringify(latest));
const recips = await all(`select user_id, child_id, birth_date from public.reminder_recipients(array[$1]::uuid[])`, [mom]);
check("marrësit: mami me Benin aktiv, babi me Anën (falas, parazgjedhja)",
  recips.length === 2 && recips.find((r) => r.user_id === mom).child_id === ben && recips.find((r) => r.user_id === dad).child_id === ana, JSON.stringify(recips));
check("marrësit kanë datat e fëmijës (për fazën)", recips.every((r) => r.birth_date !== null));
await as(mom);
check("klienti s'i thërret dot funksionet e kujtesave", (await (async () => { try { await db.query(`select * from public.reminder_recipients(array[$1]::uuid[])`, [mom]); return false; } catch { return true; } })()));

console.log(`\n${pass} OK, ${fail} gabime`);
process.exit(fail ? 1 : 0);
