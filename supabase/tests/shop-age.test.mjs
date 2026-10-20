/**
 * Prova e renditjes së dyqanit sipas moshës (rank 0/1/2) në një Postgres lokal (PGlite).
 * Nisja:  node supabase/tests/shop-age.test.mjs   (me @electric-sql/pglite të instaluar)
 */
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";

// Si Supabase pas 30 tetorit 2026: tabelat e reja s'marrin më leje vetë (tabelat bazë më lart i kanë, si në prodhim).
// Kështu testi kap çdo tabelë të re pa GRANT, që në prodhim do të jepte "permission denied".
const AFTER_OCT_30 = "create role service_role; alter default privileges in schema public revoke all on tables from anon, authenticated;";

const MIGRATION = new URL("../migrations/20261021090100_age_system_02_shop.sql", import.meta.url);
const db = new PGlite();
process.on("uncaughtException", (e) => { console.log("GABIM i papritur:", String(e.message).slice(0, 300)); process.exit(1); });

await db.exec(`
create role anon; create role authenticated;
grant usage on schema public to anon, authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated;
create table public.categories (id uuid primary key default gen_random_uuid(), key text not null unique, label text not null,
  icon text not null default '', sort_order int not null default 0, created_at timestamptz not null default now(), label_en text);
create table public.brands (id uuid primary key default gen_random_uuid(), name text not null);
create table public.products (id uuid primary key default gen_random_uuid(), name text not null, brand_id uuid, category_id uuid,
  price numeric not null default 1, compare_at_price numeric, rating numeric not null default 0, is_active boolean not null default true,
  created_at timestamptz not null default now(), min_age_months jsonb, max_age_months jsonb);
alter table public.products enable row level security;
create policy "products_public_read" on public.products for select using (is_active = true);
grant select on public.products, public.categories, public.brands to anon, authenticated;
`);

const one = async (q, p) => (await db.query(q, p)).rows[0];
const all = async (q, p) => (await db.query(q, p)).rows;
const cat = async (key) => (await one(`insert into public.categories (key, label) values ($1, $1) returning id`, [key])).id;
const feeding = await cat("Ushqyerje"), mom = await cat("Për nënën"), nursery = await cat("Dhoma e bebit");
const brand = (await one(`insert into public.brands (name) values ('Chicco') returning id`)).id;
let t = 0;
const prod = async (name, min, max, category = feeding, extra = {}) => {
  t += 1;
  await db.query(`insert into public.products (name, min_age_months, max_age_months, category_id, created_at, price, brand_id, is_active, compare_at_price)
    values ($1, $2::jsonb, $3::jsonb, $4, now() - ($5 || ' minutes')::interval, $6, $7, $8, $9)`,
    [name, min, max, category, String(100 - t), extra.price ?? 10, extra.brand ?? null, extra.active ?? true, extra.sale ?? null]);
};
// Radha e krijimit = më i riu i fundit.
await prod("Thithëse 0–6", "0", "6");
await prod("Biberon 6–12", "6", "12");
await prod("Ngrohës gjiri", null, null, mom);
await prod("Shishe tekst", '"6"', '"24"');
await prod("Shtrat", null, null, nursery);
await prod("Lugë 12+", "12", null);
await prod("Universal", "null", null);
await prod("Çanta shkolle 36–72", "36", "72", feeding, { brand });
await prod("Joaktiv", null, null, feeding, { active: false });
await prod("Mosha e çuditshme", '"6 muaj"', null);

await db.exec(AFTER_OCT_30);
try { await db.exec(fs.readFileSync(MIGRATION, "utf8")); console.log("OK  migrimi u ekzekutua pa gabime"); }
catch (e) { console.log("GABIM te migrimi:", e.message); process.exit(1); }
try { await db.exec(fs.readFileSync(MIGRATION, "utf8")); console.log("OK  migrimi i dytë pa gabime"); }
catch (e) { console.log("GABIM te ekzekutimi i dytë:", e.message); process.exit(1); }

