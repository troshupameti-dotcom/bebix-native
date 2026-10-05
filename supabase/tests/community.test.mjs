/**
 * Prova e migrimit të repartave të mjekëve (komuniteti) në një Postgres lokal (PGlite), pa prekur bazën e vërtetë.
 *
 * Nisja (nga rrënja e projektit):
 *   npm i --no-save @electric-sql/pglite
 *   node supabase/tests/community.test.mjs
 */
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";

const MIGRATION = new URL("../migrations/20261005180000_community_specialties.sql", import.meta.url);
const db = new PGlite();
process.on("uncaughtException", (e) => { console.log("GABIM i papritur:", String(e.message).slice(0, 300)); process.exit(1); });

// Skema si në prodhim para migrimit (vetëm kolonat që prek ose lexon migrimi).
await db.exec(`
create role anon; create role authenticated;
create schema auth;
create table auth.users (id uuid primary key default gen_random_uuid());
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create function public.is_admin() returns boolean language sql stable as $$ select coalesce(current_setting('test.admin', true), '') = 'on' $$;

create table public.community_groups (id uuid primary key default gen_random_uuid(), name text);
create table public.community_blocks (blocker_id uuid, blocked_id uuid);
create table public.community_posts (
  id uuid primary key default gen_random_uuid(), author_id uuid references auth.users(id), author_name text, author_initial text,
  author_is_expert boolean default false, accent text default 'olive', kind text default 'text', text text default '', tag text,
  icon text default 'sparkle', group_id uuid, created_at timestamptz default now(), updated_at timestamptz default now(),
  media jsonb default '[]', like_count integer default 0, comment_count integer default 0, open_report_count integer default 0
);
create table public.community_experts (
  id uuid primary key default gen_random_uuid(), name text not null, kind text not null, bio text not null default '',
  experience_years integer not null default 0, languages text[] not null default '{}', rating numeric not null default 0,
  review_count integer not null default 0, icon text not null default 'shield', accent text not null default 'olive',
  created_at timestamptz not null default now(), user_id uuid references auth.users(id) on delete set null,
  constraint community_experts_user_id_key unique (user_id)
);
create table public.expert_applications (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  full_name text not null, license_number text not null, specialization text not null, experience_years integer not null default 0,
  phone text not null default '', bio text not null default '', status text not null default 'pending' check (status in ('pending','approved','rejected')),
  admin_note text, created_at timestamptz not null default now(), reviewed_at timestamptz, reviewed_by uuid references auth.users(id)
);
create unique index expert_applications_one_pending on public.expert_applications (user_id) where status = 'pending';

create view public.community_feed with (security_invoker = true) as
 select p.id, p.author_id, p.author_name, p.author_initial, p.author_is_expert, p.accent, p.kind, p.text, p.tag, p.icon, p.group_id,
        g.name as group_name, p.created_at, p.updated_at, p.like_count::bigint as like_count, p.comment_count::bigint as comment_count, p.media
   from public.community_posts p left join public.community_groups g on g.id = p.group_id
  where not (exists (select 1 from public.community_blocks b where b.blocker_id = (select auth.uid()) and b.blocked_id = p.author_id))
    and (p.author_id = (select auth.uid()) or p.open_report_count < 3);
grant select on public.community_feed to anon, authenticated;
`);

const one = async (q, p) => (await db.query(q, p)).rows[0];
const many = async (q, p) => (await db.query(q, p)).rows;
const user = async () => (await one(`insert into auth.users default values returning id`)).id;

// Të dhëna ekzistuese (si në prodhim): ekspertë me tekst të lirë, njëri me llogari.
const uExpert = await user(), uParent = await user(), uApplicant = await user(), uAdmin = await user();
await db.exec(`
insert into community_experts (name, kind, user_id) values
  ('Dr. A', 'Pediatër', '${uExpert}'),
  ('Dr. B', 'Trajner Gjumi', null),
  ('C', 'Konsulente Gjidhënieje', null),
  ('D', 'Psikolog Fëmijësh', null),
  ('E', 'Nutricionist', null),
  ('F', 'Diçka e panjohur', null);
insert into expert_applications (user_id, full_name, license_number, specialization, status) values ('${uExpert}', 'Dr. A', 'L1', 'Pediatër', 'approved');
insert into community_posts (author_id, author_name, author_initial, author_is_expert, text) values
  ('${uExpert}', 'Dr. A', 'D', true, 'Këshillë nga mjeku'),
  ('${uParent}', 'Prind', 'P', false, 'Pyetje nga prindi');
`);

