import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Krijon një sesion pagese Stripe Checkout (faqja e Stripe) për një porosi me kartë.
 *
 * Karta s'kalon kurrë përmes Bebix-it: klienti paguan te Stripe, dhe `stripe-webhook` e shënon porosinë "paguar".
 * Shuma merret NGA BAZA (`orders.total_price`), jo nga klienti; klienti dërgon vetëm porosinë dhe referencën e saj
 * sekrete (`client_ref`, një UUID që e di vetëm ai që e krijoi porosinë).
 *
 * Sekreti `STRIPE_SECRET_KEY` vendoset te Supabase → Edge Functions → Secrets (sk_test_... për prova, sk_live_...
 * për prodhim); s'rri kurrë në kod. Pa të, funksioni kthen 503 `not_configured` dhe porosia mbetet e padëmtuar.
 */

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});

const SITE = "https://www.bebix.store";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

type Lang = "sq" | "en";
type OrderRow = {
  id: string;
  total_price: number | string;
  shipping_fee?: number | string | null;
  items: { name?: string; price?: number | string; qty?: number | string; imageUrl?: string | null }[] | null;
  payment_method: string | null;
  payment_status: string | null;
  status: string;
  client_ref: string | null;
  email?: string | null;
  created_at?: string | null;
};

/** Sesioni i Stripe vlen 31 minuta (minimumi i Stripe është 30). */
export const SESSION_MINUTES = 31;
/** Porositë me kartë të papaguara anulohen vetë pas kaq minutash (cancel_unpaid_card_orders, 2 orë). */
export const AUTO_CANCEL_MINUTES = 120;
/**
 * Sesion i ri lejohet vetëm kur mbaron para anulimit vetë, me 4 minuta rezervë (cron-i ecën çdo 15 minuta,
 * por mund të ekzekutohet edhe pak më herët se ora e saktë). Përndryshe klienti mund të paguante pasi porosia
 * ishte anuluar dhe stoku kthyer.
 */
export const LATEST_START_MINUTES = AUTO_CANCEL_MINUTES - SESSION_MINUTES - 4;

export function tooLateToPay(createdAt: string | null | undefined, nowMs = Date.now()): boolean {
  const t = createdAt ? new Date(createdAt).getTime() : NaN;
  if (!Number.isFinite(t)) return true; // pa datë s'dihet: më mirë porosi e re se pagesë për një porosi të anuluar
  return nowMs - t > LATEST_START_MINUTES * 60_000;
}

const cents = (n: unknown) => Math.round(Number(n) * 100);

/** Rreshtat e pagesës: artikujt + dërgesa; nëse shuma s'përputhet saktë me totalin e porosisë, një rresht i vetëm me totalin. */
export function buildLines(order: OrderRow, lang: Lang) {
  const total = cents(order.total_price);
  const ship = Math.max(0, cents(order.shipping_fee ?? 0));
  const lines: { name: string; unit: number; qty: number; image?: string }[] = [];
  let sum = ship;
  for (const i of order.items ?? []) {
    const unit = cents(i.price);
    const qty = Math.max(1, Math.floor(Number(i.qty) || 1));
    if (!Number.isFinite(unit) || unit <= 0) continue;
    sum += unit * qty;
    lines.push({
      name: String(i.name || "Produkt").slice(0, 120),
      unit,
      qty,
      image: typeof i.imageUrl === "string" && /^https:\/\//.test(i.imageUrl) ? i.imageUrl : undefined,
    });
  }
  const ref = `#${order.id.slice(0, 8).toUpperCase()}`;
  if (lines.length === 0 || sum !== total) {
    return [{ name: `Bebix ${ref}`, unit: total, qty: 1 } as (typeof lines)[number]];
  }
  if (ship > 0) lines.push({ name: lang === "en" ? "Delivery" : "Dërgesa", unit: ship, qty: 1 });
  return lines;
}

/** Parametrat e sesionit Stripe (form-encoded). */
export function buildCheckoutParams(order: OrderRow, lang: Lang, nowSec = Math.floor(Date.now() / 1000)): URLSearchParams {
  const p = new URLSearchParams();
  p.set("mode", "payment");
  p.set("client_reference_id", order.id);
  p.set("success_url", `${SITE}/${lang}/shop/payment/success?order=${order.id}`);
  p.set("cancel_url", `${SITE}/${lang}/shop/payment/cancelled`);
  p.set("locale", lang === "en" ? "en" : "auto");
  p.set("expires_at", String(nowSec + SESSION_MINUTES * 60)); // Stripe kërkon të paktën 30 minuta; porosia anulohet vetë pas 2 orësh
  p.set("metadata[order_id]", order.id);
  p.set("payment_intent_data[metadata][order_id]", order.id);
  p.set("payment_intent_data[description]", `Bebix #${order.id.slice(0, 8).toUpperCase()}`);
  if (order.email) p.set("customer_email", order.email);
  buildLines(order, lang).forEach((l, idx) => {
    p.set(`line_items[${idx}][quantity]`, String(l.qty));
    p.set(`line_items[${idx}][price_data][currency]`, "eur");
    p.set(`line_items[${idx}][price_data][unit_amount]`, String(l.unit));
    p.set(`line_items[${idx}][price_data][product_data][name]`, l.name);
    if (l.image) p.set(`line_items[${idx}][price_data][product_data][images][0]`, l.image);
  });
  return p;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  const key = Deno.env.get("STRIPE_SECRET_KEY");
  if (!key) return json(503, { error: "not_configured" });

  let body: { order_id?: string; client_ref?: string; lang?: string };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "bad_request" });
  }
  const orderId = String(body.order_id ?? "");
  const clientRef = String(body.client_ref ?? "");
  const lang: Lang = body.lang === "en" ? "en" : "sq";
  if (!UUID.test(orderId) || !UUID.test(clientRef)) return json(400, { error: "bad_request" });

  const { data: order, error } = await supabase
    .from("orders")
    .select("id, total_price, shipping_fee, items, payment_method, payment_status, status, client_ref, email, created_at")
    .eq("id", orderId)
    .maybeSingle();
  // Referenca e gabuar përgjigjet njësoj si porosia që s'ekziston: s'zbulohet kush ekziston.
  if (error || !order || String(order.client_ref ?? "").toLowerCase() !== clientRef.toLowerCase()) return json(404, { error: "not_found" });
  if (order.payment_method !== "card") return json(409, { error: "not_card" });
  if (order.payment_status === "paid") return json(409, { error: "already_paid" });
  if (order.status === "cancelled") return json(409, { error: "cancelled" });
  if (tooLateToPay(order.created_at)) return json(409, { error: "too_late" });

  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/x-www-form-urlencoded",
      // E njëjta porosi brenda 10 minutave kthen të njëjtin sesion (pa dublim nëse klienti shtyp dy herë).
      "Idempotency-Key": `bebix-${order.id}-${Math.floor(Date.now() / 600_000)}`,
    },
    body: buildCheckoutParams(order as OrderRow, lang).toString(),
  });
  const session = await res.json().catch(() => null);
  if (!res.ok || !session?.url) {
    console.error("Stripe error", res.status, JSON.stringify(session?.error ?? session)?.slice(0, 300));
    return json(502, { error: "stripe_error" });
  }
  return json(200, { url: session.url });
});
