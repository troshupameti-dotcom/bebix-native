/**
 * Prova e përrallave (PGlite): të gjithë lexojnë vetëm të publikuarat, vetëm adminët shtojnë/ndryshojnë, çdo prind
 * sheh dhe ndryshon vetëm të preferuarat dhe leximin e vet, bucket-i i kopertinave pranon ngarkime vetëm nga adminët,
 * dhe migrimi ekzekutohet dy herë pa gabim dhe pa i dyfishuar përrallat.
 * Nisja:  node supabase/tests/stories.test.mjs   (me @electric-sql/pglite të instaluar)
 */
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";

// Si Supabase pas 30 tetorit 2026: tabelat e reja s'marrin më leje vetë.
const AFTER_OCT_30 = "create role service_role bypassrls; alter default privileges in schema public revoke all on tables from anon, authenticated;";

const MIGRATION = new URL("../migrations/20261024090000_stories.sql", import.meta.url);
const SEED = JSON.parse(fs.readFileSync(new URL("../../content/stories/sq.json", import.meta.url), "utf8"));
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
grant usage on schema storage to anon, authenticated;
grant select, insert, update, delete on storage.objects to authenticated;
`);
await db.exec(AFTER_OCT_30);
await db.exec("grant usage on schema public, auth, storage to service_role;");
for (const name of ["i pari", "i dyti"]) {
  try { await db.exec(fs.readFileSync(MIGRATION, "utf8")); console.log(`OK  migrimi (${name})`); }
  catch (e) { console.log("GABIM te migrimi:", e.message); process.exit(1); }
}

let pass = 0, fail = 0;
const check = (name, ok) => { (ok ? pass++ : fail++); console.log((ok ? "OK  " : "GABIM ") + name); };
const fails = async (q) => { try { await db.query(q); return false; } catch { return true; } };
const n = async (q) => (await db.query(q)).rows[0].n;

const admin = "11111111-1111-1111-1111-111111111111", user = "22222222-2222-2222-2222-222222222222", other = "33333333-3333-3333-3333-333333333333";
await db.query(`insert into auth.users values ($1), ($2), ($3)`, [admin, user, other]);
await db.query(`insert into public.admins values ($1)`, [admin]);
const as = async (uid) => { await db.exec(`reset role; select set_config('test.uid', '${uid ?? ""}', false); ${uid ? "set role authenticated;" : "set role anon;"}`); };

check(`përrallat fillestare: ${SEED.length}, pa dyfishim pas dy ekzekutimeve`, (await n(`select count(*)::int n from public.stories`)) === SEED.length);
const hena = (await db.query(`select title, paragraphs, published_at, reading_minutes from public.stories where slug = 'hena-qe-nuk-donte-te-flinte'`)).rows[0];
check("teksti ruhet saktë (apostrofët dhe thonjëzat «»)", hena.title === SEED[0].title && hena.paragraphs.length === SEED[0].paragraphs.length && hena.paragraphs[1] === SEED[0].paragraphs[1]);
check("published_at vendoset vetë", hena.published_at != null && hena.reading_minutes >= 1);

// Admini shton një përrallë në punë (draft).
await as(admin);
check("admini shton përrallë", !(await fails(`insert into public.stories (slug, title, paragraphs, categories) values ('draft-test', 'Provë', array['Një herë e një kohë.'], array['sleep'])`)));
check("admini e sheh draft-in", (await n(`select count(*)::int n from public.stories where slug = 'draft-test'`)) === 1);
check("kategori e panjohur refuzohet", await fails(`insert into public.stories (slug, title, paragraphs, categories) values ('x-cat', 'X', array['a'], array['horror'])`));
check("mosha e pavlefshme refuzohet", await fails(`insert into public.stories (slug, title, paragraphs, age_min_months, age_max_months) values ('x-age', 'X', array['a'], 36, 12)`));
check("slug i pavlefshëm refuzohet", await fails(`insert into public.stories (slug, title, paragraphs) values ('Me Hapësira', 'X', array['a'])`));
check("lidhje kopertine pa https refuzohet", await fails(`insert into public.stories (slug, title, paragraphs, cover_url) values ('x-url', 'X', array['a'], 'http://x.com/a.png')`));
const before = (await db.query(`select updated_at from public.stories where slug = 'draft-test'`)).rows[0].updated_at;
await new Promise((r) => setTimeout(r, 15));
await db.query(`update public.stories set status = 'published' where slug = 'draft-test'`);
const after = (await db.query(`select updated_at, published_at from public.stories where slug = 'draft-test'`)).rows[0];
check("ndryshimi e rrit updated_at (app-i e merr tekstin sërish)", after.updated_at > before && after.published_at != null);
await db.query(`update public.stories set status = 'draft' where slug = 'draft-test'`);

await as(null);
check("mysafiri lexon vetëm të publikuarat", (await n(`select count(*)::int n from public.stories`)) === SEED.length);
check("mysafiri s'shton përralla", await fails(`insert into public.stories (slug, title, paragraphs) values ('anon', 'X', array['a'])`));
check("mysafiri s'ka të preferuara", await fails(`select * from public.story_favorites`));

await as(user);
check("prindi s'e sheh draft-in", (await n(`select count(*)::int n from public.stories where slug = 'draft-test'`)) === 0);
check("prindi s'shton përralla", await fails(`insert into public.stories (slug, title, paragraphs) values ('u', 'X', array['a'])`));
await db.query(`update public.stories set title = 'Ndryshuar' where slug = 'varka-e-letres'`);
await db.query(`delete from public.stories where slug = 'varka-e-letres'`);
await as(admin);
check("prindi s'ndryshon dhe s'fshin përralla", (await db.query(`select title from public.stories where slug = 'varka-e-letres'`)).rows[0]?.title === "Varka e letrës");

// Të preferuarat dhe leximi.
await as(user);
const fav = (slug, uid = user) => `insert into public.story_favorites (user_id, story_slug) values ('${uid}', '${slug}') on conflict (user_id, story_slug) do update set created_at = excluded.created_at`;
check("prindi ruan një të preferuar", !(await fails(fav("varka-e-letres"))));
check("e njëjta e preferuar sërish (upsert i app-it) s'jep gabim", !(await fails(fav("varka-e-letres"))));
check("s'ruan të preferuar në emër të tjetrit", await fails(fav("reja-qe-qante", other)));
check("përrallë që s'ekziston refuzohet", await fails(fav("s-ekziston")));
const prog = (page, pages, uid = user) => `insert into public.story_progress (user_id, story_slug, page, pages, finished) values ('${uid}', 'varka-e-letres', ${page}, ${pages}, false) on conflict (user_id, story_slug) do update set page = excluded.page, pages = excluded.pages, finished = excluded.finished, updated_at = now()`;
check("prindi ruan faqen ku mbeti", !(await fails(prog(2, 7))));
check("faqja përditësohet", !(await fails(prog(4, 7))) && (await n(`select page as n from public.story_progress`)) === 4);
check("faqe jashtë përrallës refuzohet", await fails(prog(7, 7)));
check("s'ruan lexim në emër të tjetrit", await fails(prog(1, 7, other)));

await as(other);
check("prindi tjetër s'i sheh të preferuarat e tij", (await n(`select count(*)::int n from public.story_favorites`)) === 0);
check("prindi tjetër s'e sheh leximin e tij", (await n(`select count(*)::int n from public.story_progress`)) === 0);
await db.query(`delete from public.story_favorites`);
await as(user);
check("prindi tjetër s'ia fshin dot të preferuarat", (await n(`select count(*)::int n from public.story_favorites`)) === 1);
check("prindi e heq të preferuarën e vet", !(await fails(`delete from public.story_favorites where story_slug = 'varka-e-letres'`)) && (await n(`select count(*)::int n from public.story_favorites`)) === 0);

// Kopertinat.
await db.exec("reset role");
const bucket = (await db.query(`select public, file_size_limit from storage.buckets where id = 'story-covers'`)).rows[0];
check("bucket-i story-covers: publik, deri 2 MB", bucket?.public === true && Number(bucket.file_size_limit) === 2097152);
await as(user);
check("prindi s'ngarkon kopertina", await fails(`insert into storage.objects (bucket_id, name) values ('story-covers', 'a.png')`));
await as(admin);
check("admini ngarkon kopertina", !(await fails(`insert into storage.objects (bucket_id, name) values ('story-covers', 'a.png')`)));

// Fshirja e një përralle heq edhe leximin e saj.
await db.query(`delete from public.stories where slug = 'varka-e-letres'`);
await db.exec("reset role");
check("fshirja e përrallës heq leximin dhe të preferuarat e saj", (await n(`select count(*)::int n from public.story_progress where story_slug = 'varka-e-letres'`)) === 0);

console.log(`\n${pass} OK, ${fail} gabime`);
process.exit(fail ? 1 : 0);
