/**
 * Prova e migrimit të arkëtimit (dërgesa dhe pagesa) në një Postgres lokal (PGlite), pa prekur bazën e vërtetë.
 * Skema është e thjeshtuar (vetëm tabelat që përdor migrimi), por kontrollon sintaksën dhe logjikën e plotë.
 *
 * Nisja (nga rrënja e projektit):
 *   npm i --no-save @electric-sql/pglite
 *   node supabase/tests/checkout.test.mjs
 */
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";

const MIGRATION = new URL("../migrations/20261003180000_shipping_fee.sql", import.meta.url);
const db = new PGlite();

// ---- skema e thjeshtuar: vetëm çfarë përdor `place_order_core`
await db.exec(`
create role anon; create role authenticated; create role service_role;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create table public.products (id uuid primary key default gen_random_uuid(), name text, price numeric, stock int, is_active boolean default true, image_url text, free_delivery boolean default false);
create table public.partners (id uuid primary key default gen_random_uuid(), company_name text, low_stock_threshold int default 5);
create table public.partner_products (id uuid primary key default gen_random_uuid(), partner_id uuid, product_id uuid, stock int, status text default 'in_stock', updated_at timestamptz);
create table public.orders (id uuid primary key default gen_random_uuid(), user_id uuid, full_name text, phone text, address text, city text, items jsonb, total_price numeric, status text default 'pending', client_ref uuid, created_at timestamptz default now(), email text);
create table public.order_items (order_id uuid, product_id uuid, partner_id uuid, partner_product_id uuid, qty int, unit_price numeric, commission_rate_applied numeric, commission_amount numeric, partner_earning numeric);
create table public.inventory_logs (partner_product_id uuid, old_stock int, new_stock int, change int, reason text, user_id uuid);
create table public.partner_notifications (partner_id uuid, type text, title text, body text, payload jsonb);
create table public.admin_notifications (type text, title text, body text, payload jsonb);
create function public.get_applicable_commission(a uuid, b uuid) returns numeric language sql as $$ select 10::numeric $$;
-- funksionet e vjetra që migrimi i heq
create function public.place_order_core(p_user uuid, a text, b text, c text, d text, e jsonb, f uuid) returns uuid language sql as $$ select null::uuid $$;
create function public.place_order(a text, b text, c text, d text, e jsonb, f uuid default null) returns uuid language sql as $$ select null::uuid $$;
create function public.place_guest_order(a text, b text, c text, d text, e jsonb, f uuid) returns uuid language sql as $$ select null::uuid $$;
`);

// ---- migrimi i vërtetë
let sql = fs.readFileSync(MIGRATION, "utf8");
try {
  await db.exec(sql);
  console.log("OK  migrimi u ekzekutua pa gabime");
} catch (e) {
  console.log("GABIM te migrimi:", e.message);
  process.exit(1);
}

process.on("uncaughtException", (e) => { console.log("GABIM i papritur:", String(e.message).slice(0, 300)); process.exit(1); });
let pass = 0, fail = 0;
const check = (name, ok, extra = "") => { (ok ? pass++ : fail++); console.log((ok ? "OK  " : "GABIM ") + name + (extra ? "  -> " + extra : "")); };
const one = async (q, p) => (await db.query(q, p)).rows[0];

// ---- të dhëna
const A = (await one(`insert into products (name, price, stock) values ('A', 10, 20) returning id`)).id;
const B = (await one(`insert into products (name, price, stock, free_delivery) values ('B falas', 5, 20, true) returning id`)).id;
const C = (await one(`insert into products (name, price, stock) values ('C partner', 8, 0) returning id`)).id;
const partner = (await one(`insert into partners (company_name) values ('Partner') returning id`)).id;
await db.exec(`insert into partner_products (partner_id, product_id, stock) values ('${partner}', '${C}', 10)`);

