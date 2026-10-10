/**
 * Prova e "prindërit si ekip + gjyshërit" në një Postgres lokal (PGlite).
 * Nisja:  node supabase/tests/household-team.test.mjs   (me @electric-sql/pglite të instaluar)
 */
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";

const CAPSULE = new URL("../migrations/20261010090000_time_capsule.sql", import.meta.url);
const TEAM = new URL("../migrations/20261011090000_household_team.sql", import.meta.url);
const db = new PGlite();
process.on("uncaughtException", (e) => { console.log("GABIM i papritur:", String(e.message).slice(0, 300)); process.exit(1); });

// Gjendja e prodhimit para migrimit (sa i duhet testit).
await db.exec(`
create schema auth;
create table auth.users (id uuid primary key default gen_random_uuid(), email text);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
create role anon; create role authenticated;
grant usage on schema public, auth to anon, authenticated;
-- Si Supabase: tabelat e reja u jepen rolet automatikisht; RLS vendos.
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on sequences to anon, authenticated;

create table public.baby_household_members (
  owner_id uuid not null, member_id uuid not null, created_at timestamptz not null default now(),
  primary key (owner_id, member_id), constraint member_is_not_owner check (owner_id <> member_id));
create unique index baby_household_one_per_member on public.baby_household_members (member_id);
create table public.baby_household_invites (code text primary key, owner_id uuid not null, created_at timestamptz not null default now(),
  expires_at timestamptz not null, used_at timestamptz, used_by uuid);
alter table public.baby_household_members enable row level security;
create policy "household_members_visible" on public.baby_household_members for select to authenticated
  using (owner_id = (select auth.uid()) or member_id = (select auth.uid()));
grant select, delete on public.baby_household_members to authenticated;

create function public.can_access_baby_data(p_owner uuid) returns boolean language sql stable security definer set search_path = public as $$
  select p_owner = (select auth.uid()) or exists (select 1 from public.baby_household_members m where m.owner_id = p_owner and m.member_id = (select auth.uid()));
$$;
create function public.my_data_owner() returns uuid language sql stable security definer set search_path = public as $$
  select coalesce((select owner_id from public.baby_household_members where member_id = (select auth.uid()) limit 1), (select auth.uid()));
$$;
create function public.create_household_invite() returns text language sql as $$ select 'OLD' $$;
grant execute on function public.can_access_baby_data(uuid), public.my_data_owner() to authenticated;

create table public.baby_records (user_id uuid not null, id text not null, kind text not null, payload jsonb default '{}',
  occurred_at timestamptz, created_at timestamptz default now(), updated_at timestamptz default now(),
  deleted_at timestamptz, archived_at timestamptz, primary key (user_id, id));
alter table public.baby_records enable row level security;
create policy "baby_records_household" on public.baby_records for all to authenticated
  using (public.can_access_baby_data(user_id)) with check (public.can_access_baby_data(user_id));
grant select, insert, update, delete on public.baby_records to authenticated;

create table public.baby_profiles (user_id uuid primary key, baby_name text);
alter table public.baby_profiles enable row level security;
create policy "baby_profiles_household" on public.baby_profiles for all to authenticated
  using (public.can_access_baby_data(user_id)) with check (public.can_access_baby_data(user_id));
grant select, insert, update on public.baby_profiles to authenticated;

create schema storage;
create table storage.objects (bucket_id text, name text);
create function storage.foldername(name text) returns text[] language sql immutable as $$ select string_to_array(name, '/') $$;
alter table storage.objects enable row level security;
grant usage on schema storage to authenticated;
grant select on storage.objects to authenticated;

create table public.notification_settings (user_id uuid primary key, prefs jsonb default '{}', timezone text);
create table public.notification_outbox (id bigserial primary key, user_id uuid, key text, title text, body text, data jsonb,
  dedupe_key text, send_after timestamptz default now(), expires_at timestamptz, sent_at timestamptz, created_at timestamptz default now());
create unique index notification_outbox_dedupe on public.notification_outbox (user_id, dedupe_key) where dedupe_key is not null;
create function public.notification_allowed(p_user uuid, p_key text) returns boolean language sql stable as $$
  select coalesce((select (prefs->>p_key)::boolean from public.notification_settings where user_id = p_user), true) $$;
create function public.enqueue_notification(p_user uuid, p_key text, p_title text, p_body text, p_data jsonb default '{}'::jsonb,
  p_dedupe text default null, p_send_after timestamptz default now(), p_expires_at timestamptz default null)
returns void language plpgsql security definer set search_path = public as $fn$
begin
  if p_user is null or not public.notification_allowed(p_user, p_key) then return; end if;
  insert into public.notification_outbox (user_id, key, title, body, data, dedupe_key, send_after, expires_at)
  values (p_user, p_key, p_title, p_body, p_data, p_dedupe, p_send_after, p_expires_at) on conflict do nothing;
end $fn$;
`);
for (const [name, file] of [["kapsula", CAPSULE], ["ekipi", TEAM]]) {
  try { await db.exec(fs.readFileSync(file, "utf8")); console.log(`OK  migrimi (${name}) u ekzekutua pa gabime`); }
  catch (e) { console.log(`GABIM te migrimi (${name}):`, e.message); process.exit(1); }
}

