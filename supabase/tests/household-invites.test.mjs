/**
 * Prova e kodeve të ftesës në Familje pas forcimit (auditimi #35) në një Postgres lokal (PGlite).
 * Nisja:  node supabase/tests/household-invites.test.mjs   (me @electric-sql/pglite të instaluar)
 */
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";

const CAPSULE = new URL("../migrations/20261010090000_time_capsule.sql", import.meta.url);
const TEAM = new URL("../migrations/20261011090000_household_team.sql", import.meta.url);
const HARDEN = new URL("../migrations/20261026090000_household_invite_hardening.sql", import.meta.url);
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
create role service_role;
`);
for (const [name, file] of [["kapsula", CAPSULE], ["ekipi", TEAM], ["forcimi", HARDEN], ["forcimi sërish", HARDEN]]) {
  try { await db.exec(fs.readFileSync(file, "utf8")); console.log(`OK  migrimi (${name}) u ekzekutua pa gabime`); }
  catch (e) { console.log(`GABIM te migrimi (${name}):`, e.message); process.exit(1); }
}

let pass = 0, fail = 0;
const check = (name, ok, extra = "") => { (ok ? pass++ : fail++); console.log((ok ? "OK  " : "GABIM ") + name + (extra ? "  -> " + extra : "")); };
const one = async (q, p) => (await db.query(q, p)).rows[0];
const as = async (uid) => { await db.exec(`reset role; select set_config('test.uid', '${uid ?? ""}', false); ${uid ? "set role authenticated;" : "set role anon;"}`); };
const fails = async (q, p) => { try { await db.query(q, p); return null; } catch (e) { return e.message; } };
// Thirrja si te PostgREST: një transaksion; kthen përgjigjen dhe statusin HTTP që vendos funksioni.
const join = async (code) => db.transaction(async (tx) => {
  const j = (await tx.query(`select public.join_household($1) as j`, [code])).rows[0].j;
  const s = (await tx.query(`select current_setting('response.status', true) as s`)).rows[0].s;
  return { j, s: s || "200" };
});

await db.exec("reset role");
const mk = async (e) => (await one(`insert into auth.users (email) values ($1) returning id`, [e])).id;
const mom = await mk("mami@x"), dad = await mk("babi@x"), guesser = await mk("provuesi@x");

// --- Kodet: 6 shenja nga alfabeti, të ndryshëm, pa 0/O/1/I
await as(mom);
const codes = [];
for (let i = 0; i < 300; i++) codes.push((await one(`select public.create_household_invite() as c`)).c);
check("çdo kod ka 6 shenja nga alfabeti", codes.every((c) => /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/.test(c)));
check("300 kode, të gjithë të ndryshëm", new Set(codes).size === 300);
const seen = new Set(codes.join(""));
check("përdoren pothuajse të gjitha 32 shenjat", seen.size >= 30, `${seen.size} shenja`);
const code = codes[0];

// --- Kodi i gabuar: gabim 400 me mesazhin, por prova mbetet e shënuar
await as(guesser);
const bad = await join("ZZZZZZ");
check("kodi i gabuar: statusi 400 dhe mesazhi", bad.s === "400" && bad.j?.message === "Kodi nuk u gjet.", JSON.stringify(bad));
await db.exec("reset role");
check("prova u ruajt pas gabimit", Number((await one(`select count(*) n from public.household_join_attempts where user_id = $1`, [guesser])).n) === 1);

// --- Pas 10 provash të gabuara në orë: 429, edhe me kodin e saktë
await as(guesser);
for (let i = 0; i < 9; i++) await join("YYYYY" + i);
const blocked = await join(code);
check("prova e 11-të bllokohet me 429", blocked.s === "429" && /Shumë prova/.test(blocked.j?.message ?? ""), JSON.stringify(blocked));
await db.exec("reset role");
check("provuesi s'hyri në familje", Number((await one(`select count(*) n from public.baby_household_members where member_id = $1`, [guesser])).n) === 0);

// --- Kodi i saktë nga dikush tjetër: hyn
await as(dad);
const ok = await join(code);
check("babi hyn me kodin e saktë", ok.s === "200" && ok.j?.owner_id === mom, JSON.stringify(ok));
const again = await join(code);
check("kodi s'përdoret dot dy herë", again.s === "400" && again.j?.message === "Ky kod është përdorur tashmë.");
await db.exec("reset role");
check("babi është anëtar si prind", (await one(`select role from public.baby_household_members where member_id = $1`, [dad]))?.role === "parent");

// --- Qasja: pa llogari s'thirret; provat s'lexohen nga app-i
await as(null);
check("anon s'e thërret join_household", !!(await fails(`select public.join_household('ABCDEF')`)));
await as(guesser);
check("app-i s'i lexon provat", !!(await fails(`select * from public.household_join_attempts`)));
check("app-i s'e thërret ndihmësin e gabimit", !!(await fails(`select public.household_join_error('x', '400')`)));

console.log(`
${pass} kaluan, ${fail} dështuan`);
process.exit(fail ? 1 : 0);