try { await db.exec(fs.readFileSync(MIGRATION, "utf8")); console.log("OK  migrimi u ekzekutua pa gabime"); }
catch (e) { console.log("GABIM te migrimi:", e.message); process.exit(1); }

let pass = 0, fail = 0;
const check = (name, ok, extra = "") => { (ok ? pass++ : fail++); console.log((ok ? "OK  " : "GABIM ") + name + (extra ? "  -> " + extra : "")); };
const rejects = async (name, fn, fragment) => { try { await fn(); check(name, false, "nuk u refuzua"); } catch (e) { check(name, e.message.includes(fragment), e.message.slice(0, 80)); } };
const asAdmin = async (on) => db.exec(`select set_config('test.admin', '${on ? "on" : "off"}', false), set_config('request.jwt.claim.sub', '${on ? uAdmin : uParent}', false)`);

// 1) lista e repartave
const specs = await many(`select key from community_specialties`);
check("lista ka repartat kryesore (pediatër, gjinekolog/e, ortoped, psikolog/e)", ["pediatrician", "gynecologist", "orthopedist", "psychologist"].every((k) => specs.some((s) => s.key === k)), String(specs.length));
check("ka të paktën 20 reparte, secili me emër shqip dhe anglisht", specs.length >= 20 && (await one(`select count(*)::int c from community_specialties where label = '' or label_en = ''`)).c === 0);
check("çelësi i repartit duhet të jetë i vlefshëm", await (async () => { try { await db.exec(`insert into community_specialties (key, label, label_en) values ('Bad Key!', 'x', 'x')`); return false; } catch { return true; } })());

// 2) klasifikimi i të dhënave ekzistuese
const kinds = Object.fromEntries((await many(`select name, specialty_key from community_experts`)).map((r) => [r.name, r.specialty_key]));
check("ekspertët ekzistues klasifikohen sipas tekstit të vjetër", kinds["Dr. A"] === "pediatrician" && kinds["Dr. B"] === "sleep_coach" && kinds.C === "lactation" && kinds.D === "psychologist" && kinds.E === "nutritionist", JSON.stringify(kinds));
check("teksti i panjohur mbetet pa reparte (admini e vendos)", kinds.F === null);
check("aplikimi i vjetër klasifikohet", (await one(`select specialty_key from expert_applications limit 1`)).specialty_key === "pediatrician");

// 3) rrjedha: reparti i autorit
const feed = await many(`select author_name, author_is_expert, author_specialty from community_feed order by author_name`);
check("rrjedha: ekspertit i del reparti, prindit null", feed.find((r) => r.author_name === "Dr. A")?.author_specialty === "pediatrician" && feed.find((r) => r.author_name === "Prind")?.author_specialty === null, JSON.stringify(feed));
check("rrjedha: s'ka dublikata nga bashkimi (2 postime, 2 rreshta)", feed.length === 2);
const cols = (await many(`select column_name from information_schema.columns where table_name = 'community_feed' order by ordinal_position`)).map((r) => r.column_name);
check("rrjedha: kolona e re është e fundit, pjesa tjetër e pandryshuar", cols[cols.length - 1] === "author_specialty" && cols.slice(0, 5).join() === "id,author_id,author_name,author_initial,author_is_expert", cols.join());
check("rrjedha: mbetet security_invoker", (await one(`select reloptions::text r from pg_class where relname = 'community_feed'`)).r.includes("security_invoker=true"));
// bllokimi dhe raportimi punojnë si më parë
await db.exec(`insert into community_blocks values ('${uParent}', '${uExpert}'); select set_config('request.jwt.claim.sub', '${uParent}', false)`);
check("rrjedha: autori i bllokuar fshihet si më parë", (await many(`select 1 from community_feed where author_id = '${uExpert}'`)).length === 0);
await db.exec(`delete from community_blocks`);

