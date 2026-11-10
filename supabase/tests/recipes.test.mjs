/**
 * Prova e recetave (PGlite): të gjithë lexojnë vetëm të publikuarat, vetëm adminët shtojnë/ndryshojnë, njësitë e
 * përbërësve janë vetëm ato të lejuarat, çdo prind sheh dhe ndryshon vetëm të preferuarat e veta, bucket-i i fotove
 * pranon ngarkime vetëm nga adminët, dhe të dy migrimet ekzekutohen dy herë pa gabim dhe pa i dyfishuar recetat.
 * Biblioteka në bazë duhet të jetë e njëjtë me content/recipes/sq.json (kopja që vjen me app-in).
 * Nisja:  node supabase/tests/recipes.test.mjs   (me @electric-sql/pglite të instaluar)
 */
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";

// Si Supabase pas 30 tetorit 2026: tabelat e reja s'marrin më leje vetë.
const AFTER_OCT_30 = "create role service_role bypassrls; alter default privileges in schema public revoke all on tables from anon, authenticated;";

const TABLE = new URL("../migrations/20261110090000_recipes.sql", import.meta.url);
const LIBRARY = new URL("../migrations/20261110090100_recipes_library_1.sql", import.meta.url);
const LIBRARY_2 = new URL("../migrations/20261112090100_recipes_library_2.sql", import.meta.url);
const SEED = JSON.parse(fs.readFileSync(new URL("../../content/recipes/sq.json", import.meta.url), "utf8"));
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
for (const [file, label] of [[TABLE, "tabela"], [LIBRARY, "biblioteka"], [LIBRARY_2, "receta e dimrit"]]) {
  for (const name of ["i pari", "i dyti"]) {
    try { await db.exec(fs.readFileSync(file, "utf8")); console.log(`OK  migrimi i ${label}s (${name})`); }
    catch (e) { console.log(`GABIM te migrimi i ${label}s:`, e.message); process.exit(1); }
  }
}

let pass = 0, fail = 0;
const check = (name, ok, extra = "") => { (ok ? pass++ : fail++); console.log((ok ? "OK  " : "GABIM ") + name + (extra ? "  -> " + extra : "")); };
const fails = async (q) => { try { await db.query(q); return false; } catch { return true; } };
const n = async (q) => (await db.query(q)).rows[0].n;

const admin = "11111111-1111-1111-1111-111111111111", user = "22222222-2222-2222-2222-222222222222", other = "33333333-3333-3333-3333-333333333333";
await db.query(`insert into auth.users values ($1), ($2), ($3)`, [admin, user, other]);
await db.query(`insert into public.admins values ($1)`, [admin]);
const as = async (uid) => { await db.exec(`reset role; select set_config('test.uid', '${uid ?? ""}', false); ${uid ? "set role authenticated;" : "set role anon;"}`); };

// --- Biblioteka = kopja e app-it ---------------------------------------------
check(`recetat fillestare: ${SEED.length}, pa dyfishim pas dy ekzekutimeve`, (await n(`select count(*)::int n from public.recipes`)) === SEED.length);
const rows = (await db.query(`select * from public.recipes order by sort_order`)).rows;
const bySlug = new Map(rows.map((r) => [r.slug, r]));
const diffs = [];
for (const s of SEED) {
  const r = bySlug.get(s.slug);
  if (!r) { diffs.push(`${s.slug}: mungon`); continue; }
  // JSONB i rendit çelësat vetë: krahasohet përmbajtja, jo radha e çelësave.
  const canon = (v) => (Array.isArray(v) ? v.map(canon) : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canon(v[k])])) : v);
  const same = (a, b) => JSON.stringify(canon(a)) === JSON.stringify(canon(b));
  const ing = s.ingredients.map((i) => ({ name: i.name, amount: i.amount, unit: i.unit, food_key: i.foodKey ?? null, ...(i.optional ? { optional: true } : {}) }));
  const pairs = [
    ["title", r.title, s.title], ["summary", r.summary, s.summary], ["steps", r.steps, s.steps], ["ingredients", r.ingredients, ing],
    ["serve_by_age", r.serve_by_age, s.serveByAge], ["allergens", r.allergens, s.allergens], ["diet_tags", r.diet_tags, s.dietTags],
    ["nutrients", r.nutrients, s.nutrients], ["choking_note", r.choking_note, s.chokingNote], ["family_tip", r.family_tip, s.familyTip],
    ["age", [r.age_min_months, r.age_max_months], [s.ageMinMonths, s.ageMaxMonths]], ["family_factor", Number(r.family_factor), s.familyFactor],
  ];
  for (const [field, a, b] of pairs) if (!same(a, b)) diffs.push(`${s.slug}.${field}`);
}
check("çdo recetë në bazë është e njëjtë me kopjen e app-it (tekstet, përbërësit, alergjenët)", diffs.length === 0, diffs.slice(0, 5).join(", "));
check("të gjitha të publikuara, me published_at", rows.every((r) => r.status === "published" && r.published_at != null));

// --- Kontrollet e tabelës ------------------------------------------------------
await as(admin);
const insert = (slug, ingredients, extra = "") =>
  `insert into public.recipes (slug, title, ingredients, steps${extra ? ", " + extra.split("=")[0] : ""}) values ('${slug}', 'Provë', '${JSON.stringify(ingredients)}'::jsonb, array['Hapi i parë.']${extra ? ", " + extra.split("=")[1] : ""})`;
