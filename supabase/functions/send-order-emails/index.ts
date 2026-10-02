import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Dërgon emailet e porosive (radha `email_outbox`) përmes Resend.
 *
 * Çelësi i Resend (`RESEND_API_KEY`) është sekret i funksionit, vendoset te
 * Supabase → Edge Functions → Secrets; s'rri kurrë në kod. Pa të, funksioni
 * s'bën asgjë dhe emailet presin në radhë (nuk humbasin).
 */

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});

const RESEND_KEY = Deno.env.get("RESEND_API_KEY");
const FROM = Deno.env.get("ORDER_EMAIL_FROM") ?? "Bebix <porosi@bebix.store>";
const REPLY_TO = "info.bebix@gmail.com";
const ADMIN_TO = Deno.env.get("ADMIN_ALERT_EMAIL") ?? "info.bebix@gmail.com";
const SITE = "https://www.bebix.store";

type Row = { id: number; kind: string; order_id: string; audience: "customer" | "admin"; to_email: string | null; dedupe_key: string | null };
type Order = {
  id: string; full_name: string; phone: string; address: string; city: string; total_price: number; created_at: string;
  items: { name?: string; price?: number; qty?: number }[] | null;
};

function isServiceRole(req: Request): boolean {
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const part = token.split(".")[1];
  if (!part) return false;
  try {
    return JSON.parse(atob(part.replace(/-/g, "+").replace(/_/g, "/")))?.role === "service_role";
  } catch {
    return false;
  }
}

const esc = (v: unknown) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const eur = (n: number) => `€${Number(n || 0).toFixed(2)}`;
const ref = (id: string) => `#${id.slice(0, 8).toUpperCase()}`;

const CUSTOMER: Record<string, { subject: (r: string) => string; title: string; lead: string }> = {
  order_placed: {
    subject: (r) => `Porosia ${r} u pranua`,
    title: "Faleminderit për porosinë!",
    lead: "E morëm porosinë tënde dhe po e shqyrtojmë. Do të të njoftojmë sapo të konfirmohet. Paguan kur ta marrësh.",
  },
  status_confirmed: {
    subject: (r) => `Porosia ${r} u konfirmua`,
    title: "Porosia u konfirmua",
    lead: "Porosia jote u konfirmua dhe po përgatitet për dërgesë.",
  },
  status_shipped: {
    subject: (r) => `Porosia ${r} është nisur`,
    title: "Porosia është nisur",
    lead: "Porosia jote është në rrugë. Paguan kur ta marrësh.",
  },
  status_delivered: {
    subject: (r) => `Porosia ${r} u dorëzua`,
    title: "Porosia u dorëzua",
    lead: "Porosia jote u dorëzua. Faleminderit që zgjodhe Bebix!",
  },
  status_cancelled: {
    subject: (r) => `Porosia ${r} u anulua`,
    title: "Porosia u anulua",
    lead: "Porosia jote u anulua. Nëse nuk e prisje këtë, na shkruaj dhe e zgjidhim.",
  },
};

function itemsTable(o: Order): string {
  const rows = (o.items ?? []).map((i) =>
    `<tr><td style="padding:8px 0;border-bottom:1px solid #eee;">${esc(i.name)} <span style="color:#888;">× ${esc(i.qty)}</span></td><td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right;white-space:nowrap;">${eur(Number(i.price) * Number(i.qty))}</td></tr>`
  ).join("");
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="font-size:14px;color:#1c1a16;">${rows}
    <tr><td style="padding:12px 0 0;font-weight:700;">Totali</td><td style="padding:12px 0 0;text-align:right;font-weight:700;">${eur(o.total_price)}</td></tr></table>`;
}

function shell(title: string, body: string): string {
  return `<!doctype html><html lang="sq"><body style="margin:0;background:#f8f6f2;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:24px 12px;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;background:#ffffff;border-radius:16px;padding:28px;">
      <tr><td style="font-size:22px;font-weight:700;color:#1f3d38;padding-bottom:4px;">Bebix</td></tr>
      <tr><td style="font-size:18px;font-weight:700;color:#1c1a16;padding:12px 0 6px;">${esc(title)}</td></tr>
      <tr><td style="font-size:14px;line-height:1.6;color:#565047;">${body}</td></tr>
    </table>
    <p style="font-size:12px;color:#857c71;margin:16px 0 0;">Bebix · Për bebin tënd, me dashuri · <a href="${SITE}" style="color:#857c71;">bebix.store</a></p>
  </td></tr></table></body></html>`;
}

function render(row: Row, o: Order): { to: string; subject: string; html: string } | null {
  const r = ref(o.id);
  if (row.audience === "admin") {
    const body = `<p style="margin:0 0 12px;"><strong>${esc(o.full_name)}</strong><br>${esc(o.phone)}<br>${esc(o.address)}, ${esc(o.city)}</p>${itemsTable(o)}`;
    return { to: ADMIN_TO, subject: `Porosi e re ${r} · ${eur(o.total_price)} · ${o.city}`, html: shell(`Porosi e re ${r}`, body) };
  }
  const t = CUSTOMER[row.kind];
  if (!t || !row.to_email) return null;
  const body = `<p style="margin:0 0 16px;">${esc(t.lead)}</p>
    <p style="margin:0 0 6px;font-weight:700;color:#1c1a16;">Porosia ${esc(r)}</p>${itemsTable(o)}
    <p style="margin:16px 0 0;"><strong>Dërgesa:</strong> ${esc(o.full_name)}, ${esc(o.address)}, ${esc(o.city)}</p>
    <p style="margin:16px 0 0;"><a href="${SITE}/sq/shop/orders" style="color:#1f3d38;font-weight:700;">Shiko porositë e mia</a></p>`;
  return { to: row.to_email, subject: t.subject(r), html: shell(t.title, body) };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

serve(async (req) => {
  if (!isServiceRole(req)) return new Response(JSON.stringify({ error: "forbidden" }), { status: 403 });
  if (!RESEND_KEY) {
    // Pa çelës: s'prekim radhën, emailet presin.
    return new Response(JSON.stringify({ sent: 0, note: "RESEND_API_KEY mungon" }), { status: 200, headers: { "Content-Type": "application/json" } });
  }

  const { data, error } = await supabase.rpc("claim_pending_emails", { p_limit: 20 });
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  const rows = (data ?? []) as Row[];

  let sent = 0;
  let failed = 0;
  for (const row of rows) {
    try {
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .select("id, full_name, phone, address, city, total_price, created_at, items")
        .eq("id", row.order_id)
        .maybeSingle();
      if (orderError || !order) throw new Error(orderError?.message ?? "porosia s'u gjet");
      const mail = render(row, order as Order);
      if (!mail) throw new Error("s'ka email ose lloj i panjohur");

      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_KEY}`,
          "Content-Type": "application/json",
          ...(row.dedupe_key ? { "Idempotency-Key": row.dedupe_key } : {}),
        },
        body: JSON.stringify({ from: FROM, to: [mail.to], reply_to: REPLY_TO, subject: mail.subject, html: mail.html }),
      });
      if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 200)}`);

      await supabase.from("email_outbox").update({ sent_at: new Date().toISOString(), error: null }).eq("id", row.id);
      sent++;
    } catch (e) {
      failed++;
      await supabase.from("email_outbox").update({ error: String(e instanceof Error ? e.message : e).slice(0, 300) }).eq("id", row.id);
    }
    await sleep(600); // Resend lejon ~2 kërkesa në sekondë
  }

  return new Response(JSON.stringify({ claimed: rows.length, sent, failed }), { headers: { "Content-Type": "application/json" } });
});
