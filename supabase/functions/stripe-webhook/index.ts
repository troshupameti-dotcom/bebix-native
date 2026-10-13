import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Webhook i Stripe: kur klienti paguan, Stripe thërret këtu dhe porosia shënohet "paguar".
 *
 * Çdo kërkesë verifikohet me nënshkrimin e Stripe (sekreti `STRIPE_WEBHOOK_SECRET`, i vendosur te Supabase →
 * Edge Functions → Secrets); kërkesa pa nënshkrim të vlefshëm refuzohet. Kjo është arsyeja pse funksioni
 * deployohet pa verifikim JWT: Stripe s'dërgon JWT, por dërgon nënshkrim që e kontrollojmë vetë.
 *
 * Adresa e webhook-ut te Stripe: https://<projekti>.supabase.co/functions/v1/stripe-webhook
 * Ngjarjet: checkout.session.completed, checkout.session.async_payment_succeeded,
 *           checkout.session.async_payment_failed, charge.refunded
 */

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});

const enc = new TextEncoder();

function toHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Krahasim me kohë të njëjtë (pa zbuluar ku ndryshojnë dy vargjet). */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Kontrollon `Stripe-Signature`: `t=<koha>,v1=<HMAC-SHA256 i "<koha>.<trupi>">`, brenda 5 minutave. */
export async function verifyStripeSignature(
  payload: string,
  header: string | null,
  secret: string,
  nowSec = Math.floor(Date.now() / 1000),
  toleranceSec = 300,
): Promise<boolean> {
  if (!header || !secret) return false;
  let t = "";
  const sigs: string[] = [];
  for (const part of header.split(",")) {
    const [k, v] = part.split("=");
    if (k === "t") t = v;
    else if (k === "v1" && v) sigs.push(v);
  }
  const ts = Number(t);
  if (!t || !Number.isFinite(ts) || sigs.length === 0 || Math.abs(nowSec - ts) > toleranceSec) return false;
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const expected = toHex(await crypto.subtle.sign("HMAC", key, enc.encode(`${t}.${payload}`)));
  return sigs.some((s) => safeEqual(s, expected));
}

// deno-lint-ignore no-explicit-any
type Db = any;
type StripeEvent = { id?: string; type: string; data: { object: Record<string, unknown> } };
/** Rimburson plotësisht një pagesë te Stripe; hedh gabim kur s'ia del (Stripe e riprovon webhook-un). */
type Refund = (paymentIntent: string, orderId: string) => Promise<void>;

/**
 * Rimbursimi i plotë me API-në e Stripe. Çelësi i idempotencës (një për payment_intent) e bën të sigurt
 * riprovimin: Stripe s'rimburson dy herë të njëjtën pagesë.
 */
export async function refundViaStripe(paymentIntent: string, orderId: string): Promise<void> {
  const key = Deno.env.get("STRIPE_SECRET_KEY");
  if (!key) throw new Error("refund_not_configured");
  const body = new URLSearchParams({ payment_intent: paymentIntent, reason: "requested_by_customer" });
  body.set("metadata[order_id]", orderId);
  body.set("metadata[reason]", "order_cancelled_before_payment");
  const res = await fetch("https://api.stripe.com/v1/refunds", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Idempotency-Key": `bebix-refund-${paymentIntent}`,
    },
    body,
  });
  if (!res.ok) throw new Error(`refund_failed_${res.status}`);
}

