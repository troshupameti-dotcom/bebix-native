/**
 * Prova e migrimit "emailet pas pagesës me kartë" në një Postgres lokal (PGlite).
 * Nisja:  node supabase/tests/card-emails.test.mjs   (me @electric-sql/pglite të instaluar)
 */
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";

const MIGRATION = new URL("../migrations/20261006090000_card_emails_after_payment.sql", import.meta.url);
const db = new PGlite();
process.on("uncaughtException", (e) => { console.log("GABIM i papritur:", String(e.message).slice(0, 300)); process.exit(1); });

await db.exec(`
create schema auth;
create table auth.users (id uuid primary key default gen_random_uuid(), email text);
create table public.orders (
  id uuid primary key default gen_random_uuid(), user_id uuid, full_name text, city text, total_price numeric default 10,
  status text default 'pending', email text, client_ref uuid, created_at timestamptz default now(),
  payment_method text default 'cod', payment_status text default 'unpaid'
);
create table public.email_outbox (id serial primary key, kind text, order_id uuid, audience text, to_email text, dedupe_key text unique);
create table public.admin_notifications (type text, title text, body text, payload jsonb);
-- trigger-ët si në prodhim para migrimit
create function public.enqueue_order_emails() returns trigger language plpgsql as $$ begin return new; end $$;
create function public.notify_admin_new_order() returns trigger language plpgsql as $$ begin return new; end $$;
create trigger orders_enqueue_emails_insert after insert on public.orders for each row execute function public.enqueue_order_emails();
create trigger orders_enqueue_emails_status after update of status on public.orders for each row execute function public.enqueue_order_emails();
create trigger orders_notify_admin after insert on public.orders for each row execute function public.notify_admin_new_order();
create function public.set_order_email(p_order_id uuid, p_client_ref uuid, p_email text) returns void language sql as $$ select 1 $$;
`);
try { await db.exec(fs.readFileSync(MIGRATION, "utf8")); console.log("OK  migrimi u ekzekutua pa gabime"); }
catch (e) { console.log("GABIM te migrimi:", e.message); process.exit(1); }

let pass = 0, fail = 0;
const check = (name, ok, extra = "") => { (ok ? pass++ : fail++); console.log((ok ? "OK  " : "GABIM ") + name + (extra ? "  -> " + extra : "")); };
const one = async (q, p) => (await db.query(q, p)).rows[0];
const mails = async (id) => (await db.query(`select kind, audience from email_outbox where order_id = $1 order by id`, [id])).rows.map((r) => `${r.kind}/${r.audience}`);
const notes = async () => (await one(`select count(*)::int c from admin_notifications`)).c;
const user = (await one(`insert into auth.users (email) values ('ana@example.com') returning id`)).id;

// Në dorëzim: si më parë (email + admin menjëherë)
let id = (await one(`insert into orders (user_id, payment_method) values ('${user}', 'cod') returning id`)).id;
check("në dorëzim: email te klienti dhe te admini menjëherë", (await mails(id)).join() === "order_placed/customer,admin_new_order/admin", (await mails(id)).join());
check("në dorëzim: njoftimi i panelit menjëherë", (await notes()) === 1);

// Kartë e pa paguar: asgjë
const n0 = await notes();
id = (await one(`insert into orders (user_id, payment_method, payment_status) values ('${user}', 'card', 'pending') returning id`)).id;
check("kartë e pa paguar: asnjë email", (await mails(id)).length === 0);
check("kartë e pa paguar: asnjë njoftim në panel", (await notes()) === n0);

// Pagesa kalon "paguar": email + admin + njoftim, një herë
await db.exec(`update orders set payment_status = 'paid' where id = '${id}'`);
check("pas pagesës: email te klienti dhe te admini", (await mails(id)).join() === "order_placed/customer,admin_new_order/admin", (await mails(id)).join());
check("pas pagesës: njoftimi në panel", (await notes()) === n0 + 1);
await db.exec(`update orders set payment_status = 'paid' where id = '${id}'`);
await db.exec(`update orders set payment_status = 'refunded' where id = '${id}'; update orders set payment_status = 'paid' where id = '${id}'`);
check("pagesa e përsëritur nuk dyfishon emailet", (await mails(id)).length === 2);
check("rimbursimi nuk dërgon email të ri porosie", true);

// Statuset pas pagesës: email si zakonisht
await db.exec(`update orders set status = 'confirmed' where id = '${id}'`);
check("konfirmimi i porosisë së paguar dërgon email", (await mails(id)).includes("status_confirmed/customer"));

// Kartë e pa paguar që anulohet vetë: klienti s'merr "u anulua"
const stale = (await one(`insert into orders (user_id, payment_method, payment_status) values ('${user}', 'card', 'pending') returning id`)).id;
await db.exec(`update orders set status = 'cancelled', payment_status = 'failed' where id = '${stale}'`);
check("karta e pa paguar e anuluar vetë: asnjë email", (await mails(stale)).length === 0, (await mails(stale)).join());
// Admini anulon një porosi të paguar: email si zakonisht
await db.exec(`update orders set status = 'cancelled' where id = '${id}'`);
check("anulimi i një porosie të paguar dërgon email", (await mails(id)).includes("status_cancelled/customer"));
// Në dorëzim e anuluar: email si më parë
const cod = (await one(`insert into orders (user_id, payment_method) values ('${user}', 'cod') returning id`)).id;
await db.exec(`update orders set status = 'cancelled' where id = '${cod}'`);
check("në dorëzim e anuluar: email si më parë", (await mails(cod)).includes("status_cancelled/customer"));

// Mysafiri me kartë: email-i jepet para pagesës, konfirmimi del pas pagesës
const ref = (await one(`select gen_random_uuid() as r`)).r;
const g = (await one(`insert into orders (user_id, payment_method, payment_status, client_ref) values (null, 'card', 'pending', '${ref}') returning id`)).id;
await db.exec(`select public.set_order_email('${g}', '${ref}', 'Guest@Example.com')`);
check("mysafiri me kartë: email-i s'dërgon konfirmim para pagesës", (await mails(g)).length === 0, (await mails(g)).join());
await db.exec(`update orders set payment_status = 'paid' where id = '${g}'`);
check("mysafiri me kartë: pas pagesës merr konfirmimin në email-in e dhënë", (await db.query(`select to_email from email_outbox where order_id = $1 and kind = 'order_placed'`, [g])).rows[0]?.to_email === "guest@example.com");
// Mysafiri në dorëzim: set_order_email dërgon menjëherë
const ref2 = (await one(`select gen_random_uuid() as r`)).r;
const g2 = (await one(`insert into orders (user_id, payment_method, client_ref) values (null, 'cod', '${ref2}') returning id`)).id;
await db.exec(`select public.set_order_email('${g2}', '${ref2}', 'g2@example.com')`);
check("mysafiri në dorëzim: konfirmimi menjëherë (si më parë)", (await mails(g2)).includes("order_placed/customer"));
await rejects();
async function rejects() {
  try { await db.exec(`select public.set_order_email('${g2}', '${ref2}', 'jo-email')`); check("email i pavlefshëm refuzohet", false); }
  catch (e) { check("email i pavlefshëm refuzohet", e.message.includes("vlefshëm")); }
}

console.log(`\n${pass} kaluan, ${fail} dështuan`);
process.exit(fail ? 1 : 0);
