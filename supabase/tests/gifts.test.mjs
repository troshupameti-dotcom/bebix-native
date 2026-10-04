/**
 * Prova e migrimit të listës së dhuratave në një Postgres lokal (PGlite), pa prekur bazën e vërtetë.
 * Skema është e thjeshtuar (vetëm tabelat që përdor migrimi), por kontrollon sintaksën dhe logjikën e plotë.
 *
 * Nisja (nga rrënja e projektit):
 *   npm i --no-save @electric-sql/pglite
 *   node supabase/tests/gifts.test.mjs
 */
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";

const MIGRATION = new URL("../migrations/20261004120000_gift_lists.sql", import.meta.url);
const db = new PGlite();
process.on("uncaughtException", (e) => { console.log("GABIM i papritur:", String(e.message).slice(0, 300)); process.exit(1); });

await db.exec(`
create role anon; create role authenticated;
create schema auth;
create table auth.users (id uuid primary key default gen_random_uuid());
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
create table public.products (id uuid primary key default gen_random_uuid(), name text, price numeric, stock int, is_active boolean default true, image_url text);
grant usage on schema public to anon, authenticated;
`);

try {
  await db.exec(fs.readFileSync(MIGRATION, "utf8"));
  console.log("OK  migrimi u ekzekutua pa gabime");
} catch (e) { console.log("GABIM te migrimi:", e.message); process.exit(1); }

// si Supabase: roli authenticated ka privilegje, RLS vendos kufijtë
await db.exec(`grant all on all tables in schema public to authenticated; grant select on public.products to authenticated;`);