const ok1 = [{ name: "karotë", amount: 1, unit: "copë", food_key: "carrot" }];
check("admini shton recetë (draft)", !(await fails(insert("draft-test", ok1))));
check("admini e sheh draft-in", (await n(`select count(*)::int n from public.recipes where slug = 'draft-test'`)) === 1);
check("njësia 'kg' refuzohet", await fails(insert("x-kg", [{ name: "mish", amount: 1, unit: "kg" }])));
check("njësia 'majë' refuzohet", await fails(insert("x-maje", [{ name: "kripë", amount: 1, unit: "majë" }])));
check("sasia zero refuzohet", await fails(insert("x-zero", [{ name: "karotë", amount: 0, unit: "copë" }])));
check("sasia si tekst refuzohet", await fails(insert("x-text", [{ name: "karotë", amount: "një", unit: "copë" }])));
check("receta pa përbërës refuzohet", await fails(insert("x-empty", [])));
check("alergjen i panjohur refuzohet", await fails(insert("x-allergen", ok1, "allergens=array['gluten']")));
check("stad i panjohur refuzohet", await fails(insert("x-stage", ok1, "stage='solid'")));
check("mosha e pavlefshme refuzohet", await fails(`insert into public.recipes (slug, title, ingredients, steps, age_min_months, age_max_months) values ('x-age', 'X', '${JSON.stringify(ok1)}'::jsonb, array['a'], 24, 12)`));
check("slug i pavlefshëm refuzohet", await fails(insert("Me Hapësira", ok1)));
check("foto pa https refuzohet", await fails(insert("x-url", ok1, "cover_url='http://x.com/a.png'")));
const before = (await db.query(`select updated_at from public.recipes where slug = 'draft-test'`)).rows[0].updated_at;
await new Promise((r) => setTimeout(r, 15));
await db.query(`update public.recipes set status = 'published' where slug = 'draft-test'`);
const after = (await db.query(`select updated_at, published_at from public.recipes where slug = 'draft-test'`)).rows[0];
check("ndryshimi e rrit updated_at dhe vendos published_at", after.updated_at > before && after.published_at != null);
await db.query(`update public.recipes set status = 'draft' where slug = 'draft-test'`);

// --- Kush lexon dhe kush shkruan ---------------------------------------------
await as(null);
check("mysafiri lexon vetëm të publikuarat", (await n(`select count(*)::int n from public.recipes`)) === SEED.length);
check("mysafiri s'shton receta", await fails(insert("anon", ok1)));
check("mysafiri s'ka të preferuara", await fails(`select * from public.recipe_favorites`));

await as(user);
check("prindi s'e sheh draft-in", (await n(`select count(*)::int n from public.recipes where slug = 'draft-test'`)) === 0);
check("prindi s'shton receta", await fails(insert("u", ok1)));
await db.query(`update public.recipes set title = 'Ndryshuar' where slug = 'sutliash-pa-sheqer'`);
await db.query(`delete from public.recipes where slug = 'sutliash-pa-sheqer'`);
await as(admin);
check("prindi s'ndryshon dhe s'fshin receta", (await db.query(`select title from public.recipes where slug = 'sutliash-pa-sheqer'`)).rows[0]?.title === "Sutliash pa sheqer");

// --- Të preferuarat ------------------------------------------------------------
await as(user);
const fav = (slug, uid = user) => `insert into public.recipe_favorites (user_id, recipe_slug) values ('${uid}', '${slug}') on conflict (user_id, recipe_slug) do update set created_at = excluded.created_at`;
check("prindi ruan një të preferuar", !(await fails(fav("sutliash-pa-sheqer"))));
check("e njëjta e preferuar sërish (upsert i app-it) s'jep gabim", !(await fails(fav("sutliash-pa-sheqer"))));
check("s'ruan të preferuar në emër të tjetrit", await fails(fav("musaka-me-patate", other)));
check("recetë që s'ekziston refuzohet", await fails(fav("s-ekziston")));
await as(other);
check("prindi tjetër s'i sheh të preferuarat e tij", (await n(`select count(*)::int n from public.recipe_favorites`)) === 0);
await db.query(`delete from public.recipe_favorites`);
await as(user);
check("prindi tjetër s'ia fshin dot të preferuarat", (await n(`select count(*)::int n from public.recipe_favorites`)) === 1);

// --- Fotot ---------------------------------------------------------------------
await db.exec("reset role");
const bucket = (await db.query(`select public, file_size_limit from storage.buckets where id = 'recipe-covers'`)).rows[0];
check("bucket-i recipe-covers: publik, deri 2 MB", bucket?.public === true && Number(bucket.file_size_limit) === 2097152);
await as(user);
check("prindi s'ngarkon foto recetash", await fails(`insert into storage.objects (bucket_id, name) values ('recipe-covers', 'a.png')`));
await as(admin);
check("admini ngarkon foto recetash", !(await fails(`insert into storage.objects (bucket_id, name) values ('recipe-covers', 'a.png')`)));

// Fshirja e recetës heq edhe të preferuarat e saj.
await db.query(`delete from public.recipes where slug = 'sutliash-pa-sheqer'`);
await db.exec("reset role");
check("fshirja e recetës heq të preferuarat e saj", (await n(`select count(*)::int n from public.recipe_favorites where recipe_slug = 'sutliash-pa-sheqer'`)) === 0);

console.log(`\n${pass} OK, ${fail} gabime`);
process.exit(fail ? 1 : 0);
