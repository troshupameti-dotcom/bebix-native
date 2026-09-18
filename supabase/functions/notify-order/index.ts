import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Njofton klientin kur ndryshon statusi i porosisë.
 *
 * Thirret nga triggeri `orders_notify_customer` përmes pg_net, jo nga
 * app-i. Deri tani statusi shkruhej te paneli dhe nuk e lexonte askush:
 * klienti nuk e dinte nëse porosia ishte konfirmuar apo nisur, çka me
 * pagesë në dorëzim do të thotë telefonata dhe refuzime në derë.
 */

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

const MESSAGES: Record<string, { title: string; body: (ref: string) => string }> = {
  confirmed: {
    title: "Porosia u konfirmua",
    body: (ref) => `Porosia ${ref} u konfirmua dhe po përgatitet.`,
  },
  shipped: {
    title: "Porosia është nisur",
    body: (ref) => `Porosia ${ref} është nisur. Paguan kur ta marrësh.`,
  },
  delivered: {
    title: "Porosia u dorëzua",
    body: (ref) => `Porosia ${ref} u dorëzua. Faleminderit!`,
  },
  cancelled: {
    title: "Porosia u anulua",
    body: (ref) => `Porosia ${ref} u anulua. Na shkruaj nëse nuk e prisje këtë.`,
  },
};

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
  }

  let orderId: string | null = null;
  try {
    const body = await req.json();
    orderId = typeof body?.order_id === "string" ? body.order_id : null;
  } catch {
    orderId = null;
  }
  if (!orderId) {
    return new Response(JSON.stringify({ error: "Mungon order_id." }), { status: 400 });
  }

  const { data: order, error } = await supabase
    .from("orders")
    .select("id, user_id, status")
    .eq("id", orderId)
    .maybeSingle();

  if (error || !order) {
    return new Response(JSON.stringify({ error: "Porosia s'u gjet." }), { status: 404 });
  }
  if (!order.user_id) {
    // Llogaria është fshirë; porosia mbetet e anonimizuar.
    return new Response(JSON.stringify({ skipped: "pa pronar" }), { status: 200 });
  }

  const template = MESSAGES[order.status];
  if (!template) {
    return new Response(JSON.stringify({ skipped: `statusi ${order.status}` }), { status: 200 });
  }

  const { data: settings } = await supabase
    .from("notification_settings")
    .select("order_updates")
    .eq("user_id", order.user_id)
    .maybeSingle();

  // Mungesa e rreshtit do të thotë "po" — e njëjta parazgjedhje si te app-i.
  if (settings?.order_updates === false) {
    return new Response(JSON.stringify({ skipped: "i fikur nga përdoruesi" }), { status: 200 });
  }

  // Një njoftim për çdo ndryshim statusi, jo më shumë.
  const ref = `${order.id}:${order.status}`;
  const { error: logError } = await supabase
    .from("notification_log")
    .insert({ user_id: order.user_id, kind: "order", ref });
  if (logError) {
    return new Response(JSON.stringify({ skipped: "i dërguar më parë" }), { status: 200 });
  }

  const { data: tokens } = await supabase
    .from("push_tokens")
    .select("expo_push_token")
    .eq("user_id", order.user_id);

  const shortRef = `#${order.id.slice(0, 8).toUpperCase()}`;
  const messages = (tokens ?? []).map((t) => ({
    to: t.expo_push_token,
    title: template.title,
    body: template.body(shortRef),
    sound: "default",
    data: { type: "order", orderId: order.id },
  }));

  if (messages.length > 0) {
    await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(messages),
    });
  }

  return new Response(JSON.stringify({ sent: messages.length }), {
    headers: { "Content-Type": "application/json" },
    status: 200,
  });
});