let pass = 0, fail = 0;
const check = (name, ok, extra = "") => { (ok ? pass++ : fail++); console.log((ok ? "OK  " : "GABIM ") + name + (extra ? "  -> " + extra : "")); };
const one = async (q, p) => (await db.query(q, p)).rows[0];
const all = async (q, p) => (await db.query(q, p)).rows;
const as = async (uid) => { await db.exec(`reset role; select set_config('test.uid', '${uid ?? ""}', false); ${uid ? "set role authenticated;" : "set role anon;"}`); };
const fails = async (q, p) => { try { await db.query(q, p); return null; } catch (e) { return e.message; } };

await db.exec("reset role");
const mk = async (e) => (await one(`insert into auth.users (email) values ($1) returning id`, [e])).id;
const mom = await mk("mami@x"), dad = await mk("babi@x"), gma = await mk("gjyshja@x"), other = await mk("tjeter@x");
await db.query(`insert into public.baby_profiles values ($1, 'Ana')`, [mom]);

// --- Ftesat me rol
await as(mom);
const parentCode = (await one(`select public.create_household_invite() as c`)).c;
const viewerCode = (await one(`select public.create_household_invite('viewer') as c`)).c;
check("rol i panjohur refuzohet", !!(await fails(`select public.create_household_invite('admin')`)));
await as(dad);
await db.query(`select public.join_household($1)`, [parentCode]);
await as(gma);
await db.query(`select public.join_household($1)`, [viewerCode]);
await db.exec("reset role");
const roles = Object.fromEntries((await all(`select member_id, role from public.baby_household_members`)).map((r) => [r.member_id, r.role]));
check("babi hyn si prind, gjyshja si shikuese", roles[dad] === "parent" && roles[gma] === "viewer");
await as(gma);
check("roli im: viewer", (await one(`select public.my_household_role() as r`)).r === "viewer");
await as(dad);
check("roli im: parent", (await one(`select public.my_household_role() as r`)).r === "parent");

// --- Shënimet: autori dhe kush sheh çfarë
await as(dad);
await db.query(`insert into public.baby_records (user_id, id, kind, occurred_at) values ($1, 'd1', 'diaper', now()), ($1, 'd2', 'diaper', now()), ($1, 'f1', 'feeding', now())`, [mom]);
await as(mom);
await db.query(`insert into public.baby_records (user_id, id, kind, occurred_at) values ($1, 'f2', 'feeding', now()), ($1, 'm1', 'moment', now()), ($1, 'g1', 'growth', now()), ($1, 'v1', 'vaccine', now()), ($1, 'x1', 'medical', now())`, [mom]);
await db.exec("reset role");
check("autori ruhet vetë (created_by)", (await one(`select created_by from public.baby_records where id = 'd1'`)).created_by === dad);
await as(mom);
await db.query(`update public.baby_records set payload = '{"x":1}' where id = 'd1'`);
await db.exec("reset role");
check("përditësimi s'e ndryshon autorin", (await one(`select created_by from public.baby_records where id = 'd1'`)).created_by === dad);

