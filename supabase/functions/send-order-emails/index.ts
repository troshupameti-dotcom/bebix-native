import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Dërgon emailet e porosive (radha `email_outbox`) përmes Resend.
 *
 * Çelësi i Resend (`RESEND_API_KEY`) është sekret i funksionit, vendoset te
 * Supabase → Edge Functions → Secrets; s'rri kurrë në kod. Pa të, funksioni
 * s'bën asgjë dhe emailet presin në radhë (nuk humbasin).
 *
 * Emaili te klienti del në gjuhën që përdorte kur porositi (`orders.lang`: sq ose en;
 * para migrimit kolona mungon dhe del shqip). Emaili te admini është gjithmonë shqip.
 */

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});

const RESEND_KEY = Deno.env.get("RESEND_API_KEY");
const FROM = Deno.env.get("ORDER_EMAIL_FROM") ?? "Bebix <porosi@bebix.store>";
const REPLY_TO = "info.bebix@gmail.com";
const ADMIN_TO = Deno.env.get("ADMIN_ALERT_EMAIL") ?? "info.bebix@gmail.com";
const SITE = "https://www.bebix.store";

type Lang = "sq" | "en";
type Row = { id: number; kind: string; order_id: string; audience: "customer" | "admin"; to_email: string | null; dedupe_key: string | null };
type Order = {
  id: string; full_name: string; phone: string; address: string; city: string; total_price: number; created_at: string;
  items: { id?: string; name?: string; price?: number; qty?: number; imageUrl?: string | null }[] | null;
  /** Dërgesa e përfshirë te totali (kolona ekziston pas migrimit; para tij mungon). */
  shipping_fee?: number | null;
  /** Metoda dhe statusi i pagesës (kolonat ekzistojnë pas migrimit). */
  payment_method?: string | null;
  payment_status?: string | null;
  /** Gjuha e klientit në çastin e porosisë (kolona ekziston pas migrimit). */
  lang?: string | null;
};
/** Foto dhe kodi i produktit, për çdo artikull të porosisë. */
type Meta = Map<string, { img: string | null; code: string }>;

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

/** Të dhënat e bankës për transfertë: sekreti BANK_TRANSFER_TEXT te Supabase (tekst i lirë: përfituesi, IBAN, banka). */
const BANK_TEXT = Deno.env.get("BANK_TRANSFER_TEXT") ?? "";

/** Fjalët e përbashkëta të emailit, sipas gjuhës. */
const TX: Record<Lang, {
  code: string; delivery: string; total: string; deliveryTo: string; seeOrders: string; footer: string;
  payTitle: string; amount: string; reference: string; order: string; payment: string;
  paymentLabel: Record<string, string>;
}> = {
  sq: {
    code: "Kodi", delivery: "Dërgesa", total: "Totali", deliveryTo: "Dërgesa:", seeOrders: "Shiko porositë e mia",
    footer: "Për bebin tënd, me dashuri", payTitle: "Pagesa me transfertë bankare", amount: "Shuma", reference: "Referenca",
    order: "Porosia", payment: "Pagesa",
    paymentLabel: { cod: "Paguan në dorëzim", bank_transfer: "Transfertë bankare", card: "Kartë" },
  },
  en: {
    code: "Code", delivery: "Delivery", total: "Total", deliveryTo: "Delivery to:", seeOrders: "See my orders",
    footer: "For your baby, with love", payTitle: "Payment by bank transfer", amount: "Amount", reference: "Reference",
    order: "Order", payment: "Payment",
    paymentLabel: { cod: "Pay on delivery", bank_transfer: "Bank transfer", card: "Card" },
  },
};

/** `lead`: paguan në dorëzim; `leadBank`: e paguar paraprakisht (transfertë, ose kartë kur s'ka tekst të veçantë); `leadCard`/`leadCardPaid`: karta, e pa paguar / e paguar. */
type Template = { subject: (r: string) => string; title: string; lead: string; leadBank?: string; leadCard?: string; leadCardPaid?: string };

