/**
 * Prova e komunitetit për familjen (grupet e reja të moshës, shtatzënia, fëmija aktiv) në PGlite.
 * Ekzekuton me radhë: grupet automatike → fëmijët → komuniteti sipas moshës.
 * Nisja:  node supabase/tests/community-age.test.mjs   (me @electric-sql/pglite të instaluar)
 */
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";

// Si Supabase pas 30 tetorit 2026: tabelat e reja s'marrin më leje vetë (tabelat bazë më lart i kanë, si në prodhim).
// Kështu testi kap çdo tabelë të re pa GRANT, që në prodhim do të jepte "permission denied".
const AFTER_OCT_30 = "create role service_role bypassrls; alter default privileges in schema public revoke all on tables from anon, authenticated;";

const AUTO = new URL("../migrations/20261015090000_auto_groups.sql", import.meta.url);
const CHILDREN = new URL("../migrations/20261021090000_age_system_01_children.sql", import.meta.url);
const COMMUNITY = new URL("../migrations/20261021090200_age_system_03_community.sql", import.meta.url);
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
  updated_at timestamptz not null default now(), primary key (user_id, id));

create table public.community_groups (id uuid primary key default gen_random_uuid(), name text not null, description text not null default '',
  icon text not null default 'family', accent text not null default 'olive', created_at timestamptz not null default now(), member_count int not null default 0);
alter table public.community_groups enable row level security;
create policy community_groups_public_read on public.community_groups for select using (true);
create table public.community_group_members (id uuid primary key default gen_random_uuid(), group_id uuid not null references public.community_groups(id) on delete cascade,
  user_id uuid not null, joined_at timestamptz not null default now(), unique (group_id, user_id));
