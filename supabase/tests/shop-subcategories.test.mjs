/**
 * Prova e nënkategorive të dyqanit (migrimi 20261105090000) në një Postgres lokal (PGlite).
 * Nisja:  node supabase/tests/shop-subcategories.test.mjs   (me @electric-sql/pglite të instaluar)
 */
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";

// Si Supabase pas 30 tetorit 2026: tabelat e reja s'marrin më leje vetë (tabelat bazë i kanë, si në prodhim).
const AFTER_OCT_30 = "create role service_role bypassrls; alter default privileges in schema public revoke all on tables from anon, authenticated;";

const AGE = new URL("../migrations/20261021090100_age_system_02_shop.sql", import.meta.url);
const MIGRATION = new URL("../migrations/20261105090000_shop_subcategories.sql", import.meta.url);
const db = new PGlite();
process.on("uncaughtException", (e) => { console.log("GABIM i papritur:", String(e.message).slice(0, 300)); process.exit(1); });

await db.exec(`
create role anon; create role authenticated;
grant usage on schema public to anon, authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated;
create table public.admins (id int);
create or replace function public.is_admin() returns boolean language sql stable as $$ select exists (select 1 from public.admins) $$;
create table public.categories (id uuid primary key default gen_random_uuid(), key text not null unique, label text not null,
  icon text not null default '', sort_order int not null default 0, created_at timestamptz not null default now(), label_en text);
create table public.brands (id uuid primary key default gen_random_uuid(), name text not null);
create table public.products (id uuid primary key default gen_random_uuid(), name text not null, brand_id uuid, category_id uuid,
  price numeric not null default 1, compare_at_price numeric, rating numeric not null default 0, is_active boolean not null default true,
  stock integer not null default 0, image_url text,
  created_at timestamptz not null default now(), min_age_months jsonb, max_age_months jsonb);
alter table public.products enable row level security;
create policy "products_public_read" on public.products for select using (is_active = true);
grant select on public.products, public.categories, public.brands to anon, authenticated;
`);

const one = async (q, p) => (await db.query(q, p)).rows[0];
const all = async (q, p) => (await db.query(q, p)).rows;
const feeding = (await one(`insert into public.categories (key, label, label_en) values ('Ushqyerje', 'Ushqyerje', 'Feeding') returning id`)).id;
const mom = (await one(`insert into public.categories (key, label) values ('Për nënën', 'Për nënën') returning id`)).id;
const nuk = (await one(`insert into public.brands (name) values ('NUK') returning id`)).id;

// Tetë produktet e prodhimit, me të njëjtat id dhe emra.
const PRODUCTS = [
  ["94ab0f18-91ee-419d-a87f-a8a95776a0c9", "Thithka anti-kolike, rrjedhje 3, 2 copë", 2],
  ["4bc4dd08-fe29-4cb2-bb03-0b42d3025019", "Pompë elektrike gjiri Natural Motion", 0],
  ["86859dd3-d6a4-49cc-a3b9-f515cfd40480", "Enë për qumështin e gjirit, 10 × 180 ml", 3],
  ["978c1aeb-9af7-4e00-8392-be431f4213f5", "Ngrohëse shishesh Kidwell 4 në 1", 0],
  ["713d6083-e8c4-427e-9ff4-d327d6aed9ee", "Qese sterilizimi për mikrovalë, 5 copë", 8],
  ["4f1b956d-0bd7-484a-8ab6-ff1eb6e57ce4", "Thithëse nate Signature, 2 copë", 8],
  ["132e83b3-1396-41a1-b49c-1c6ff9edb0d0", "Thithëse silikoni, 0–6 muaj", 0],
  ["c1420c1f-0066-4d3c-8143-920863e0ece4", "Shishe uji Mini-Me Sip, 300 ml", 0],
];
let minute = 0;
for (const [id, name, stock] of PRODUCTS) {
  minute += 1;
  await db.query(
    `insert into public.products (id, name, category_id, stock, image_url, brand_id, created_at) values ($1, $2, $3, $4, $5, $6, now() - ($7 || ' minutes')::interval)`,
    [id, name, feeding, stock, `https://x.supabase.co/storage/v1/object/public/p/${minute}.webp`, name.includes("Thithëse") ? nuk : null, String(minute)],
  );
}
await db.query(`insert into public.products (name, category_id, is_active) values ('Joaktiv', $1, false)`, [feeding]);