await as(gma);
let kinds = (await all(`select kind from public.baby_records order by kind`)).map((r) => r.kind);
check("gjyshja sheh vetëm momentet dhe rritjen", JSON.stringify([...new Set(kinds)]) === JSON.stringify(["growth", "moment"]), kinds.join(","));
check("gjyshja s'shkruan dot", !!(await fails(`insert into public.baby_records (user_id, id, kind) values ($1, 'z', 'moment')`, [mom])));
check("gjyshja s'ndryshon dot", (await all(`update public.baby_records set payload = '{}' where id = 'm1' returning id`)).length === 0);
check("gjyshja sheh emrin e bebit", (await one(`select baby_name from public.baby_profiles`))?.baby_name === "Ana");
check("gjyshja s'e ndryshon profilin", (await all(`update public.baby_profiles set baby_name = 'X' returning user_id`)).length === 0);
check("gjyshja s'i ndryshon cilësimet e familjes", !!(await fails(`insert into public.household_settings (owner_id, share_care_with_viewers) values ($1, true)`, [mom])));

await as(dad);
await db.query(`insert into public.household_settings (owner_id, share_care_with_viewers) values ($1, true)`, [mom]);
await as(gma);
kinds = [...new Set((await all(`select kind from public.baby_records order by kind`)).map((r) => r.kind))];
check("kur prindërit lejojnë: edhe ushqimi/pelenat, por jo vaksinat/kartela", JSON.stringify(kinds) === JSON.stringify(["diaper", "feeding", "growth", "moment"]), kinds.join(","));

await as(other);
check("i huaji s'sheh asgjë", (await one(`select count(*)::int c from public.baby_records`)).c === 0);

// --- Fotot në Storage
await db.exec("reset role");
await db.query(`insert into storage.objects values ('baby-moments', $1 || '/m1.jpg')`, [mom]);
await as(gma);
check("gjyshja i sheh fotot e familjes", (await one(`select count(*)::int c from storage.objects`)).c === 1);
await as(other);
check("i huaji s'i sheh fotot", (await one(`select count(*)::int c from storage.objects`)).c === 0);

// --- Emrat dhe njerëzit e familjes
await as(dad);
await db.query(`insert into public.household_member_profiles (user_id, display_name, relation, lang) values ($1, null, 'dad', 'sq')`, [dad]);
check("s'shkruan dot profilin e tjetrit", !!(await fails(`insert into public.household_member_profiles (user_id, relation) values ($1, 'mom')`, [mom])));
await as(mom);
await db.query(`insert into public.household_member_profiles (user_id, display_name, relation, lang) values ($1, 'Arta', 'mom', 'en')`, [mom]);
const people = await all(`select user_id, role, relation, is_owner, is_me from public.household_people() order by role, is_owner desc`);
check("pronari i sheh të gjithë (prindërit + gjyshen)", people.length === 3 && people.some((p) => p.user_id === gma && p.role === "viewer"));
await as(gma);
check("gjyshja sheh prindërit dhe veten", (await all(`select user_id from public.household_people()`)).length === 3);
await as(other);
const own = await all(`select user_id, is_me from public.household_people()`);
check("i huaji sheh vetëm veten (familja e tij), asnjë nga kjo familje", own.length === 1 && own[0].is_me && own[0].user_id === other);

// --- Përmbledhja e ditës
await as(mom);
const sum = await all(`select member_id, kind, n from public.household_day_summary(now() - interval '1 day', now() + interval '1 hour') order by member_id, kind`);
const dadDiapers = sum.find((r) => r.member_id === dad && r.kind === "diaper")?.n;
check("babi ndërroi 2 pelena sot", dadDiapers === 2, JSON.stringify(sum));
check("momentet/rritja s'numërohen te përmbledhja", !sum.some((r) => r.kind === "moment"));
await as(gma);
check("gjyshja s'merr përmbledhjen e kujdesit", (await all(`select * from public.household_day_summary(now() - interval '1 day', now())`)).length === 0);

