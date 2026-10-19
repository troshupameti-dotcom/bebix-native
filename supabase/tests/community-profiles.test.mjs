/**
 * Prova e fotos së profilit dhe e listave të ndjekjes në komunitet (PGlite).
 * Nisja:  node supabase/tests/community-profiles.test.mjs   (me @electric-sql/pglite të instaluar)
 */
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";

const MIGRATION = new URL("../migrations/20261022090000_community_profiles.sql", import.meta.url);
const db = new PGlite();
process.on("uncaughtException", (e) => { console.log("GABIM i papritur:", String(e.message).slice(0, 300)); process.exit(1); });

// Gjendja pas 20261019090000_direct_messages.sql (sa i duhet testit).
await db.exec(`
create schema auth;
create table auth.users (id uuid primary key default gen_random_uuid(), email text);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
create role anon; create role authenticated;
grant usage on schema public, auth to anon, authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated;
create table public.community_experts (id uuid primary key default gen_random_uuid(), user_id uuid, name text not null, photo_path text);
create table public.community_user_profiles (user_id uuid primary key, display_name text not null, updated_at timestamptz not null default now());
alter table public.community_user_profiles enable row level security;
create policy "community_user_profiles_read" on public.community_user_profiles for select to authenticated using (true);
create table public.community_user_follows (follower_id uuid not null, followee_id uuid not null, created_at timestamptz not null default now(),
  primary key (follower_id, followee_id));
create table public.community_blocks (blocker_id uuid not null, blocked_id uuid not null);
create function public.community_display_name(p_user uuid) returns text language sql stable security definer set search_path = public as $$
  select coalesce((select e.name from public.community_experts e where e.user_id = p_user),
                  (select p.display_name from public.community_user_profiles p where p.user_id = p_user), 'Prind');
$$;
`);
for (const name of ["i pari", "i dyti"]) {
  try { await db.exec(fs.readFileSync(MIGRATION, "utf8")); console.log(`OK  migrimi (${name})`); }
  catch (e) { console.log("GABIM te migrimi:", e.message); process.exit(1); }
}

let pass = 0, fail = 0;
const check = (name, ok, extra = "") => { (ok ? pass++ : fail++); console.log((ok ? "OK  " : "GABIM ") + name + (extra ? "  -> " + extra : "")); };
const one = async (q, p) => (await db.query(q, p)).rows[0];
const all = async (q, p) => (await db.query(q, p)).rows;
const as = async (uid) => { await db.exec(`reset role; select set_config('test.uid', '${uid ?? ""}', false); ${uid ? "set role authenticated;" : "set role anon;"}`); };
const fails = async (q, p) => { try { await db.query(q, p); return null; } catch (e) { return e.message; } };

await db.exec("reset role");
const mk = async (e) => (await one(`insert into auth.users (email) values ($1) returning id`, [e])).id;
const ana = await mk("ana@x"), ben = await mk("ben@x"), cen = await mk("cen@x"), doc = await mk("doc@x");
await db.query(`insert into public.community_user_profiles (user_id, display_name) values ($1, 'Ana'), ($2, 'Ben'), ($3, 'Cen')`, [ana, ben, cen]);
await db.query(`insert into public.community_experts (user_id, name, photo_path) values ($1, 'Dr. Arta', $2)`, [doc, `${doc}/avatar-1.jpg`]);
// Ana ↔ Ben miq; Cen ndjek Anën (pa u ndjekur); Ana ndjek mjeken.
await db.query(`insert into public.community_user_follows (follower_id, followee_id) values ($1, $2), ($2, $1), ($3, $1), ($1, $4)`, [ana, ben, cen, doc]);

// --- Fotoja ------------------------------------------------------------------
await as(ana);
check("fotoja e dikujt tjetër refuzohet", /ngarkuar nga ti/.test(await fails(`select public.set_my_community_avatar($1)`, [`${ben}/avatar-1.jpg`]) ?? ""));
await db.query(`select public.set_my_community_avatar($1)`, [`${ana}/avatar-1.jpg`]);
const old = (await one(`select public.set_my_community_avatar($1) v`, [`${ana}/avatar-2.jpg`])).v;
check("ndërrimi kthen foton e vjetër (për ta fshirë)", old === `${ana}/avatar-1.jpg`);
check("fotoja e re lexohet nga të gjithë", (await one(`select avatar_path from public.community_user_profiles where user_id = $1`, [ana])).avatar_path === `${ana}/avatar-2.jpg`);
await as(doc);
await db.query(`select public.set_my_community_avatar(null)`);
check("profili krijohet edhe kur s'kishte (me emrin publik)", (await one(`select display_name from public.community_user_profiles where user_id = $1`, [doc])).display_name === "Dr. Arta");

// --- Listat ------------------------------------------------------------------
await as(ana);
const myFollowers = (await all(`select display_name from public.community_follow_list($1, 'followers') order by display_name`, [ana])).map((r) => r.display_name);
check("unë i shoh ndjekësit e mi", JSON.stringify(myFollowers) === JSON.stringify(["Ben", "Cen"]), JSON.stringify(myFollowers));
const myFollowing = await all(`select display_name, avatar_path from public.community_follow_list($1, 'following') order by display_name`, [ana]);
check("të ndjekurit e mi, me foton e mjekes", myFollowing.length === 2 && myFollowing.find((r) => r.display_name === "Dr. Arta").avatar_path === `${doc}/avatar-1.jpg`);
await as(ben);
check("miku (ndiqemi të dy) i sheh listat", (await all(`select 1 from public.community_follow_list($1, 'followers')`, [ana])).length === 2);
check("community_can_see_follows: miku po", (await one(`select public.community_can_see_follows($1) v`, [ana])).v === true);
await as(cen);
check("ndjekësi që s'është mik s'i sheh listat", (await all(`select 1 from public.community_follow_list($1, 'followers')`, [ana])).length === 0);
check("community_can_see_follows: jo-miku jo", (await one(`select public.community_can_see_follows($1) v`, [ana])).v === false);
await as(ben);
await db.exec("reset role");
await db.query(`insert into public.community_blocks values ($1, $2)`, [cen, ben]);
await as(ben);
check("i bllokuari s'del te lista", !(await all(`select display_name from public.community_follow_list($1, 'followers')`, [ana])).some((r) => r.display_name === "Cen"));
await as(null);
check("pa llogari: asgjë", !!(await fails(`select * from public.community_follow_list($1, 'followers')`, [ana])));

console.log(`\n${pass} OK, ${fail} gabime`);
process.exit(fail ? 1 : 0);