await db.exec(fs.readFileSync(AGE, "utf8"));
await db.exec(AFTER_OCT_30);
try { await db.exec(fs.readFileSync(MIGRATION, "utf8")); console.log("OK  migrimi u ekzekutua pa gabime"); }
catch (e) { console.log("GABIM te migrimi:", e.message); process.exit(1); }
try { await db.exec(fs.readFileSync(MIGRATION, "utf8")); console.log("OK  migrimi i dytë pa gabime"); }
catch (e) { console.log("GABIM te ekzekutimi i dytë:", e.message); process.exit(1); }

let pass = 0, fail = 0;
const check = (name, ok, extra = "") => { (ok ? pass++ : fail++); console.log((ok ? "OK  " : "GABIM ") + name + (extra ? "  -> " + extra : "")); };

// --- Të dhënat ---
check("kategoria quhet 'Ushqyerja', çelësi mbetet 'Ushqyerje'",
  (await one(`select label from public.categories where key = 'Ushqyerje'`)).label === "Ushqyerja");
const subs = await all(`select key from public.subcategories order by sort_order`);
check("nëntë nënkategori, pa dublim pas dy ekzekutimeve", subs.length === 9, subs.map((s) => s.key).join(", "));
const assigned = await all(`select p.name, s.key from public.products p join public.subcategories s on s.id = p.subcategory_id order by p.name`);
check("të tetë produktet kanë nënkategori", assigned.length === 8, assigned.map((r) => `${r.name}→${r.key}`).join(" | "));
const renamed = await all(`select name from public.products where id in ('4f1b956d-0bd7-484a-8ab6-ff1eb6e57ce4','132e83b3-1396-41a1-b49c-1c6ff9edb0d0') order by name`);
check("qetësuesit quhen 'Biberon qetësues…'", renamed.every((r) => r.name.startsWith("Biberon qetësues")), renamed.map((r) => r.name).join(", "));
check("search_text: pa shkronja të mëdha dhe pa ë/ç",
  (await one(`select search_text from public.products where id = '4bc4dd08-fe29-4cb2-bb03-0b42d3025019'`)).search_text === "pompe elektrike gjiri natural motion");

// --- Trigger-i ---
const sub = async (key) => (await one(`select id from public.subcategories where key = $1`, [key])).id;
const p1 = (await one(`insert into public.products (name, subcategory_id, stock) values ('Gotë me pipë', $1, 5) returning id, category_id`, [await sub("gota-ene")]));
check("zgjedh nënkategorinë → kategoria vendoset vetë", p1.category_id === feeding);
await db.query(`update public.products set category_id = $1 where id = $2`, [mom, p1.id]);
const moved = await one(`select category_id, subcategory_id from public.products where id = $1`, [p1.id]);
check("ndërron kategorinë → nënkategoria e huaj hiqet", moved.category_id === mom && moved.subcategory_id === null);
await db.query(`update public.products set subcategory_id = $1 where id = $2`, [await sub("gota-ene"), p1.id]);
check("vendos nënkategorinë sërish → kategoria kthehet", (await one(`select category_id from public.products where id = $1`, [p1.id])).category_id === feeding);
await db.query(`update public.products set is_active = false where id = $1`, [p1.id]);

// --- Si vizitor (anon) ---
await db.exec("set role anon");
const shopSubs = await all(`select key, product_count, cover_url from public.shop_subcategories('Ushqyerje')`);
check("dyqani: vetëm nënkategoritë me produkte aktive (5)",
  shopSubs.map((s) => s.key).join(",") === "shishe-thithka,gjidhenia,sterilizues-ngrohes,biberone-qetesues,gota-ene",
  shopSubs.map((s) => `${s.key}:${s.product_count}`).join(", "));