alter table public.community_group_members enable row level security;
create policy community_group_members_self_read on public.community_group_members for select to authenticated using (user_id = (select auth.uid()));
create policy community_group_members_self_delete on public.community_group_members for delete using ((select auth.uid()) = user_id);
create table public.community_posts (id uuid primary key default gen_random_uuid(), author_id uuid not null, text text not null, group_id uuid);
insert into public.community_groups (name) values ('Gjidhënia');
`);

await db.exec(AFTER_OCT_30);
for (const [name, file] of [["grupet automatike", AUTO], ["fëmijët", CHILDREN], ["komuniteti sipas moshës", COMMUNITY], ["komuniteti (sërish)", COMMUNITY]]) {
  try { await db.exec(fs.readFileSync(file, "utf8")); console.log(`OK  migrimi: ${name}`); }
  catch (e) { console.log(`GABIM te migrimi ${name}:`, e.message); process.exit(1); }
}

let pass = 0, fail = 0;
const check = (name, ok, extra = "") => { (ok ? pass++ : fail++); console.log((ok ? "OK  " : "GABIM ") + name + (extra ? "  -> " + extra : "")); };
const one = async (q, p) => (await db.query(q, p)).rows[0];
const all = async (q, p) => (await db.query(q, p)).rows;
const as = async (uid) => { await db.exec(`reset role; select set_config('test.uid', '${uid ?? ""}', false); ${uid ? "set role authenticated;" : "set role anon;"}`); };
const fails = async (q, p) => { try { await db.query(q, p); return null; } catch (e) { return e.message; } };
const keysFor = async (dob, today) => (await one(`select public.community_auto_keys_for($1::date, $2::date) k`, [dob, today])).k;

await db.exec("reset role");
const keys = (await all(`select auto_key from public.community_groups where kind = 'age' order by auto_key`)).map((r) => r.auto_key);
check("9 grupe moshe: 4 të vjetrat, 4 të rejat dhe shtatzënia", keys.length === 9 && ["age:24-36", "age:36-72", "age:72-120", "age:120-156", "pregnancy"].every((k) => keys.includes(k)), keys.join(","));
check("dy ekzekutime s'krijojnë dublikata", (await one(`select count(*)::int n from public.community_groups where auto_key = 'age:24-36'`)).n === 1);
check("grupi i temës mbetet 'topic'", (await one(`select kind from public.community_groups where name = 'Gjidhënia'`)).kind === "topic");

// --- Kufijtë e rinj -----------------------------------------------------------
const age = async (dob) => (await keysFor(dob, "2026-10-17"))[0] ?? null;
check("23 muaj → 12-24; 24 muaj → 24-36 (boshllëku u mbyll)", (await age("2024-10-18")) === "age:12-24" && (await age("2024-10-17")) === "age:24-36");
check("35 → 24-36; 36 → 36-72", (await age("2023-10-18")) === "age:24-36" && (await age("2023-10-17")) === "age:36-72");
check("71 → 36-72; 72 → 72-120", (await age("2020-10-18")) === "age:36-72" && (await age("2020-10-17")) === "age:72-120");
check("119 → 72-120; 120 → 120-156", (await age("2016-10-18")) === "age:72-120" && (await age("2016-10-17")) === "age:120-156");
check("155 → 120-156; 156 (13 vjeç) → asnjë grup, as i lindjes", (await age("2013-10-18")) === "age:120-156"
  && (await keysFor("2013-10-17", "2026-10-17")).length === 0);

// --- Fëmija aktiv vendos sugjerimin -----------------------------------------
const mk = async (e) => (await one(`insert into auth.users (email) values ($1) returning id`, [e])).id;
const mom = await mk("mami@x"), dad = await mk("babi@x");
await db.query(`insert into public.baby_household_members (owner_id, member_id, role) values ($1, $2, 'parent')`, [mom, dad]);
await db.query(`insert into public.user_plans (user_id, plan) values ($1, 'premium')`, [mom]);
await as(mom);
const today = (await one(`select (now() at time zone 'Europe/Belgrade')::date::text d`)).d;
const minusMonths = async (m) => (await one(`select ($1::date - ($2 || ' months')::interval)::date::text d`, [today, String(m)])).d;
const big = (await one(`select public.add_child('Ana', $1::date) id`, [await minusMonths(50)])).id;
const baby = (await one(`select public.add_child('Ben', $1::date) id`, [await minusMonths(4)])).id;
const suggest = async () => (await all(`select * from public.suggest_community_groups()`)).filter((s) => s.action === "join").map((s) => s.auto_key);
check("mami (aktiv Ana, 4 vjeç) → 3–5 vjeç", (await suggest()).includes("age:36-72"));
await db.query(`select public.set_active_child($1)`, [baby]);
check("mami kalon te Beni (4 muaj) → 3–6 muaj; jo grupi i Anës", (await suggest()).includes("age:3-6") && !(await suggest()).includes("age:36-72"));
await as(dad);
check("babi (fëmija i tij aktiv mbetet Ana) → 3–5 vjeç", (await suggest()).includes("age:36-72"));
check("babi s'bashkohet dot te grupi i Benit (s'është fëmija i tij aktiv)", /not_your_group/.test(await fails(`select public.join_suggested_group('age:3-6')`) ?? ""));
await db.query(`select public.join_suggested_group('age:36-72')`);
check("babi bashkohet te 3–5 vjeç", (await all(`select 1 from public.community_group_members m join public.community_groups g on g.id = m.group_id where g.auto_key = 'age:36-72'`)).length === 1);

// --- Shtatzënia ----------------------------------------------------------------
await db.exec("reset role");
const preg = await mk("shtatzene@x");
await as(preg);
await db.query(`select public.add_child('Bebi', null, current_date + 100)`);
check("shtatzëna → vetëm 'Presim bebe'", JSON.stringify(await suggest()) === JSON.stringify(["pregnancy"]));
await db.query(`select public.join_suggested_group('pregnancy')`);
check("shtatzëna bashkohet te 'Presim bebe'", (await all(`select 1 from public.community_group_members m join public.community_groups g on g.id = m.group_id where g.auto_key = 'pregnancy'`)).length === 1);

// --- Familje e vjetër pa fëmijë te tabela e re: si më parë --------------------
await db.exec("reset role");
const old = await mk("i-vjeter@x");
await db.query(`delete from public.children where owner_id = $1`, [old]);
await db.query(`alter table public.baby_profiles disable trigger baby_profiles_mirror_to_child`);
await db.query(`insert into public.baby_profiles (user_id, baby_dob) values ($1, $2::date)`, [old, await minusMonths(30)]);
await db.query(`alter table public.baby_profiles enable trigger baby_profiles_mirror_to_child`);
await as(old);
check("pa rresht te children: bebi i baby_profiles (2–3 vjeç)", (await suggest()).includes("age:24-36"));

console.log(`\n${pass} OK, ${fail} gabime`);
process.exit(fail ? 1 : 0);
