/**
 * Prova e grupeve sipas moshës/kohës së lindjes në një Postgres lokal (PGlite).
 * Nisja:  node supabase/tests/auto-groups.test.mjs   (me @electric-sql/pglite të instaluar)
 */
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";

const MIGRATION = new URL("../migrations/20261015090000_auto_groups.sql", import.meta.url);
const db = new PGlite();
process.on("uncaughtException", (e) => { console.log("GABIM i papritur:", String(e.message).slice(0, 300)); process.exit(1); });

// Gjendja e prodhimit para migrimit (sa i duhet testit).
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
create table public.baby_household_members (owner_id uuid, member_id uuid, role text default 'parent');
create function public.my_data_owner() returns uuid language sql stable security definer set search_path = public as $$
  select coalesce((select owner_id from public.baby_household_members where member_id = (select auth.uid()) limit 1), (select auth.uid()));
$$;
-- Si pas Fazës 3: vetëm prindërit (jo shikuesit/gjyshërit).
create function public.can_access_baby_data(p_owner uuid) returns boolean language sql stable security definer set search_path = public as $$
  select p_owner = (select auth.uid()) or exists (select 1 from public.baby_household_members m where m.owner_id = p_owner and m.member_id = (select auth.uid()) and m.role = 'parent');
$$;
grant execute on function public.is_admin(), public.my_data_owner(), public.can_access_baby_data(uuid) to authenticated;
create table public.baby_profiles (user_id uuid primary key, baby_name text, baby_dob date);

create table public.community_groups (id uuid primary key default gen_random_uuid(), name text not null, description text not null default '',
  icon text not null default 'family', accent text not null default 'olive', created_at timestamptz not null default now(), member_count int not null default 0);
alter table public.community_groups enable row level security;
create policy community_groups_public_read on public.community_groups for select using (true);
create table public.community_group_members (id uuid primary key default gen_random_uuid(), group_id uuid not null references public.community_groups(id) on delete cascade,
  user_id uuid not null, joined_at timestamptz not null default now(), unique (group_id, user_id));