const g = shopSubs.find((s) => s.key === "gjidhenia");
check("numri dhe fotoja e çipit (gjidhënia: 2, fotoja e produktit në stok)", Number(g.product_count) === 2 && g.cover_url.endsWith("/3.webp"), `${g.product_count} ${g.cover_url}`);
check("kategori pa nënkategori → listë bosh", (await all(`select * from public.shop_subcategories('Për nënën')`)).length === 0);

const order = async (args) => {
  const rows = await all(`select p.name from public.shop_product_order(p_category => $1, p_search => $2, p_subcategory => $3, p_limit => 50) o
    join public.products p on p.id = o.product_id order by o.pos`, [args.category ?? null, args.search ?? null, args.sub ?? null]);
  return rows.map((r) => r.name);
};
const pacifiers = await order({ category: "Ushqyerje", sub: "biberone-qetesues" });
check("filtri i nënkategorisë: 2 qetësuesit", pacifiers.length === 2 && pacifiers.every((n) => n.startsWith("Biberon qetësues")), pacifiers.join(", "));
check("pa nënkategori: e gjithë Ushqyerja (8 aktive)", (await order({ category: "Ushqyerje" })).length === 8);
const cucla = await order({ search: "cucla" });
check("kërkimi 'cucla' gjen qetësuesit (fjalë e rrugës)", cucla.length === 2 && cucla.every((n) => n.startsWith("Biberon qetësues")), cucla.join(", "));
const qetesues = await order({ search: "qetesues" });
check("'qetesues' (pa ë) gjen qetësuesit", qetesues.length === 2, qetesues.join(", "));
const thithese = await order({ search: "thithese" });
check("'thithese' s'gjen më qetësuesit (në Prishtinë është aspirator hundësh)", thithese.length === 0, thithese.join(", "));
const bibs = await all(`select * from public.shop_subcategory_match('bibs')`);
check("'bibs' (markë qetësuesish) s'çon te përparëset", bibs.length === 0);
const pompe = await order({ search: "pompe" });
check("'pompe' (pa ë) gjen pompën dhe gjidhënien", pompe[0] === "Pompë elektrike gjiri Natural Motion" && pompe.includes("Enë për qumështin e gjirit, 10 × 180 ml"), pompe.join(", "));
const biberon = await order({ search: "biberon" });
check("'biberon' gjen qetësuesit, thithkat (fjalë me dy kuptime)",
  biberon.slice(0, 2).every((n) => n.startsWith("Biberon qetësues")) && biberon.includes("Thithka anti-kolike, rrjedhje 3, 2 copë"), biberon.join(", "));
check("kërkimi me 2 shkronja s'gjen nënkategori", (await all(`select * from public.shop_subcategory_match('gj')`)).length === 0);
const legacy = await all(`select * from public.shop_product_order(p_category => 'Ushqyerje', p_search => null, p_sort => 'newest', p_age_from => null,
  p_age_to => null, p_pregnancy => false, p_offset => 0, p_limit => 20, p_on_sale => false, p_brand => null)`);
check("thirrja e vjetër (pa p_subcategory) punon", legacy.length === 8);

let denied = false;
try { await db.query(`insert into public.subcategories (category_id, key, label) values ($1, 'test', 'Test')`, [feeding]); }
catch { denied = true; }
check("vizitori s'shton dot nënkategori", denied);
await db.exec("reset role");

await db.exec("set role authenticated");
let adminOk = true;
await db.exec("reset role");
await db.exec("insert into public.admins values (1)");
await db.exec("set role authenticated");
try { await db.query(`insert into public.subcategories (category_id, key, label) values ($1, 'pjata-test', 'Pjata test')`, [feeding]); }
catch (e) { adminOk = false; console.log("   ", e.message); }
check("admini shton nënkategori", adminOk);
let badKey = false;
try { await db.query(`insert into public.subcategories (category_id, key, label) values ($1, 'Me Hapësira', 'X')`, [feeding]); }
catch { badKey = true; }
check("çelësi me shkronja të mëdha/hapësira refuzohet", badKey);
await db.exec("reset role");

console.log(`\n${pass} OK, ${fail} gabime`);
process.exit(fail ? 1 : 0);
