/**
 * Prova e emaileve të porosisë (shqip, anglisht, transfertë bankare), pa dërguar asgjë.
 * Nisja (nga rrënja e projektit):  node supabase/tests/emails.test.mjs
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
const require = createRequire(import.meta.url);
const ts = require("typescript");

let src = fs.readFileSync(new URL("../functions/send-order-emails/index.ts", import.meta.url), "utf8");
src = src.replace(/^import .*$/gm, "").replace("serve(async (req) => {", "const __serve = (async (req) => {").concat("\nexport { render };\n");
const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }, reportDiagnostics: true });
if (js.diagnostics?.length) { console.log("GABIM sintakse:", js.diagnostics.map((d) => d.messageText).join("; ")); process.exit(1); }

globalThis.Deno = { env: { get: (k) => ({ BANK_TRANSFER_TEXT: "Përfituesi: Bebix SHPK\nIBAN: XK05 0000 0000 0000 0000" }[k] ?? undefined) } };
globalThis.createClient = () => ({});
globalThis.serve = () => {};
const OUT = path.join(os.tmpdir(), "bebix-email-under-test.mjs");
fs.writeFileSync(OUT, "const createClient = globalThis.createClient; const serve = globalThis.serve;\n" + js.outputText);
const { render } = await import(pathToFileURL(OUT).href + "?" + Date.now());

let pass = 0, fail = 0;
const check = (name, ok, extra = "") => { (ok ? pass++ : fail++); console.log((ok ? "OK  " : "GABIM ") + name + (extra ? "  -> " + extra : "")); };

const order = (extra = {}) => ({
  id: "abcdef12-0000-4000-8000-000000000000", full_name: "Ana Berisha", phone: "+38344111222", address: "Rr. Test 1", city: "Prishtine",
  total_price: 22.5, created_at: "2026-10-04T10:00:00Z", shipping_fee: 2.5,
  items: [{ id: "p1", name: "Biberon NUK", price: 10, qty: 2 }], ...extra,
});
const meta = new Map([["p1", { img: "https://x/y.jpg", code: "NUK330" }]]);
const row = (kind, audience = "customer") => ({ id: 1, kind, order_id: "o", audience, to_email: "ana@example.com", dedupe_key: null });

let m = render(row("order_placed"), order(), meta);
check("shqip (pa lang): subjekti", m.subject === "Porosia #ABCDEF12 u pranua", m.subject);
check("shqip: fjalët (Dërgesa, Totali, Kodi, Shiko porositë)", ["Dërgesa", "Totali", "Kodi: NUK330", "Shiko porositë e mia", "/sq/shop/orders", "Për bebin tënd"].every((s) => m.html.includes(s)));

m = render(row("order_placed"), order({ lang: "en" }), meta);
check("anglisht: subjekti", m.subject === "Order #ABCDEF12 received", m.subject);
check("anglisht: fjalët", ["Delivery", "Total", "Code: NUK330", "See my orders", "/en/shop/orders", "For your baby, with love", 'lang="en"'].every((s) => m.html.includes(s)));
check("anglisht: s'ka fjalë shqipe", !/Dërgesa|Totali|Shiko|Faleminderit/.test(m.html));

for (const kind of ["status_confirmed", "status_shipped", "status_delivered", "status_cancelled"]) {
  const a = render(row(kind), order({ lang: "en" }), meta), b = render(row(kind), order(), meta);
  check(`${kind}: ka subjekt në të dyja gjuhët`, /Order #/.test(a.subject) && /Porosia #/.test(b.subject), `${a.subject} | ${b.subject}`);
}

m = render(row("order_placed"), order({ lang: "en", payment_method: "bank_transfer", payment_status: "pending" }), meta);
check("transfertë (en): udhëzimet, IBAN-i, shuma dhe referenca", ["Payment by bank transfer", "IBAN: XK05", "Amount", "#ABCDEF12", "confirmed as soon as your bank transfer arrives"].every((s) => m.html.includes(s)));
check("transfertë (en): s'thotë 'pay when you receive'", !m.html.includes("You pay when you receive it"));
m = render(row("order_placed"), order({ payment_method: "bank_transfer", payment_status: "pending" }), meta);
check("transfertë (sq): udhëzimet", m.html.includes("Pagesa me transfertë bankare") && m.html.includes("Referenca"));
m = render(row("status_shipped"), order({ lang: "en", payment_method: "bank_transfer", payment_status: "paid" }), meta);
check("transfertë e paguar: pa bllok pagese", !m.html.includes("Payment by bank transfer") && m.html.includes("Your order is on its way."));

m = render(row("order_placed", "admin"), order({ lang: "en", payment_method: "bank_transfer", payment_status: "pending" }), meta);
check("admini: gjithmonë shqip, me mënyrën e pagesës", m.subject.startsWith("Porosi e re") && m.html.includes("Pagesa:") && m.html.includes("Transfertë bankare") && m.html.includes("· EN"));
m = render(row("order_placed"), order({ lang: "en", payment_method: "card", payment_status: "pending" }), meta);
check("kartë e pa paguar (en): pret pagesën, pa bllok transferte, pa 'pay when you receive'", m.html.includes("as soon as your card payment completes") && !m.html.includes("Payment by bank transfer") && !m.html.includes("IBAN") && !m.html.includes("You pay when you receive it"));
m = render(row("order_placed"), order({ payment_method: "card", payment_status: "pending" }), meta);
check("kartë e pa paguar (sq): teksti shqip", m.html.includes("pagesa me kartë") && !m.html.includes("Paguan kur ta marrësh") && !m.html.includes("IBAN"));
m = render(row("order_placed"), order({ lang: "en", payment_method: "card", payment_status: "paid" }), meta);
check("kartë e paguar (en): konfirmon pagesën", m.html.includes("your card payment, thank you"));
m = render(row("status_shipped"), order({ lang: "en", payment_method: "card", payment_status: "paid" }), meta);
check("kartë e nisur: 'on its way' pa 'pay when you receive'", m.html.includes("Your order is on its way.") && !m.html.includes("You pay when you receive it"));
m = render(row("status_cancelled"), order({ lang: "en", payment_method: "card", payment_status: "failed" }), meta);
check("kartë e anuluar pa pagesë: nuk është zbritur asgjë", m.html.includes("nothing was charged"));
m = render(row("status_cancelled"), order({ lang: "en", payment_method: "card", payment_status: "paid" }), meta);
check("kartë e anuluar por e paguar: teksti i zakonshëm, jo 'nothing was charged'", !m.html.includes("nothing was charged") && m.html.includes("Your order was cancelled."));
m = render(row("order_placed", "admin"), order({ payment_method: "card", payment_status: "pending" }), meta);
check("admini: karta shfaqet si Kartë (pending)", m.html.includes("<strong>Kartë</strong> (pending)"));
m = render(row("order_placed", "admin"), order({ payment_method: "card", payment_status: "paid" }), meta);
check("admini: karta e paguar shfaqet (paid)", m.html.includes("<strong>Kartë</strong> (paid)"));
m = render(row("order_placed"), order(), meta);
check("në dorëzim: teksti i zakonshëm mbetet", m.html.includes("Paguan kur ta marrësh"));

m = render(row("order_placed"), order(), meta);
check("logoja: shkronja të çelëta mbi breshëri të errët me sfond të vetin (lexohet edhe në modalitet të errët)", m.html.includes('wordmark-dark.png') && !m.html.includes('/wordmark.png') && m.html.includes('bgcolor="#1c2b43"'));
check("emaili ka titullin, tekstin dhe lidhjen pas ndryshimit të strukturës", m.html.includes("Faleminderit për porosinë!") && m.html.includes("Shiko porositë e mia") && m.html.includes("bebix.store</a>"));

m = render(row("order_placed"), order({ lang: "de" }), meta);
check("gjuhë e panjohur: shqip", m.subject.startsWith("Porosia"));
m = render({ ...row("order_placed"), to_email: null }, order(), meta);
check("pa email: nuk dërgohet", m === null);

console.log(`\n${pass} kaluan, ${fail} dështuan`);
fs.unlinkSync(OUT);
process.exit(fail ? 1 : 0);