// 4) aprovimi i aplikimit
const app = (await one(`insert into expert_applications (user_id, full_name, license_number, specialization, specialty_key, experience_years, bio) values ('${uApplicant}', 'Dr. Gj', 'L9', 'Gjinekolog/e', 'gynecologist', 7, 'Bio') returning id`)).id;
await asAdmin(false);
await rejects("jo-admini s'mund të aprovojë", () => db.query(`select public.approve_expert_application('${app}')`), "administratori");
await asAdmin(true);
await rejects("reparti i panjohur refuzohet", () => db.query(`select public.approve_expert_application('${app}', 'nuk_ekziston')`), "nuk njihet");
check("aplikimi mbetet 'pending' pas refuzimit (asgjë gjysmë e bërë)", (await one(`select status from expert_applications where id = '${app}'`)).status === "pending" && (await one(`select count(*)::int c from community_experts where user_id = '${uApplicant}'`)).c === 0);
const expertId = (await one(`select public.approve_expert_application('${app}', 'orthopedist') as id`)).id;
const approved = await one(`select e.name, e.kind, e.specialty_key, e.rating::float8 r, e.review_count, e.user_id, a.status, a.specialty_key as app_key, a.reviewed_by from community_experts e join expert_applications a on a.user_id = e.user_id where e.id = $1`, [expertId]);
check("aprovimi krijon ekspertin me repartin e zgjedhur nga admini (jo atë të aplikimit)", approved.specialty_key === "orthopedist" && approved.kind === "Ortoped" && approved.app_key === "orthopedist" && approved.status === "approved", JSON.stringify(approved));
check("vlerësimi fillestar është 0 (jo 5.0 i shpikur)", approved.r === 0 && approved.review_count === 0);
check("aplikimi shënon kush e aprovoi", approved.reviewed_by === uAdmin);
await rejects("aplikimi i aprovuar nuk aprovohet dy herë", () => db.query(`select public.approve_expert_application('${app}')`), "shqyrtuar");
await rejects("aplikim që s'ekziston refuzohet", () => db.query(`select public.approve_expert_application(gen_random_uuid())`), "nuk u gjet");

// aplikim pa reparte të zgjedhur: përdoret teksti i vjetër
const app2 = (await one(`insert into expert_applications (user_id, full_name, license_number, specialization) values ('${await user()}', 'Dr. Tek', 'L3', 'Diçka e lirë') returning id`)).id;
const e2 = (await one(`select public.approve_expert_application('${app2}') as id`)).id;
const r2 = await one(`select kind, specialty_key from community_experts where id = $1`, [e2]);
check("pa reparte: eksperti merr tekstin e aplikimit dhe asnjë reparte", r2.kind === "Diçka e lirë" && r2.specialty_key === null, JSON.stringify(r2));

// ri-aprovim për një përdorues që është tashmë ekspert: përditëson, s'bën dublikat
const app3 = (await one(`insert into expert_applications (user_id, full_name, license_number, specialization, specialty_key) values ('${uApplicant}', 'Dr. Gj Ri', 'L9', 'Psikolog/e', 'psychologist') returning id`)).id;
await db.exec(`select public.approve_expert_application('${app3}')`);
const dup = await one(`select count(*)::int c, max(name) n, max(specialty_key) s from community_experts where user_id = '${uApplicant}'`);
check("ri-aprovimi përditëson ekspertin ekzistues (pa dublikat)", dup.c === 1 && dup.n === "Dr. Gj Ri" && dup.s === "psychologist", JSON.stringify(dup));

// 5) të drejtat
const priv = async (role, sig) => (await one(`select has_function_privilege('${role}', '${sig}', 'execute') as ok`)).ok;
check("anon NUK thërret approve_expert_application", !(await priv("anon", "public.approve_expert_application(uuid,text)")));
check("authenticated e thërret (admini kontrollohet brenda)", await priv("authenticated", "public.approve_expert_application(uuid,text)"));

// 6) migrimi mund të rinisë pa dëm
try { await db.exec(fs.readFileSync(MIGRATION, "utf8")); check("migrimi ri-ekzekutohet pa gabim (idempotent)", true); } catch (e) { check("migrimi ri-ekzekutohet pa gabim (idempotent)", false, e.message.slice(0, 120)); }
check("ri-ekzekutimi s'dyfishon reparte", (await one(`select count(*)::int c from community_specialties`)).c === specs.length);

console.log(`\n${pass} kaluan, ${fail} dështuan`);
process.exit(fail ? 1 : 0);