async function markPaid(
  db: Db,
  orderId: string,
  paymentIntent: string | null,
  amountTotal: number,
  currency: string,
  refund: Refund,
): Promise<string> {
  const { data: order } = await db
    .from("orders")
    .select("id, total_price, payment_method, payment_status, status")
    .eq("id", orderId)
    .maybeSingle();
  if (!order) return "order_not_found";
  if (order.payment_method !== "card") return "not_card";
  if (order.payment_status === "paid" || order.payment_status === "refunded") return "already_" + order.payment_status;
  // Shuma e paguar duhet të jetë saktësisht totali i porosisë, në euro; përndryshe nuk shënohet "paguar".
  if (currency !== "eur" || Math.round(Number(order.total_price) * 100) !== amountTotal) {
    console.error("amount_mismatch", orderId, amountTotal, currency, order.total_price);
    return "amount_mismatch";
  }
  // Porosia u anulua para se të vinte pagesa (p.sh. anulimi vetë pas 2 orësh): s'ka mall për të dërguar,
  // prandaj paraja i kthehet klientit vetë. Pa payment_intent s'ka çfarë të rimbursohet: e sheh admini.
  if (order.status === "cancelled") {
    if (!paymentIntent) {
      console.error("paid_but_cancelled_no_intent", orderId);
      return "cancelled_no_intent";
    }
    await refund(paymentIntent, orderId); // gabim → 500 → Stripe riprovon; porosia s'preket ende
    const { error } = await db
      .from("orders")
      .update({ payment_status: "refunded", payment_reference: paymentIntent })
      .eq("id", orderId)
      .neq("payment_status", "refunded");
    if (error) {
      console.error("update_failed", orderId, error.message);
      return "update_failed";
    }
    console.warn("refunded_cancelled_order", orderId);
    return "refunded_cancelled";
  }
  const { error } = await db
    .from("orders")
    .update({ payment_status: "paid", paid_at: new Date().toISOString(), payment_reference: paymentIntent })
    .eq("id", orderId)
    .neq("payment_status", "paid");
  if (error) {
    console.error("update_failed", orderId, error.message);
    return "update_failed";
  }
  return "paid";
}

/** Zbaton një ngjarje të Stripe te porosia përkatëse; kthen çfarë u bë (për regjistrat dhe testet). */
export async function handleStripeEvent(event: StripeEvent, db: Db, refund: Refund = refundViaStripe): Promise<string> {
  const obj = event.data.object;
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      // Pagesa asinkrone (p.sh. transfertë): "completed" vjen me "unpaid"; pritet "async_payment_succeeded".
      if (obj.payment_status !== "paid") return "not_paid_yet";
      const orderId = String(obj.client_reference_id ?? (obj.metadata as Record<string, string> | undefined)?.order_id ?? "");
      if (!orderId) return "no_order";
      return await markPaid(db, orderId, typeof obj.payment_intent === "string" ? obj.payment_intent : null, Number(obj.amount_total), String(obj.currency ?? ""), refund);
    }
    case "checkout.session.async_payment_failed": {
      const orderId = String(obj.client_reference_id ?? "");
      if (!orderId) return "no_order";
      await db.from("orders").update({ payment_status: "failed" }).eq("id", orderId).eq("payment_method", "card").eq("payment_status", "pending");
      return "failed";
    }
    case "charge.refunded": {
      const pi = typeof obj.payment_intent === "string" ? obj.payment_intent : "";
      if (!pi || obj.refunded !== true) return "partial_or_unknown"; // rimbursim i pjesshëm: e trajton admini me dorë
      await db.from("orders").update({ payment_status: "refunded" }).eq("payment_reference", pi);
      return "refunded";
    }
    default:
      return "ignored";
  }
}

serve(async (req) => {
  if (req.method !== "POST") return new Response("method not allowed", { status: 405 });
  const secret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!secret) return new Response("not configured", { status: 503 });

  const payload = await req.text();
  if (!(await verifyStripeSignature(payload, req.headers.get("stripe-signature"), secret))) {
    return new Response("invalid signature", { status: 400 });
  }

  let event: StripeEvent;
  try {
    event = JSON.parse(payload);
  } catch {
    return new Response("bad request", { status: 400 });
  }
  try {
    const action = await handleStripeEvent(event, supabase);
    return new Response(JSON.stringify({ received: true, action }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (e) {
    // 500: Stripe e riprovon vetë (me vonesa në rritje); porosia nuk humbet.
    console.error("webhook_error", event.type, String(e instanceof Error ? e.message : e));
    return new Response("error", { status: 500 });
  }
});