alter table public.community_group_members enable row level security;
create policy community_group_members_self_read on public.community_group_members for select to authenticated using (user_id = (select auth.uid()));
create policy community_group_members_self_insert on public.community_group_members for insert with check ((select auth.uid()) = user_id);
create policy community_group_members_self_delete on public.community_group_members for delete using ((select auth.uid()) = user_id);
create table public.community_posts (id uuid primary key default gen_random_uuid(), author_id uuid not null, text text not null, group_id uuid);
alter table public.community_posts enable row level security;
create policy community_posts_self_insert on public.community_posts for insert with check ((select auth.uid()) = author_id);
create policy community_posts_public_read on public.community_posts for select using (true);
insert into public.community_groups (name) values ('Gjidhënia');
`);
try { await db.exec(fs.readFileSync(MIGRATION, "utf8")); console.log("OK  migrimi u ekzekutua pa gabime"); }
catch (e) { console.log("GABIM te migrimi:", e.message); process.exit(1); }

let pass = 0, fail = 0;
const check = (name, ok, extra = "") => { (ok ? pass++ : fail++); console.log((ok ? "OK  " : "GABIM ") + name + (extra ? "  -> " + extra : "")); };
const one = async (q, p) => (await db.query(q, p)).rows[0];
const all = async (q, p) => (await db.query(q, p)).rows;
const as = async (uid) => { await db.exec(`reset role; select set_config('test.uid', '${uid ?? ""}', false); ${uid ? "set role authenticated;" : "set role anon;"}`); };
const fails = async (q, p) => { try { await db.query(q, p); return null; } catch (e) { return e.message; } };
const keysFor = async (dob, today) => (await one(`select public.community_auto_keys_for($1::date, $2::date) k`, [dob, today])).k;

await db.exec("reset role");
check("grupi ekzistues mbetet 'topic'", (await one(`select kind, auto_key from public.community_groups where name = 'Gjidhënia'`)).kind === "topic");
check("4 grupet e moshës", (await one(`select count(*)::int c from public.community_groups where kind = 'age'`)).c === 4);

// --- Mosha → çelësat (kufijtë)
check("0 muaj (sot) → 0-3", JSON.stringify(await keysFor("2026-10-15", "2026-10-15")) === JSON.stringify(["age:0-3", "birth:2026-Q4"]));
check("2 muaj e 30 ditë → ende 0-3", (await keysFor("2026-07-16", "2026-10-15"))[0] === "age:0-3");
check("3.0 muaj → 3-6", (await keysFor("2026-07-15", "2026-10-15"))[0] === "age:3-6");
check("11 muaj → 6-12", (await keysFor("2025-11-20", "2026-10-15"))[0] === "age:6-12");
check("12 muaj → 12-24", (await keysFor("2025-10-15", "2026-10-15"))[0] === "age:12-24");
check("24+ muaj → vetëm grupi i lindjes", JSON.stringify(await keysFor("2024-08-01", "2026-10-15")) === JSON.stringify(["birth:2024-Q3"]));
check("datë në të ardhmen → asgjë", (await keysFor("2026-12-01", "2026-10-15")).length === 0);
check("pa datë → asgjë", (await keysFor(null, "2026-10-15")).length === 0);

// --- Përdoruesit
const mk = async (e) => (await one(`insert into auth.users (email) values ($1) returning id`, [e])).id;
const mom = await mk("mami@x"), dad = await mk("babi@x"), gma = await mk("gjyshja@x"), nobaby = await mk("pa@x");
const dob4m = (await one(`select (public.community_today() - interval '4 months')::date d`)).d;
await db.query(`insert into public.baby_profiles values ($1, 'Ana', $2)`, [mom, dob4m]);
await db.query(`insert into public.baby_household_members values ($1, $2, 'parent'), ($1, $3, 'viewer')`, [mom, dad, gma]);

await as(mom);
const sugg = await all(`select * from public.suggest_community_groups() order by auto_key`);
check("sugjerimet: 3-6 dhe grupi i lindjes", sugg.length === 2 && sugg.some((s) => s.auto_key === "age:3-6" && s.action === "join") && sugg.some((s) => s.auto_key.startsWith("birth:")), JSON.stringify(sugg));
check("asnjë datë apo moshë në përgjigje", !JSON.stringify(sugg).includes(String(dob4m)) && Object.keys(sugg[0]).join() === "auto_key,action");
check("s'kthehet data e lindjes nga funksioni i brendshëm", !!(await fails(`select public.community_my_baby_dob()`)));

const ageGroup = await one(`select id from public.community_groups where auto_key = 'age:0-3'`);
check("hyrja direkte në grup moshe refuzohet", !!(await fails(`insert into public.community_group_members (group_id, user_id) values ($1, $2)`, [ageGroup.id, mom])));
check("bashkimi me çelës të gabuar refuzohet", (await fails(`select public.join_suggested_group('age:0-3')`))?.includes("not_your_group"));
check("çelës i shpikur refuzohet", (await fails(`select public.join_suggested_group('age:99')`))?.includes("not_your_group"));
const g36 = (await one(`select public.join_suggested_group('age:3-6') id`)).id;
check("bashkohet te 3-6", (await one(`select count(*)::int c from public.community_group_members where group_id = $1`, [g36])).c === 1);
await db.query(`select public.join_suggested_group('age:3-6')`);
check("bashkimi i dytë s'dyfishon", (await one(`select count(*)::int c from public.community_group_members where group_id = $1`, [g36])).c === 1);
const birthKey = sugg.find((s) => s.auto_key.startsWith("birth:")).auto_key;
const gBirth = (await one(`select public.join_suggested_group($1) id`, [birthKey])).id;
await db.exec("reset role");
const bg = await one(`select name, kind from public.community_groups where id = $1`, [gBirth]);
check("grupi i lindjes krijohet sipas nevojës, me tremujorin", bg.kind === "birth_cohort" && /^Lindur në .+–.+ \d{4}$/.test(bg.name), bg.name);
await as(mom);
check("pas bashkimit: s'ka më sugjerime", (await all(`select * from public.suggest_community_groups()`)).length === 0);

// Postimet
check("poston në grupin ku është anëtar", !(await fails(`insert into public.community_posts (author_id, text, group_id) values ($1, 'Përshëndetje', $2)`, [mom, g36])));
await as(nobaby);
check("s'poston dot në grup moshe pa qenë anëtar", !!(await fails(`insert into public.community_posts (author_id, text, group_id) values ($1, 'x', $2)`, [nobaby, g36])));
const topic = await one(`select id from public.community_groups where name = 'Gjidhënia'`);
check("grupet e temave: hyrja direkte punon si më parë", !(await fails(`insert into public.community_group_members (group_id, user_id) values ($1, $2)`, [topic.id, nobaby])));
check("pa bebe: asnjë sugjerim", (await all(`select * from public.suggest_community_groups()`)).length === 0);

// Babi (prindi i familjes) merr sugjerimet e bebit të familjes; gjyshja jo
await as(dad);
check("prindi tjetër merr sugjerimin për bebin e familjes", (await all(`select * from public.suggest_community_groups()`)).some((s) => s.auto_key === "age:3-6"));
await as(gma);
check("gjyshja s'merr sugjerime", (await all(`select * from public.suggest_community_groups()`)).length === 0);
check("gjyshja s'bashkohet dot", (await fails(`select public.join_suggested_group('age:3-6')`))?.includes("not_your_group"));

// Bebi rritet: sugjerohet grupi tjetër dhe "Dil" nga i vjetri; anëtarësia s'hiqet vetë
await db.exec("reset role");
const dob7m = (await one(`select (public.community_today() - interval '7 months')::date d`)).d;
await db.query(`update public.baby_profiles set baby_dob = $1 where user_id = $2`, [dob7m, mom]);
await as(mom);
const grown = await all(`select * from public.suggest_community_groups() order by action`);
check("bebi rritet: 'join' 6-12 dhe 'leave' 3-6", grown.some((s) => s.auto_key === "age:6-12" && s.action === "join") && grown.some((s) => s.auto_key === "age:3-6" && s.action === "leave"), JSON.stringify(grown));
check("data u korrigjua: ofrohet edhe dalja nga grupi i vjetër i lindjes", grown.some((s) => s.auto_key === birthKey && s.action === "leave"));
check("anëtarësia e vjetër s'hiqet vetë", (await one(`select count(*)::int c from public.community_group_members where group_id = $1 and user_id = $2`, [g36, mom])).c === 1);
await db.query(`delete from public.community_group_members where group_id = $1 and user_id = $2`, [g36, mom]);
check("prindi del vetë nga grupi i vjetër", (await one(`select count(*)::int c from public.community_group_members where group_id = $1 and user_id = $2`, [g36, mom])).c === 0);
check("s'mund të rihyjë te grupi i kaluar", (await fails(`select public.join_suggested_group('age:3-6')`))?.includes("not_your_group"));

// Ri-ekzekutimi
await db.exec("reset role");
await db.exec(fs.readFileSync(MIGRATION, "utf8"));
check("ri-ekzekutimi s'dyfishon grupet", (await one(`select count(*)::int c from public.community_groups where kind = 'age'`)).c === 4);

console.log(`\n${pass} OK, ${fail} gabime`);
process.exit(fail ? 1 : 0);