const items = (list) => JSON.stringify(list.map(([id, qty]) => ({ id, qty, name: "x", price: 1 })));
const place = async ({ ref, list, country, method, lang, guest = true }) => {
  const args = [`'Test Person'`, `'+38344111222'`, `'Rr. Test 1'`, `'Prishtine'`, `'${items(list)}'::jsonb`, `'${ref}'::uuid`];
  const named = guest
    ? `p_full_name => 'Test Person', p_phone => '${nextPhone()}', p_address => 'Rr. Test 1', p_city => 'Prishtine', p_items => '${items(list)}'::jsonb, p_client_ref => '${ref}'::uuid`
    : `p_full_name => 'Test Person', p_phone => '${nextPhone()}', p_address => 'Rr. Test 1', p_city => 'Prishtine', p_items => '${items(list)}'::jsonb, p_client_ref => '${ref}'::uuid`;
  const extra = (country ? `, p_country => '${country}'` : "") + (method ? `, p_payment_method => '${method}'` : "") + (lang ? `, p_lang => '${lang}'` : "");
  const fn = guest ? "place_guest_order" : "place_order";
  const r = await one(`select public.${fn}(${named}${extra}) as id`);
  return one(`select id, total_price::float8 as total, shipping_fee::float8 as ship, country, payment_method, payment_status, lang from orders where id = $1`, [r.id]);
};
const uuid = () => crypto.randomUUID();
let phoneSeq = 100000;
const nextPhone = () => `+383441${phoneSeq++}`;

// 1) parazgjedhja (klient i vjetër, pa shtet): Kosova
let o = await place({ ref: uuid(), list: [[A, 2]] });
check("pa shtet: Kosovë, 2×10 + 2.50", o.total === 22.5 && o.ship === 2.5 && o.country === "XK" && o.payment_method === "cod" && o.payment_status === "unpaid", JSON.stringify(o));

// 2) shtete
o = await place({ ref: uuid(), list: [[A, 1]], country: "AL" });
check("Shqipëri: 10 + 5", o.total === 15 && o.ship === 5 && o.country === "AL", JSON.stringify(o));
o = await place({ ref: uuid(), list: [[A, 1]], country: "MK" });
check("Maqedoni: 10 + 5", o.total === 15 && o.ship === 5 && o.country === "MK", JSON.stringify(o));
o = await place({ ref: uuid(), list: [[A, 1]], country: "xk" });
check("shteti me shkronja të vogla pranohet (xk)", o.country === "XK" && o.ship === 2.5);

// 3) dërgesa falas vetëm kur të gjitha produktet e kanë
o = await place({ ref: uuid(), list: [[B, 2]], country: "AL" });
check("vetëm produkte me dërgesë falas: 0", o.ship === 0 && o.total === 10, JSON.stringify(o));
o = await place({ ref: uuid(), list: [[A, 1], [B, 1]], country: "XK" });
check("përzierje: dërgesa paguhet", o.ship === 2.5 && o.total === 17.5, JSON.stringify(o));

// 4) produkt i partnerit (stok nga partneri)
o = await place({ ref: uuid(), list: [[C, 3]], country: "XK" });
check("produkt partneri: 3×8 + 2.50", o.total === 26.5, JSON.stringify(o));
const pp = await one(`select stock from partner_products where product_id = $1`, [C]);
check("stoku i partnerit u zbrit (10 → 7)", pp.stock === 7, "stoku=" + pp.stock);
const oi = await one(`select count(*)::int c from order_items`);
check("u krijua rreshti te order_items", oi.c >= 1, "rreshta=" + oi.c);

// 5) pagesa
o = await place({ ref: uuid(), list: [[A, 1]], country: "XK", method: "bank_transfer" });
check("transfertë bankare: statusi 'pending'", o.payment_method === "bank_transfer" && o.payment_status === "pending", JSON.stringify(o));
o = await place({ ref: uuid(), list: [[A, 1]], country: "XK", method: "cod" });
check("në dorëzim: statusi 'unpaid'", o.payment_status === "unpaid");

// gjuha e emailit
o = await place({ ref: uuid(), list: [[A, 1]], country: "XK" });
check("gjuha parazgjedhje: sq", o.lang === "sq", o.lang);
o = await place({ ref: uuid(), list: [[A, 1]], country: "XK", lang: "en" });
check("gjuha e emailit: en ruhet", o.lang === "en", o.lang);
o = await place({ ref: uuid(), list: [[A, 1]], country: "XK", lang: "EN" });
check("gjuha me shkronja të mëdha: en", o.lang === "en", o.lang);
o = await place({ ref: uuid(), list: [[A, 1]], country: "XK", lang: "de" });
check("gjuhë e panjohur bie te sq (gjuha e emailit)", o.lang === "sq", o.lang);