// --- Faleminderit
await as(mom);
check("mami falënderon babin", (await one(`select public.send_household_thanks($1) as ok`, [dad])).ok === true);
await db.exec("reset role");
const thanks = await one(`select title, body, key from public.notification_outbox where user_id = $1 and key = 'baby_team'`, [dad]);
check("babi merr njoftim me emrin e mamit", thanks?.body === "Arta të falënderon për sot.", thanks?.body);
await as(mom);
await db.query(`select public.send_household_thanks($1)`, [dad]);
await db.query(`select public.send_household_thanks($1)`, [dad]);
check("më shumë se 3 në ditë: s'dërgohet", (await one(`select public.send_household_thanks($1) as ok`, [dad])).ok === false);
check("s'falënderon dot veten", !!(await fails(`select public.send_household_thanks($1)`, [mom])));
check("s'falënderon dot të huajin", !!(await fails(`select public.send_household_thanks($1)`, [other])));
await as(gma);
check("gjyshja s'dërgon njoftime", !!(await fails(`select public.send_household_thanks($1)`, [mom])));
await as(dad);
await db.query(`select public.send_household_thanks($1)`, [mom]);
await db.exec("reset role");
check("mami (anglisht) e merr në anglisht", (await one(`select title from public.notification_outbox where user_id = $1`, [mom]))?.title === "Thank you ❤️");

// --- Turnet e natës
await db.query(`insert into public.notification_settings (user_id, timezone) values ($1, 'Europe/Belgrade')`, [dad]);
await as(mom);
const tomorrow = (await one(`select (current_date + 1)::text as d`)).d;
await db.query(`select public.set_night_shift($1::date, $2)`, [tomorrow, dad]);
await db.exec("reset role");
let rem = await one(`select user_id, send_after, body from public.notification_outbox where key = 'baby_shift'`);
check("kujtesa e turnit shkon te babi", rem?.user_id === dad && rem.body.includes("të ka shënuar"), rem?.body);
const hourLocal = (await one(`select to_char(send_after at time zone 'Europe/Belgrade', 'HH24:MI') as h from public.notification_outbox where key = 'baby_shift'`)).h;
check("në 20:30 sipas orës së tij", hourLocal === "20:30", hourLocal);
await as(mom);
await db.query(`select public.set_night_shift($1::date, $2)`, [tomorrow, mom]);
await db.exec("reset role");
const shiftRems = await all(`select user_id from public.notification_outbox where key = 'baby_shift' and sent_at is null`);
check("ndërrimi i turnit heq kujtesën e babit dhe i jep mamit", shiftRems.length === 1 && shiftRems[0].user_id === mom);
check("turni ruhet", (await one(`select user_id from public.household_night_shifts`)).user_id === mom);
await as(dad);
check("babi e sheh turnin", (await one(`select count(*)::int c from public.household_night_shifts`)).c === 1);
await as(gma);
check("gjyshja s'cakton turne", !!(await fails(`select public.set_night_shift($1::date, $2)`, [tomorrow, gma])));
check("gjyshja s'i sheh turnet", (await one(`select count(*)::int c from public.household_night_shifts`)).c === 0);
await as(mom);
check("s'caktohet dot gjyshja në turn", !!(await fails(`select public.set_night_shift($1::date, $2)`, [tomorrow, gma])));
check("natë shumë larg refuzohet", !!(await fails(`select public.set_night_shift(current_date + 30, $1)`, [mom])));
await db.query(`select public.set_night_shift($1::date, null)`, [tomorrow]);
await db.exec("reset role");
check("heqja e turnit heq edhe kujtesën", (await one(`select count(*)::int c from public.notification_outbox where key = 'baby_shift' and sent_at is null`)).c === 0);

// --- Kapsula: gjyshja s'shkruan atje
await as(gma);
check("gjyshja s'vulos letra në kapsulë", (await fails(`select public.seal_capsule_letter('a', 'b', current_date + 5)`))?.includes("not_a_parent"));
await as(dad);
check("babi (prind) vulos letra", !!(await one(`select public.seal_capsule_letter('a', 'b', current_date + 5) as id`)).id);

console.log(`\n${pass} OK, ${fail} gabime`);
process.exit(fail ? 1 : 0);