let pass = 0, fail = 0;
const check = (name, ok, extra = "") => { (ok ? pass++ : fail++); console.log((ok ? "OK  " : "GABIM ") + name + (extra ? "  -> " + extra : "")); };
const as = async (role, sub) => { await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${sub ?? ""}', false); ${role === "super" ? "" : `set role ${role};`}`); };
const q = async (sql, params) => (await db.query(sql, params)).rows;
const rejects = async (name, fn, fragment) => { try { await fn(); check(name, false, "nuk u refuzua"); } catch (e) { check(name, e.message.toLowerCase().includes(fragment.toLowerCase()), e.message.slice(0, 80)); } };

await as("super");
const U1 = (await q(`insert into auth.users default values returning id`))[0].id;
const U2 = (await q(`insert into auth.users default values returning id`))[0].id;
const P1 = (await q(`insert into products (name, price, stock, image_url) values ('Biberon', 9.99, 5, 'http://x/1.jpg') returning id`))[0].id;
const P2 = (await q(`insert into products (name, price, stock) values ('Pelena', 12, 0) returning id`))[0].id;

// pronari krijon listën dhe shton produkte
await as("authenticated", U1);
const list = (await q(`insert into gift_lists (owner_id, title, message) values ($1, 'Lista e Elës', 'Faleminderit!') returning id, slug`, [U1]))[0];
check("lista krijohet me slug automatik", /^[a-z0-9]{10}$/.test(list.slug), list.slug);
await rejects("një listë për përdorues", () => q(`insert into gift_lists (owner_id) values ($1)`, [U1]), "unique");
await rejects("nuk mund të krijosh listë për dikë tjetër", () => q(`insert into gift_lists (owner_id) values ($1)`, [U2]), "row-level security");
const item1 = (await q(`insert into gift_list_items (list_id, product_id, qty) values ($1, $2, 2) returning id`, [list.id, P1]))[0].id;
const item2 = (await q(`insert into gift_list_items (list_id, product_id, qty) values ($1, $2, 1) returning id`, [list.id, P2]))[0].id;
await rejects("i njëjti produkt dy herë te lista", () => q(`insert into gift_list_items (list_id, product_id) values ($1, $2)`, [list.id, P1]), "unique");

// vizitori (anon): s'lexon tabelat, lexon vetëm funksionin publik
await as("anon");
await rejects("anon nuk lexon gift_lists", () => q(`select * from gift_lists`), "permission denied");
await rejects("anon nuk lexon gift_reservations", () => q(`select * from gift_reservations`), "permission denied");
let pub = (await q(`select public.gift_list_public($1) as v`, [list.slug]))[0].v;
check("lista publike kthen titullin dhe 2 produkte", pub.title === "Lista e Elës" && pub.items.length === 2, JSON.stringify(pub).slice(0, 90));
check("produkti pa stok shënohet jo aktiv", pub.items.find((i) => i.name === "Pelena").active === false && pub.items.find((i) => i.name === "Biberon").active === true);
check("lidhje e gabuar kthen null", (await q(`select public.gift_list_public('gabim000000') as v`))[0].v === null);
check("slug-u pranohet me shkronja të mëdha", (await q(`select public.gift_list_public($1) as v`, [list.slug.toUpperCase()]))[0].v !== null);

// rezervimet
await q(`select public.gift_reserve($1, $2, 'Gjyshja Flora', 1)`, [list.slug, item1]);
pub = (await q(`select public.gift_list_public($1) as v`, [list.slug]))[0].v;
check("rezervimi rrit sasinë e rezervuar", pub.items.find((i) => i.name === "Biberon").reserved_qty === 1);
check("lista publike nuk tregon emra rezervuesish", !JSON.stringify(pub).includes("Flora"));
await q(`select public.gift_reserve($1, $2, 'Daja Arben', 1)`, [list.slug, item1]);
await rejects("nuk rezervohet më shumë se sa kërkohet", () => q(`select public.gift_reserve($1, $2, 'Shoqja Ana', 1)`, [list.slug, item1]), "rezervuar");
await rejects("emër shumë i shkurtër", () => q(`select public.gift_reserve($1, $2, 'A', 1)`, [list.slug, item2]), "emrin");
await rejects("sasi e pavlefshme", () => q(`select public.gift_reserve($1, $2, 'Ana Berisha', 0)`, [list.slug, item2]), "sasi");
await rejects("lidhje e gabuar", () => q(`select public.gift_reserve('gabim000000', $1, 'Ana Berisha', 1)`, [item2]), "nuk u gjet");
await rejects("dhuratë e një liste tjetër", () => q(`select public.gift_reserve($1, gen_random_uuid(), 'Ana Berisha', 1)`, [list.slug]), "nuk u gjet");

// pronari sheh rezervimet; një përdorues tjetër jo
await as("authenticated", U1);
const res = await q(`select name, qty from gift_reservations order by created_at`);
check("pronari i sheh rezervimet me emra", res.length === 2 && res[0].name === "Gjyshja Flora", JSON.stringify(res));
await as("authenticated", U2);
check("përdoruesi tjetër nuk sheh listën", (await q(`select * from gift_lists`)).length === 0);
check("përdoruesi tjetër nuk sheh produktet e listës", (await q(`select * from gift_list_items`)).length === 0);
check("përdoruesi tjetër nuk sheh rezervimet", (await q(`select * from gift_reservations`)).length === 0);
await rejects("përdoruesi tjetër nuk shton produkt në listën e huaj", () => q(`insert into gift_list_items (list_id, product_id) values ($1, $2)`, [list.id, P2]), "row-level security");
await q(`delete from gift_list_items where id = $1`, [item1]);
await as("authenticated", U1);
check("përdoruesi tjetër nuk fshin produktin e huaj", (await q(`select * from gift_list_items where id = $1`, [item1])).length === 1);

// pronari heq një rezervim: sasia zbret
await db.exec(`delete from gift_reservations where name = 'Daja Arben'`);
await as("super");
check("heqja e rezervimit zbret sasinë (2 → 1)", (await q(`select reserved_qty from gift_list_items where id = $1`, [item1]))[0].reserved_qty === 1);
await as("anon");
await q(`select public.gift_reserve($1, $2, 'Shoqja Ana', 1)`, [list.slug, item1]);
check("pas heqjes, dhurata rezervohet sërish", true);

// kufiri i rezervimeve në orë (30)
await as("super");
const bigItems = [];
for (let i = 0; i < 4; i++) {
  const p = (await q(`insert into products (name, price, stock) values ('P' || $1::text, 1, 9) returning id`, [i]))[0].id;
  bigItems.push((await q(`insert into gift_list_items (list_id, product_id, qty) values ($1, $2, 20) returning id`, [list.id, p]))[0].id);
}
await as("anon");
let made = 0;
try { for (let i = 0; i < 40; i++) { await q(`select public.gift_reserve($1, $2, $3, 1)`, [list.slug, bigItems[i % 4], `Vizitor ${i}`]); made++; } } catch (e) { /* pritet */ }
check("kufiri 30 rezervime në orë", made >= 25 && made <= 28, "u bënë " + made + " pas 3 të mëparshmeve");

// heqja e listës fshin gjithçka (cascade)
await as("super");
await db.exec(`delete from auth.users where id = '${U1}'`);
check("fshirja e përdoruesit heq listën, produktet dhe rezervimet", (await q(`select (select count(*) from gift_lists)::int a, (select count(*) from gift_list_items)::int b, (select count(*) from gift_reservations)::int c`))[0].a === 0);

console.log(`\n${pass} kaluan, ${fail} dështuan`);
process.exit(fail ? 1 : 0);