const CUSTOMER: Record<Lang, Record<string, Template>> = {
  sq: {
    order_placed: {
      subject: (r) => `Porosia ${r} u pranua`,
      title: "Faleminderit për porosinë!",
      lead: "E morëm porosinë tënde dhe po e shqyrtojmë. Do të të njoftojmë sapo të konfirmohet. Paguan kur ta marrësh.",
      leadBank: "E morëm porosinë tënde. Do të konfirmohet sapo të arrijë pagesa me transfertë bankare.",
      leadCard: "E morëm porosinë tënde. Do të konfirmohet sapo të përfundojë pagesa me kartë. Nëse e mbylle faqen e pagesës pa e përfunduar, porosia anulohet vetë pas dy orësh dhe mund ta bësh përsëri.",
      leadCardPaid: "E morëm porosinë tënde dhe pagesën me kartë, faleminderit! Do të të njoftojmë sapo të konfirmohet.",
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
      leadBank: "Porosia jote është në rrugë.",
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
      leadCard: "Porosia jote u anulua sepse pagesa me kartë nuk u përfundua; s'të është zbritur asgjë. Nëse do ta blesh, bëj një porosi të re.",
    },
  },
  en: {
    order_placed: {
      subject: (r) => `Order ${r} received`,
      title: "Thank you for your order!",
      lead: "We received your order and are reviewing it. We'll let you know as soon as it's confirmed. You pay when you receive it.",
      leadBank: "We received your order. It will be confirmed as soon as your bank transfer arrives.",
      leadCard: "We received your order. It will be confirmed as soon as your card payment completes. If you closed the payment page without finishing, the order is cancelled automatically after two hours and you can place it again.",
      leadCardPaid: "We received your order and your card payment, thank you! We'll let you know as soon as it's confirmed.",
    },
    status_confirmed: {
      subject: (r) => `Order ${r} confirmed`,
      title: "Order confirmed",
      lead: "Your order is confirmed and is being prepared for delivery.",
    },
    status_shipped: {
      subject: (r) => `Order ${r} is on its way`,
      title: "Your order is on its way",
      lead: "Your order is on its way. You pay when you receive it.",
      leadBank: "Your order is on its way.",
    },
    status_delivered: {
      subject: (r) => `Order ${r} delivered`,
      title: "Order delivered",
      lead: "Your order was delivered. Thank you for choosing Bebix!",
    },
    status_cancelled: {
      subject: (r) => `Order ${r} cancelled`,
      title: "Order cancelled",
      lead: "Your order was cancelled. If you weren't expecting this, write to us and we'll sort it out.",
      leadCard: "Your order was cancelled because the card payment was not completed; nothing was charged. If you still want it, place a new order.",
    },
  },
};

function itemsTable(o: Order, meta: Meta, L: (typeof TX)[Lang]): string {
  const rows = (o.items ?? []).map((i) => {
    const m = i.id ? meta.get(i.id) : undefined;
    const img = i.imageUrl || m?.img;
    const photo = img
      ? `<img src="${esc(img)}" width="56" height="56" alt="" style="display:block;width:56px;height:56px;object-fit:contain;background:#fff;border:1px solid #eee;border-radius:8px;">`
      : "";
    const code = m?.code ? `<br><span style="font-size:12px;color:#857c71;">${L.code}: ${esc(m.code)}</span>` : "";
    return `<tr><td style="padding:8px 10px 8px 0;border-bottom:1px solid #eee;width:56px;">${photo}</td><td style="padding:8px 0;border-bottom:1px solid #eee;">${esc(i.name)} <span style="color:#888;">× ${esc(i.qty)}</span>${code}</td><td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right;white-space:nowrap;">${eur(Number(i.price) * Number(i.qty))}</td></tr>`;
  }).join("");
  const ship = Number(o.shipping_fee) || 0;
  const shipRow = ship > 0
    ? `<tr><td></td><td style="padding:8px 0;color:#565047;">${L.delivery}</td><td style="padding:8px 0;text-align:right;white-space:nowrap;">${eur(ship)}</td></tr>`
    : "";
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="font-size:14px;color:#1c1a16;">${rows}${shipRow}
    <tr><td></td><td style="padding:12px 0 0;font-weight:700;">${L.total}</td><td style="padding:12px 0 0;text-align:right;font-weight:700;">${eur(o.total_price)}</td></tr></table>`;
}

function shell(title: string, body: string, lang: Lang): string {
  // Logoja rri te një breshëri e errët me ngjyrë të vetën (shkronjat e çelëta, X e kaltër): me sfond të bardhë ose të zi
  // (modaliteti i errët i Gmail-it e kthen të bardhën në të zezë) mbetet gjithmonë e lexueshme, sepse sfondi i saj nuk ndryshon.
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"></head><body style="margin:0;background:#f8f6f2;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:24px 12px;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="#ffffff" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;">
      <tr><td bgcolor="#1c2b43" style="background:#1c2b43;padding:20px 28px;"><img src="${SITE}/wordmark-dark.png" width="110" alt="Bebix" style="display:block;width:110px;height:auto;border:0;font-size:22px;font-weight:700;color:#f3f3f1;"></td></tr>
      <tr><td style="padding:24px 28px 28px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
          <tr><td style="font-size:18px;font-weight:700;color:#1c1a16;padding:0 0 6px;">${esc(title)}</td></tr>
          <tr><td style="font-size:14px;line-height:1.6;color:#565047;">${body}</td></tr>
        </table>
      </td></tr>
    </table>
    <p style="font-size:12px;color:#857c71;margin:16px 0 0;">Bebix · ${TX[lang].footer} · <a href="${SITE}" style="color:#857c71;">bebix.store</a></p>
  </td></tr></table></body></html>`;
}

