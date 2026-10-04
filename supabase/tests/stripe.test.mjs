/**
 * Prova e funksioneve të pagesës me kartë (create-card-checkout dhe stripe-webhook), pa thirrur Stripe-in:
 * nënshkrimi i webhook-ut, rreshtat e pagesës dhe zbatimi i ngjarjeve te porosia.
 *
 * Nisja (nga rrënja e projektit):  node supabase/tests/stripe.test.mjs
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const ts = require("typescript");

globalThis.Deno = { env: { get: () => "x" } };
globalThis.createClient = () => ({});
globalThis.serve = () => {};

async function load(name) {
  let src = fs.readFileSync(new URL(`../functions/${name}/index.ts`, import.meta.url), "utf8");
  src = src.replace(/^import .*$/gm, "").replace("serve(async (req) => {", "const __serve = (async (req) => {");
  const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }, reportDiagnostics: true });
  if (js.diagnostics?.length) throw new Error(`sintaksë ${name}: ` + js.diagnostics.map((d) => d.messageText).join("; "));
  const out = path.join(os.tmpdir(), `bebix-${name}-under-test.mjs`);
  fs.writeFileSync(out, "const createClient = globalThis.createClient; const serve = globalThis.serve;\n" + js.outputText);
  const mod = await import(pathToFileURL(out).href + "?" + Date.now());
  fs.unlinkSync(out);
  return mod;
}

const { buildLines, buildCheckoutParams } = await load("create-card-checkout");
const { verifyStripeSignature, handleStripeEvent } = await load("stripe-webhook");

let pass = 0, fail = 0;
const check = (name, ok, extra = "") => { (ok ? pass++ : fail++); console.log((ok ? "OK  " : "GABIM ") + name + (extra ? "  -> " + extra : "")); };

// ---------- nënshkrimi
const SECRET = "whsec_test_secret";
const sign = (payload, t, secret = SECRET) => `t=${t},v1=${crypto.createHmac("sha256", secret).update(`${t}.${payload}`).digest("hex")}`;
const NOW = 1_800_000_000;
const body = JSON.stringify({ id: "evt_1", type: "checkout.session.completed" });
check("nënshkrim i vlefshëm pranohet", await verifyStripeSignature(body, sign(body, NOW), SECRET, NOW));
check("sekret i gabuar refuzohet", !(await verifyStripeSignature(body, sign(body, NOW, "tjeter"), SECRET, NOW)));
check("trup i ndryshuar refuzohet", !(await verifyStripeSignature(body + " ", sign(body, NOW), SECRET, NOW)));
check("nënshkrim i vjetër (>5 min) refuzohet", !(await verifyStripeSignature(body, sign(body, NOW - 301), SECRET, NOW)));
check("nënshkrim 4 min i vjetër pranohet", await verifyStripeSignature(body, sign(body, NOW - 240), SECRET, NOW));
check("pa header refuzohet", !(await verifyStripeSignature(body, null, SECRET, NOW)));
check("header i prishur refuzohet", !(await verifyStripeSignature(body, "gabim", SECRET, NOW)));
check("pa sekret refuzohet", !(await verifyStripeSignature(body, sign(body, NOW), "", NOW)));
const good = sign(body, NOW).split(",")[1];
check("disa v1, njëri i vlefshëm: pranohet", await verifyStripeSignature(body, `t=${NOW},v1=000,${good}`, SECRET, NOW));

// ---------- rreshtat e pagesës
const ID = "abcdef12-0000-4000-8000-000000000000";
const order = (extra = {}) => ({
  id: ID, total_price: 22.5, shipping_fee: 2.5, payment_method: "card", payment_status: "pending", status: "pending", client_ref: "r", email: null,
  items: [{ name: "Biberon NUK", price: 10, qty: 2, imageUrl: "https://x.supabase.co/a.jpg" }], ...extra,
});
let lines = buildLines(order(), "sq");
check("rreshtat: artikulli + dërgesa", lines.length === 2 && lines[0].unit === 1000 && lines[0].qty === 2 && lines[1].name === "Dërgesa" && lines[1].unit === 250, JSON.stringify(lines.map((l) => [l.name, l.unit, l.qty])));
check("rreshtat (en): 'Delivery'", buildLines(order(), "en")[1].name === "Delivery");
check("shuma e rreshtave = totali në cent", lines.reduce((s, l) => s + l.unit * l.qty, 0) === 2250);
lines = buildLines(order({ total_price: 99 }), "sq");
check("shumë që s'përputhet: një rresht me totalin e bazës", lines.length === 1 && lines[0].unit === 9900, JSON.stringify(lines));
lines = buildLines(order({ items: [] }), "sq");
check("pa artikuj: një rresht me totalin", lines.length === 1 && lines[0].unit === 2250);
lines = buildLines(order({ shipping_fee: 0, total_price: 20 }), "sq");
check("pa dërgesë: vetëm artikujt", lines.length === 1 && lines[0].unit === 1000);
lines = buildLines(order({ items: [{ name: "A", price: 10, qty: 2, imageUrl: "http://pa-https/a.jpg" }] }), "sq");
check("foto pa HTTPS nuk dërgohet", lines[0].image === undefined);
check("foto me HTTPS dërgohet", buildLines(order(), "sq")[0].image === "https://x.supabase.co/a.jpg");

// ---------- parametrat e sesionit
let p = buildCheckoutParams(order({ email: "ana@example.com" }), "en", NOW);
check("sesioni: mode, referenca, metadata", p.get("mode") === "payment" && p.get("client_reference_id") === ID && p.get("metadata[order_id]") === ID && p.get("payment_intent_data[metadata][order_id]") === ID);
check("sesioni: adresat e kthimit me gjuhën", p.get("success_url") === `https://www.bebix.store/en/shop/payment/success?order=${ID}` && p.get("cancel_url") === "https://www.bebix.store/en/shop/payment/cancelled");
check("sesioni: euro dhe shuma në cent", p.get("line_items[0][price_data][currency]") === "eur" && p.get("line_items[0][price_data][unit_amount]") === "1000" && p.get("line_items[1][price_data][unit_amount]") === "250");
check("sesioni: skadon pas 31 minutash", p.get("expires_at") === String(NOW + 1860));
check("sesioni: email-i i klientit", p.get("customer_email") === "ana@example.com");
check("sesioni: locale en për anglisht, auto për shqip", p.get("locale") === "en" && buildCheckoutParams(order(), "sq", NOW).get("locale") === "auto");
check("sesioni: pa email nuk dërgon customer_email", buildCheckoutParams(order(), "sq", NOW).get("customer_email") === null);

// ---------- ngjarjet
function fakeDb(row) {
  const calls = [];
  return {
    calls,
    from() {
      const state = {};
      const b = {
        select() { return b; },
        eq(k, v) { (state.eq ||= []).push([k, v]); return b; },
        neq(k, v) { state.neq = [k, v]; return b; },
        update(patch) { state.update = patch; return b; },
        maybeSingle: async () => ({ data: row }),
        then(res) { calls.push(state); res({ error: null }); },
      };
      return b;
    },
  };
}
const completed = (extra = {}, type = "checkout.session.completed") => ({ type, data: { object: { client_reference_id: ID, payment_status: "paid", payment_intent: "pi_123", amount_total: 2250, currency: "eur", ...extra } } });

let db = fakeDb(order());
let r = await handleStripeEvent(completed(), db);
check("pagesë e saktë: shënohet 'paguar'", r === "paid" && db.calls.length === 1 && db.calls[0].update.payment_status === "paid" && db.calls[0].update.payment_reference === "pi_123" && !!db.calls[0].update.paid_at, r);
check("përditësimi kufizohet te kjo porosi dhe s'prek të paguarat", JSON.stringify(db.calls[0].eq) === JSON.stringify([["id", ID]]) && db.calls[0].neq?.join() === "payment_status,paid");

db = fakeDb(order()); r = await handleStripeEvent(completed({}, "checkout.session.async_payment_succeeded"), db);
check("pagesa asinkrone e suksesshme: 'paguar'", r === "paid");
db = fakeDb(order()); r = await handleStripeEvent(completed({ payment_status: "unpaid" }), db);
check("'completed' me 'unpaid': pritet, s'shënohet", r === "not_paid_yet" && db.calls.length === 0, r);
db = fakeDb(order()); r = await handleStripeEvent(completed({ amount_total: 1000 }), db);
check("shumë tjetër nga totali: REFUZOHET", r === "amount_mismatch" && db.calls.length === 0, r);
db = fakeDb(order()); r = await handleStripeEvent(completed({ currency: "usd" }), db);
check("valutë tjetër nga euro: REFUZOHET", r === "amount_mismatch" && db.calls.length === 0, r);
db = fakeDb(order({ payment_status: "paid" })); r = await handleStripeEvent(completed(), db);
check("ngjarje e përsëritur: s'prek asgjë (idempotente)", r === "already_paid" && db.calls.length === 0, r);
db = fakeDb(order({ payment_method: "cod" })); r = await handleStripeEvent(completed(), db);
check("porosi jo me kartë: s'shënohet", r === "not_card" && db.calls.length === 0, r);
db = fakeDb(null); r = await handleStripeEvent(completed(), db);
check("porosi që s'ekziston: s'bën asgjë", r === "order_not_found" && db.calls.length === 0, r);
db = fakeDb(order()); r = await handleStripeEvent(completed({ client_reference_id: undefined, metadata: { order_id: ID } }), db);
check("referenca nga metadata kur mungon client_reference_id", r === "paid", r);
db = fakeDb(order()); r = await handleStripeEvent(completed({ client_reference_id: undefined }), db);
check("pa referencë porosie: s'bën asgjë", r === "no_order" && db.calls.length === 0, r);
db = fakeDb(order({ status: "cancelled" })); r = await handleStripeEvent(completed(), db);
check("e anuluar por e paguar: shënohet 'paguar' (admini e sheh dhe rimburson)", r === "paid", r);

db = fakeDb(order()); r = await handleStripeEvent({ type: "checkout.session.async_payment_failed", data: { object: { client_reference_id: ID } } }, db);
check("pagesa asinkrone e dështuar: 'failed' vetëm nga 'pending'", r === "failed" && db.calls[0].update.payment_status === "failed" && db.calls[0].eq.some(([k, v]) => k === "payment_status" && v === "pending"));
db = fakeDb(order()); r = await handleStripeEvent({ type: "charge.refunded", data: { object: { payment_intent: "pi_123", refunded: true } } }, db);
check("rimbursim i plotë: 'refunded' sipas payment_intent", r === "refunded" && db.calls[0].update.payment_status === "refunded" && db.calls[0].eq[0].join() === "payment_reference,pi_123");
db = fakeDb(order()); r = await handleStripeEvent({ type: "charge.refunded", data: { object: { payment_intent: "pi_123", refunded: false } } }, db);
check("rimbursim i pjesshëm: s'ndryshon statusin", r === "partial_or_unknown" && db.calls.length === 0, r);
db = fakeDb(order()); r = await handleStripeEvent({ type: "customer.created", data: { object: {} } }, db);
check("ngjarje e panjohur: injorohet", r === "ignored" && db.calls.length === 0, r);

console.log(`\n${pass} kaluan, ${fail} dështuan`);
process.exit(fail ? 1 : 0);
