/**
 * Prova e migrimit të pagesës me kartë në një Postgres lokal (PGlite), pa prekur bazën e vërtetë.
 * Ekzekuton migrimin e arkëtimit dhe pastaj atë të kartës (si në prodhim).
 *
 * Nisja (nga rrënja e projektit):
 *   npm i --no-save @electric-sql/pglite
 *   node supabase/tests/card.test.mjs
 */
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";

const SHIPPING = new URL("../migrations/20261003180000_shipping_fee.sql", import.meta.url);
const CARD = new URL("../migrations/20261004180000_card_payments.sql", import.meta.url);
const FREE = new URL("../migrations/20261005120000_card_free_shipping.sql", import.meta.url);
const db = new PGlite();
process.on("uncaughtException", (e) => { console.log("GABIM i papritur:", String(e.message).slice(0, 300)); process.exit(1); });

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
create function public.place_order_core(p_user uuid, a text, b text, c text, d text, e jsonb, f uuid) returns uuid language sql as $$ select null::uuid $$;
create function public.place_order(a text, b text, c text, d text, e jsonb, f uuid default null) returns uuid language sql as $$ select null::uuid $$;
create function public.place_guest_order(a text, b text, c text, d text, e jsonb, f uuid) returns uuid language sql as $$ select null::uuid $$;
`);

for (const [name, file] of [["arkëtimit", SHIPPING], ["kartës", CARD], ["dërgesës falas me kartë", FREE]]) {
  try { await db.exec(fs.readFileSync(file, "utf8")); console.log(`OK  migrimi i ${name} u ekzekutua pa gabime`); }
  catch (e) { console.log(`GABIM te migrimi i ${name}:`, e.message); process.exit(1); }
}

let pass = 0, fail = 0;
const check = (name, ok, extra = "") => { (ok ? pass++ : fail++); console.log((ok ? "OK  " : "GABIM ") + name + (extra ? "  -> " + extra : "")); };
const one = async (q, p) => (await db.query(q, p)).rows[0];
const rejects = async (name, fn, fragment) => { try { await fn(); check(name, false, "nuk u refuzua"); } catch (e) { check(name, e.message.includes(fragment), e.message.slice(0, 70)); } };

const A = (await one(`insert into products (name, price, stock) values ('A', 10, 20) returning id`)).id;
let phone = 700000;
const place = async (method, country = "XK") => {
  const items = JSON.stringify([{ id: A, qty: 2, name: "x", price: 1 }]);
  const ref = crypto.randomUUID();
  const r = await one(`select public.place_guest_order(p_full_name => 'Ana Berisha', p_phone => '+383441${phone++}', p_address => 'Rr. Test 1', p_city => 'Prishtine', p_items => '${items}'::jsonb, p_client_ref => '${ref}'::uuid, p_country => '${country}', p_payment_method => '${method}') as id`);
  return one(`select id, total_price::float8 as total, shipping_fee::float8 as ship, payment_method, payment_status, status from orders where id = $1`, [r.id]);
};

// porosi me kartë: dërgesa falas, çdo vend
let o = await place("card");
check("kartë: porosia krijohet me pagesë 'pending'", o.payment_method === "card" && o.payment_status === "pending" && o.status === "pending", JSON.stringify(o));
check("kartë Kosovë: dërgesa falas (totali 2×10, dërgesa 0)", o.total === 20 && o.ship === 0, JSON.stringify(o));
o = await place("card", "AL");
check("kartë Shqipëri: dërgesa falas (20)", o.total === 20 && o.ship === 0, JSON.stringify(o));
o = await place("card", "MK");
check("kartë Maqedoni: dërgesa falas (20)", o.total === 20 && o.ship === 0, JSON.stringify(o));
// metodat e tjera paguajnë dërgesën si më parë
o = await place("cod"); check("në dorëzim: 'unpaid' dhe dërgesa 2.50 (22.50)", o.payment_status === "unpaid" && o.total === 22.5 && o.ship === 2.5, JSON.stringify(o));
o = await place("cod", "AL"); check("në dorëzim Shqipëri: 20 + 5", o.total === 25 && o.ship === 5, JSON.stringify(o));
o = await place("bank_transfer"); check("transfertë: 'pending' dhe dërgesa 2.50 (22.50)", o.payment_status === "pending" && o.total === 22.5, JSON.stringify(o));
// çmimi që e shfaq klienti përputhet me atë që ruhet
const quote = async (country, method) => (await one(`select public.shipping_quote_by_method('${country}', array['${A}']::uuid[], '${method}')::float8 as q`)).q;
check("kuota me kartë: 0 në çdo vend", (await quote("XK", "card")) === 0 && (await quote("AL", "card")) === 0 && (await quote("MK", "CARD")) === 0);
check("kuota në dorëzim/transfertë: tarifa e vendit", (await quote("XK", "cod")) === 2.5 && (await quote("AL", "bank_transfer")) === 5);
await rejects("kuota me kartë për vend të panjohur refuzohet", () => quote("DE", "card"), "nuk mbështetet");
check("kuota pa metodë (parazgjedhja) = tarifa e vendit", (await one(`select public.shipping_quote_by_method('XK', array['${A}']::uuid[])::float8 as q`)).q === 2.5);
await rejects("metodë e panjohur refuzohet", () => place("paypal"), "nuk është e hapur");

// të drejtat nuk ndryshuan pas `create or replace`
const priv = async (role, sig) => (await one(`select has_function_privilege('${role}', '${sig}', 'execute') as ok`)).ok;
check("anon NUK thërret place_order_core", !(await priv("anon", "public.place_order_core(uuid,text,text,text,text,jsonb,uuid,text,text,text)")));
check("authenticated NUK thërret place_order_core", !(await priv("authenticated", "public.place_order_core(uuid,text,text,text,text,jsonb,uuid,text,text,text)")));
check("anon thërret place_guest_order", await priv("anon", "public.place_guest_order(text,text,text,text,jsonb,uuid,text,text,text)"));
check("anon thërret shipping_quote_by_method (kuota për vizitorët)", await priv("anon", "public.shipping_quote_by_method(text,uuid[],text)"));
check("anon NUK thërret cancel_unpaid_card_orders", !(await priv("anon", "public.cancel_unpaid_card_orders(interval)")));
check("authenticated NUK thërret cancel_unpaid_card_orders", !(await priv("authenticated", "public.cancel_unpaid_card_orders(interval)")));
const dups = await one(`select count(*)::int c from pg_proc where pronamespace = 'public'::regnamespace and proname = 'place_order_core'`);
check("një nënshkrim i vetëm për place_order_core", dups.c === 1, String(dups.c));

// anulimi i kartave të papaguara
await db.exec(`update orders set created_at = now() - interval '3 hours' where payment_method = 'card'`);
const fresh = await place("card"); // kartë e re, nuk duhet të preket
const stale = (await one(`select id from orders where payment_method = 'card' and created_at < now() - interval '2 hours' limit 1`)).id;
const cancelled = (await one(`select public.cancel_unpaid_card_orders() as n`)).n;
check("anulohen kartat e papaguara më të vjetra se 2 orë (3 të tilla: Kosovë, Shqipëri, Maqedoni)", cancelled === 3, String(cancelled));
const after = await one(`select status, payment_status from orders where id = $1`, [stale]);
check("e anuluara: status 'cancelled', pagesa 'failed'", after.status === "cancelled" && after.payment_status === "failed", JSON.stringify(after));
const freshAfter = await one(`select status, payment_status from orders where id = $1`, [fresh.id]);
check("karta e re nuk preket", freshAfter.status === "pending" && freshAfter.payment_status === "pending");
await db.exec(`update orders set payment_status = 'paid' where id = '${fresh.id}'; update orders set created_at = now() - interval '5 hours' where id = '${fresh.id}'`);
check("karta e paguar nuk anulohet kurrë (edhe e vjetër)", (await one(`select public.cancel_unpaid_card_orders() as n`)).n === 0);
const cod = await place("cod");
await db.exec(`update orders set created_at = now() - interval '9 hours' where id = '${cod.id}'`);
check("porosia në dorëzim nuk preket nga ky funksion", (await one(`select public.cancel_unpaid_card_orders() as n`)).n === 0);

console.log(`\n${pass} kaluan, ${fail} dështuan`);
process.exit(fail ? 1 : 0);