// 6) refuzime
const rejects = async (name, fn, fragment) => { try { await fn(); check(name, false, "nuk u refuzua"); } catch (e) { check(name, e.message.includes(fragment), e.message.slice(0, 70)); } };
await rejects("karta nuk është e hapur", () => place({ ref: uuid(), list: [[A, 1]], country: "XK", method: "card" }), "nuk është e hapur");
await rejects("shtet i panjohur (DE)", () => place({ ref: uuid(), list: [[A, 1]], country: "DE" }), "nuk mbështetet");
await rejects("shportë bosh", () => place({ ref: uuid(), list: [], country: "XK" }), "bosh");

// 7) idempotenca: e njëjta referencë → e njëjta porosi, pa dublim stoku
const ref = uuid();
const stockBefore = (await one(`select stock from products where id = $1`, [A])).stock;
const first = await place({ ref, list: [[A, 1]], country: "AL" });
const second = await place({ ref, list: [[A, 1]], country: "AL" });
const stockAfter = (await one(`select stock from products where id = $1`, [A])).stock;
check("e njëjta referencë kthen të njëjtën porosi", first.id === second.id);
check("stoku zbritet vetëm një herë", stockBefore - stockAfter === 1, `${stockBefore} → ${stockAfter}`);

// 8) stoku
await rejects("stok i pamjaftueshëm", () => place({ ref: uuid(), list: [[A, 99]], country: "XK" }), "Stok");

// 9) shipping_quote
const q = async (c, ids) => (await one(`select public.shipping_quote($1, $2::uuid[]) as v`, [c, `{${ids.join(",")}}`])).v;
check("quote XK: 2.5", Number(await q("XK", [A])) === 2.5);
check("quote AL: 5", Number(await q("AL", [A])) === 5);
check("quote me vetëm produkte falas: 0", Number(await q("MK", [B])) === 0);
check("quote e përzier: tarifa", Number(await q("MK", [A, B])) === 5);
await rejects("quote shtet i panjohur", () => q("XX", [A]), "nuk mbështetet");

// 10) place_order (me llogari)
await db.exec(`select set_config('request.jwt.claim.sub', '', false)`);
await rejects("place_order pa hyrje refuzohet", () => place({ ref: uuid(), list: [[A, 1]], country: "XK", guest: false }), "loguar");
await db.exec(`select set_config('request.jwt.claim.sub', '${uuid()}', false)`);
o = await place({ ref: uuid(), list: [[A, 1]], country: "AL", method: "bank_transfer", guest: false });
check("place_order me hyrje: 10 + 5, transfertë", o.total === 15 && o.payment_status === "pending", JSON.stringify(o));

// 11) të drejtat
const priv = async (role, sig) => (await one(`select has_function_privilege('${role}', '${sig}', 'execute') as ok`)).ok;
check("anon mund të thërrasë place_guest_order", await priv("anon", "public.place_guest_order(text,text,text,text,jsonb,uuid,text,text,text)"));
check("anon NUK mund të thërrasë place_order", !(await priv("anon", "public.place_order(text,text,text,text,jsonb,uuid,text,text,text)")));
check("authenticated mund të thërrasë place_order", await priv("authenticated", "public.place_order(text,text,text,text,jsonb,uuid,text,text,text)"));
check("anon NUK mund të thërrasë place_order_core", !(await priv("anon", "public.place_order_core(uuid,text,text,text,text,jsonb,uuid,text,text,text)")));
check("authenticated NUK mund të thërrasë place_order_core", !(await priv("authenticated", "public.place_order_core(uuid,text,text,text,text,jsonb,uuid,text,text,text)")));
check("anon mund të thërrasë shipping_quote", await priv("anon", "public.shipping_quote(text,uuid[])"));

// 12) vetëm një version i secilit funksion (pa paqartësi)
const dups = await db.query(`select proname, count(*)::int c from pg_proc where pronamespace = 'public'::regnamespace and proname in ('place_order','place_guest_order','place_order_core','shipping_quote') group by 1`);
check("një nënshkrim për funksion", dups.rows.every((r) => r.c === 1), JSON.stringify(dups.rows));

console.log(`\n${pass} kaluan, ${fail} dështuan`);
process.exit(fail ? 1 : 0);