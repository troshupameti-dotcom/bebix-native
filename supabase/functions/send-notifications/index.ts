import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Zbraz radhen e njoftimeve (`notification_outbox`).
 *
 * Nje rruge e vetme dergimi per gjithcka: komunitet, porosi, kujtesa.
 * Triggerat dhe kujtesat vetem SHKRUAJNE ne radhe — pa kete, nje postim i
 * nje eksperti me 500 ndjekes do te thoshte 500 thirrje HTTP nga brenda
 * nje triggeri, dhe nje deshtim rrjeti do te humbte njoftimet pa gjurme.
 *
 * Cilesimet e perdoruesit filtrohen kur shkruhet ne radhe; oret e qeta
 * filtrohen ne SQL (njoftimi nuk humbet — pret derisa te kaloje qetesia).
 */

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

const BATCH = 200;
const EXPO_CHUNK = 100;

type Pending = { id: number; user_id: string; key: string; title: string; body: string; data: Record<string, unknown> };

/**
 * Vetem cron-i (service_role). verify_jwt kontrollon vetem nenshkrimin, dhe
 * celesi publik (anon) eshte po ashtu JWT i nenshkruar — pa kete, kushdo me
 * celesin e app-it mund ta nxiste radhen sa here te donte.
 */
function isServiceRole(req: Request): boolean {
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const part = token.split(".")[1];
  if (!part) return false;
  try {
    const json = JSON.parse(atob(part.replace(/-/g, "+").replace(/_/g, "/")));
    return json?.role === "service_role";
  } catch {
    return false;
  }
}

serve(async (req) => {
  if (!isServiceRole(req)) {
    return new Response(JSON.stringify({ error: "forbidden" }), { status: 403 });
  }

  const { data: pending, error } = await supabase.rpc("pending_notifications", { p_limit: BATCH });
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  const rows = (pending ?? []) as Pending[];
  if (rows.length === 0) {
    return new Response(JSON.stringify({ pending: 0, sent: 0 }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const userIds = [...new Set(rows.map((r) => r.user_id))];
  const { data: tokenRows } = await supabase
    .from("push_tokens")
    .select("user_id, expo_push_token")
    .in("user_id", userIds);

  const tokensByUser = new Map<string, string[]>();
  for (const row of tokenRows ?? []) {
    const list = tokensByUser.get(row.user_id) ?? [];
    list.push(row.expo_push_token);
    tokensByUser.set(row.user_id, list);
  }

  const messages: { to: string; title: string; body: string; sound: string; data: unknown }[] = [];
  // Token-at qe Expo i refuzon si te c'instaluar (DeviceNotRegistered) fshihen:
  // pa kete, tabela mbushej me pajisje te vdekura dhe cdo dergim i provonte serish.
  const deadTokens = new Set<string>();
  const sendingIds: number[] = [];
  const noTokenIds: number[] = [];

  for (const row of rows) {
    const tokens = tokensByUser.get(row.user_id) ?? [];
    if (tokens.length === 0) {
      // Pa pajisje te regjistruar nuk ka ku shkoje; shenohet e mbyllur qe
      // te mos mbetet pergjithmone ne radhe.
      noTokenIds.push(row.id);
      continue;
    }
    for (const token of tokens) {
      messages.push({
        to: token,
        title: row.title,
        body: row.body,
        sound: "default",
        data: { ...row.data, key: row.key },
      });
    }
    sendingIds.push(row.id);
  }

  let failure: string | null = null;
  let deliveredChunks = 0;

  for (let i = 0; i < messages.length; i += EXPO_CHUNK) {
    try {
      const response = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(messages.slice(i, i + EXPO_CHUNK)),
      });
      if (!response.ok) {
        failure = `Expo ${response.status}: ${(await response.text()).slice(0, 150)}`;
        break;
      }
      const chunk = messages.slice(i, i + EXPO_CHUNK);
      const body = await response.json().catch(() => null) as { data?: { status?: string; details?: { error?: string } }[] } | null;
      (body?.data ?? []).forEach((ticket, index) => {
        if (ticket?.status === "error" && ticket.details?.error === "DeviceNotRegistered" && chunk[index]) {
          deadTokens.add(chunk[index].to);
        }
      });
      deliveredChunks++;
    } catch (e) {
      failure = String(e).slice(0, 200);
      break;
    }
  }

  const now = new Date().toISOString();

  if (deadTokens.size > 0) {
    await supabase.from("push_tokens").delete().in("expo_push_token", [...deadTokens]);
  }

  if (failure) {
    // Riprovohen heren tjeter; pas 5 provash nuk merren me.
    await supabase.rpc("mark_notifications_failed", { p_ids: sendingIds, p_error: failure });
    return new Response(JSON.stringify({ pending: rows.length, sent: 0, error: failure }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  }

  if (sendingIds.length > 0) {
    await supabase.from("notification_outbox").update({ sent_at: now }).in("id", sendingIds);
  }
  if (noTokenIds.length > 0) {
    await supabase
      .from("notification_outbox")
      .update({ sent_at: now, error: "pa pajisje te regjistruar" })
      .in("id", noTokenIds);
  }

  return new Response(
    JSON.stringify({
      pending: rows.length,
      sent: sendingIds.length,
      skipped: noTokenIds.length,
      chunks: deliveredChunks,
      removedTokens: deadTokens.size,
    }),
    { headers: { "Content-Type": "application/json" } }
  );
});
