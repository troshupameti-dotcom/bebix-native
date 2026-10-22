/**
 * Prova e përrallës së javës (PGlite): draftet e Claude-it s'i shohin prindërit, admini i sheh, i ndryshon dhe i
 * publikon; kontrollet e kolonave të reja; migrimi ekzekutohet dy herë (edhe pa pg_cron, si këtu).
 * Nisja:  node supabase/tests/story-drafts.test.mjs   (me @electric-sql/pglite të instaluar)
 */
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";

const AFTER_OCT_30 = "create role service_role bypassrls; alter default privileges in schema public revoke all on tables from anon, authenticated;";
const STORIES = new URL("../migrations/20261024090000_stories.sql", import.meta.url);
const DRAFTS = new URL("../migrations/20261025090000_story_drafts.sql", import.meta.url);
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
grant execute on function public.is_admin() to authenticated;
create schema storage;
create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
alter table storage.objects enable row level security;
`);
await db.exec(AFTER_OCT_30);
await db.exec("grant usage on schema public, auth, storage to service_role;");
await db.exec(fs.readFileSync(STORIES, "utf8"));
for (const name of ["i pari", "i dyti"]) {
  try { await db.exec(fs.readFileSync(DRAFTS, "utf8")); console.log(`OK  migrimi i drafteve (${name})`); }
  catch (e) { console.log("GABIM te migrimi:", e.message); process.exit(1); }
}

let pass = 0, fail = 0;
const check = (name, ok) => { (ok ? pass++ : fail++); console.log((ok ? "OK  " : "GABIM ") + name); };
const fails = async (q) => { try { await db.query(q); return false; } catch { return true; } };
const n = async (q) => (await db.query(q)).rows[0].n;

const admin = "11111111-1111-1111-1111-111111111111", user = "22222222-2222-2222-2222-222222222222";
await db.query(`insert into auth.users values ($1), ($2)`, [admin, user]);
await db.query(`insert into public.admins values ($1)`, [admin]);
const as = async (uid) => { await db.exec(`reset role; select set_config('test.uid', '${uid ?? ""}', false); ${uid ? "set role authenticated;" : "set role anon;"}`); };

check("përrallat ekzistuese mbeten 'editor'", (await n(`select count(*)::int n from public.stories where source = 'editor'`)) === 14);

// Funksioni në server (service_role) ruan draftin e Claude-it.
await db.exec("reset role; set role service_role");
const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 120"><rect x="0" y="0" width="160" height="120" fill="#21403F"/></svg>';
check("serveri ruan draftin e Claude-it", !(await fails(`insert into public.stories (slug, title, summary, paragraphs, categories, status, source, cover_key, cover_svg, ai_idea) values ('pema-e-dimrit', 'Pema e dimrit', 'Një pemë pret pranverën.', array['Një herë e një kohë.', 'Fund.'], array['nature'], 'draft', 'ai', 'seed', '${svg}', 'Për dimrin')`)));
check("burim i panjohur refuzohet", await fails(`insert into public.stories (slug, title, paragraphs, source) values ('x-src', 'X', array['a'], 'robot')`));
check("ilustrim shumë i madh refuzohet", await fails(`insert into public.stories (slug, title, paragraphs, cover_svg) values ('x-svg', 'X', array['a'], repeat('a', 20001))`));
check("ide shumë e gjatë refuzohet", await fails(`insert into public.stories (slug, title, paragraphs, ai_idea) values ('x-idea', 'X', array['a'], repeat('a', 301))`));

await as(null);
check("mysafiri s'e sheh draftin", (await n(`select count(*)::int n from public.stories where slug = 'pema-e-dimrit'`)) === 0);
await as(user);
check("prindi s'e sheh draftin", (await n(`select count(*)::int n from public.stories where slug = 'pema-e-dimrit'`)) === 0);
await db.query(`update public.stories set status = 'published' where slug = 'pema-e-dimrit'`);
await as(admin);
check("prindi s'e publikon dot vetë", (await db.query(`select status from public.stories where slug = 'pema-e-dimrit'`)).rows[0].status === "draft");

check("admini sheh draftin me burimin, idenë dhe ilustrimin", (await db.query(`select source, ai_idea, cover_svg from public.stories where slug = 'pema-e-dimrit'`)).rows[0]?.source === "ai");
check("admini ndryshon tekstin", !(await fails(`update public.stories set title = 'Pema e dimrit të bardhë', paragraphs = array['Një.', 'Dy.', 'Tre.'] where slug = 'pema-e-dimrit'`)));
await db.query(`update public.stories set status = 'published' where slug = 'pema-e-dimrit'`);
const pub = (await db.query(`select status, published_at from public.stories where slug = 'pema-e-dimrit'`)).rows[0];
check("admini e publikon; data e publikimit vendoset vetë", pub.status === "published" && pub.published_at != null);
await as(user);
check("pas publikimit prindi e sheh", (await n(`select count(*)::int n from public.stories where slug = 'pema-e-dimrit'`)) === 1);

console.log(`\n${pass} OK, ${fail} gabime`);
process.exit(fail ? 1 : 0);