function render(row: Row, o: Order, meta: Meta): { to: string; subject: string; html: string } | null {
  const r = ref(o.id);
  if (row.audience === "admin") {
    const L = TX.sq;
    const body = `<p style="margin:0 0 12px;"><strong>${esc(o.full_name)}</strong><br>${esc(o.phone)}<br>${esc(o.address)}, ${esc(o.city)}</p><p style="margin:0 0 12px;">${L.payment}: <strong>${esc(L.paymentLabel[o.payment_method ?? "cod"] ?? o.payment_method)}</strong>${o.payment_status && o.payment_status !== "unpaid" ? ` (${esc(o.payment_status)})` : ""}${o.lang === "en" ? " · EN" : ""}</p>${itemsTable(o, meta, L)}`;
    return { to: ADMIN_TO, subject: `Porosi e re ${r} · ${eur(o.total_price)} · ${o.city}`, html: shell(`Porosi e re ${r}`, body, "sq") };
  }

  const lang: Lang = o.lang === "en" ? "en" : "sq";
  const L = TX[lang];
  const t = CUSTOMER[lang][row.kind];
  if (!t || !row.to_email) return null;
  const bank = o.payment_method === "bank_transfer";
  const card = o.payment_method === "card";
  // Kartë: tekst i veçantë (e paguar ose jo), përndryshe si e paguar paraprakisht; e anuluar por e paguar mbetet teksti i zakonshëm.
  const lead = card
    ? ((o.payment_status === "paid" ? t.leadCardPaid : t.leadCard) ?? t.leadBank ?? t.lead)
    : bank && t.leadBank ? t.leadBank : t.lead;
  // Transfertë bankare e pa paguar: udhëzimet e pagesës bashkë me referencën (kodin e porosisë).
  const payBlock = bank && o.payment_status !== "paid"
    ? `<div style="margin:16px 0 0;padding:12px 14px;background:#f8f6f2;border-radius:10px;"><p style="margin:0 0 6px;font-weight:700;color:#1c1a16;">${L.payTitle}</p>${BANK_TEXT ? `<p style="margin:0 0 6px;white-space:pre-line;">${esc(BANK_TEXT)}</p>` : ""}<p style="margin:0;">${L.amount}: <strong>${eur(o.total_price)}</strong> · ${L.reference}: <strong>${esc(r)}</strong></p></div>`
    : "";
  const body = `<p style="margin:0 0 16px;">${esc(lead)}</p>
    <p style="margin:0 0 6px;font-weight:700;color:#1c1a16;">${L.order} ${esc(r)}</p>${itemsTable(o, meta, L)}${payBlock}
    <p style="margin:16px 0 0;"><strong>${L.deliveryTo}</strong> ${esc(o.full_name)}, ${esc(o.address)}, ${esc(o.city)}</p>
    <p style="margin:20px 0 0;"><a href="${SITE}/${lang}/shop/orders" style="display:inline-block;background:#1c2b43;color:#ffffff;font-weight:700;text-decoration:none;padding:11px 20px;border-radius:10px;">${L.seeOrders}</a></p>`;
  return { to: row.to_email, subject: t.subject(r), html: shell(t.title, body, lang) };
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
        // select("*"): shipping_fee, payment_*, lang ekzistojnë vetëm pas migrimit; funksioni punon edhe para tij.
        .select("*")
        .eq("id", row.order_id)
        .maybeSingle();
      if (orderError || !order) throw new Error(orderError?.message ?? "porosia s'u gjet");
      // Foto dhe kodi nga katalogu (porositë e vjetra s'e kanë foton te artikulli).
      const ids = [...new Set(((order as Order).items ?? []).map((i) => i.id).filter((x): x is string => !!x))];
      const meta: Meta = new Map();
      if (ids.length) {
        const [{ data: prods }, { data: pps }] = await Promise.all([
          supabase.from("products").select("id, image_url").in("id", ids),
          supabase.from("partner_products").select("product_id, sku").in("product_id", ids),
        ]);
        const sku = new Map((pps ?? []).map((p: { product_id: string; sku: string | null }) => [p.product_id, p.sku]));
        for (const id of ids) {
          const img = (prods ?? []).find((p: { id: string; image_url: string | null }) => p.id === id)?.image_url ?? null;
          meta.set(id, { img, code: sku.get(id) || id.slice(0, 8).toUpperCase() });
        }
      }
      const mail = render(row, order as Order, meta);
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