let pass = 0, fail = 0;
const check = (name, ok, extra = "") => { (ok ? pass++ : fail++); console.log((ok ? "OK  " : "GABIM ") + name + (extra ? "  -> " + extra : "")); };
const order = async (args) => {
  const rows = await all(`select o.pos, o.total_count, p.name from public.shop_product_order(
      p_category => $1, p_search => $2, p_sort => $3, p_age_from => $4, p_age_to => $5, p_pregnancy => $6, p_offset => $7, p_limit => $8, p_on_sale => $9) o
    join public.products p on p.id = o.product_id order by o.pos`,
    [args.category ?? null, args.search ?? null, args.sort ?? "newest", args.from ?? null, args.to ?? args.from ?? null,
     args.pregnancy ?? false, args.offset ?? 0, args.limit ?? 50, args.sale ?? false]);
  return { names: rows.map((r) => r.name), total: rows[0] ? Number(rows[0].total_count) : 0 };
};

await db.exec("set role anon");
const age8 = await order({ from: 8 });
check("asgjë s'fshihet: 9 produkte aktive për çdo moshë", age8.total === 9 && !age8.names.includes("Joaktiv"), String(age8.total));
const r = (n) => age8.names.indexOf(n);
check("8 muaj: përputhjet (Biberon 6–12, Shishe '6'–'24' tekst) dalin të parat",
  r("Biberon 6–12") < 2 && r("Shishe tekst") < 2, age8.names.join(", "));
check("pastaj universalet (pa moshë, null json, moshë e palexueshme)",
  ["Ngrohës gjiri", "Shtrat", "Universal", "Mosha e çuditshme"].every((n) => r(n) >= 2 && r(n) < 6));
check("në fund ato që s'përputhen, por janë aty", ["Thithëse 0–6", "Lugë 12+", "Çanta shkolle 36–72"].every((n) => r(n) >= 6));
check("brenda rankut: më të rejat të parat", r("Mosha e çuditshme") < r("Universal") && r("Universal") < r("Shtrat"));

const age48 = await order({ from: 48 });
check("4 vjeç: çanta e shkollës në krye, lugët 12+ përputhen", age48.names[0] === "Çanta shkolle 36–72" || age48.names[1] === "Çanta shkolle 36–72");
check("max përfshirës: 12 muaj përputhet me 6–12", (await order({ from: 12 })).names.indexOf("Biberon 6–12") < 3);

const preg = await order({ pregnancy: true });
check("shtatzënia: 'Për nënën' dhe 'Dhoma e bebit' në krye", new Set(preg.names.slice(0, 2)).has("Ngrohës gjiri") && new Set(preg.names.slice(0, 2)).has("Shtrat"), preg.names.join(", "));
check("shtatzënia: produktet për të porsalindurit para atyre për më të rritur",
  preg.names.indexOf("Thithëse 0–6") < preg.names.indexOf("Biberon 6–12") && preg.names.indexOf("Thithëse 0–6") < preg.names.indexOf("Lugë 12+"));

const none = await order({});
check("pa fëmijë: renditja e sotme (më të rejat), e plotë", none.total === 9 && none.names[0] === "Mosha e çuditshme");
const band = await order({ from: 0, to: 3 });
check("grupmosha 0–3 (çipi): rendit, s'filtron", band.total === 9 && band.names[0] === "Thithëse 0–6");

const search = await order({ search: "bib", from: 8 });
check("kërkimi gjen emrin dhe s'ka të tjera", search.total === 1 && search.names[0] === "Biberon 6–12");
const brandSearch = await order({ search: "chicco" });
check("kërkimi gjen edhe markën", brandSearch.names.includes("Çanta shkolle 36–72"));
const tie = await order({ search: "sh", from: 8 });
check("kërkimi: fillimi i emrit para mesit, ranku si tie-breaker", tie.names[0] === "Shishe tekst" && tie.names[1] === "Shtrat", tie.names.join(", "));

const cat1 = await order({ category: "Për nënën", from: 8 });
check("kategoria: vetëm produktet e saj", cat1.total === 1);
const page2 = await order({ from: 8, offset: 3, limit: 3 });
check("faqosja: faqja e dytë vazhdon radhën pa dublikata", JSON.stringify(page2.names) === JSON.stringify(age8.names.slice(3, 6)));
const priced = await order({ from: 8, sort: "priceAsc" });
check("renditja sipas çmimit vlen brenda rankut", priced.total === 9);

await db.exec("reset role");
check("tri kategoritë e reja, me anglisht dhe ikonë", (await all(`select key from public.categories where key in ('shkolla','lodra-edukative','veshje-femije') and label_en is not null and icon <> ''`)).length === 3);
check("kategoritë ekzistuese s'u prekën", (await one(`select count(*)::int n from public.categories`)).n === 6);

console.log(`\n${pass} OK, ${fail} gabime`);
process.exit(fail ? 1 : 0);
