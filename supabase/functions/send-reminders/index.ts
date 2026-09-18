import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Kujtesat ditore për vaksinat.
 *
 * Zilja te faqja kryesore llogaritej vetëm në telefon: prindi e mësonte
 * vonesën e vaksinës kur e hapte app-in, jo përpara. Ky funksion e kthen
 * atë në njoftim që arrin vetë.
 *
 * Kalendarin e vaksinave nuk e rindërtojmë këtu — regjistrimet vijnë të
 * sinkronizuara te `baby_records` me `dueDate` dhe `givenDate` brenda
 * payload-it, pra serveri lexon të njëjtën të vërtetë që sheh app-i.
 *
 * Nuk dërgohet e njëjta gjë dy herë: çdo dërgesë shënohet te
 * `notification_log`, dhe çelësi është regjistrimi + dita e kujtesës.
 */

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

/** Sa ditë përpara dhe pas kujtojmë. Jo çdo ditë — kujtesa e përditshme bëhet zhurmë. */
const REMIND_DAYS_BEFORE = [1, 0];
const REMIND_DAYS_AFTER = [3, 7];

type VaccineRow = { user_id: string; id: string; payload: Record<string, unknown> };
type PushMessage = { to: string; title: string; body: string; sound: string; data?: unknown };

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/** Ditë nga sot deri te data e caktuar; negative = ka kaluar. */
function daysUntil(dueDate: string, today: Date): number | null {
  const due = new Date(dueDate);
  if (Number.isNaN(due.getTime())) return null;
  return Math.round((startOfDay(due) - startOfDay(today)) / 86400000);
}

function messageFor(name: string, days: number): { title: string; body: string } | null {
  if (days === 1) return { title: "Vaksinë nesër", body: `${name} është nesër. Kontrollo orarin e qendrës.` };
  if (days === 0) return { title: "Vaksinë sot", body: `${name} është sot.` };
  if (days < 0) return { title: "Vaksinë me vonesë", body: `${name} kishte afat ${Math.abs(days)} ditë më parë.` };
  return null;
}

serve(async () => {
  const today = new Date();

  // Vetëm vaksinat e pabëra. Filtrimi i datës bëhet këtu, sepse `dueDate`
  // rri brenda JSON-it dhe formatet mund të ndryshojnë; nëse baza rritet,
  // kjo do të kërkojë kolonë të veçantë me indeks.
  const { data, error } = await supabase
    .from("baby_records")
    .select("user_id, id, payload")
    .eq("kind", "vaccine")
    .is("deleted_at", null)
    .filter("payload->>givenDate", "is", null)
    .limit(5000);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  const candidates: { userId: string; recordId: string; name: string; days: number }[] = [];

  for (const row of (data ?? []) as VaccineRow[]) {
    const dueDate = row.payload?.dueDate;
    if (typeof dueDate !== "string") continue;

    const days = daysUntil(dueDate, today);
    if (days === null) continue;

    const wanted = days >= 0 ? REMIND_DAYS_BEFORE.includes(days) : REMIND_DAYS_AFTER.includes(-days);
    if (!wanted) continue;

    const name = typeof row.payload?.name === "string" ? row.payload.name : "Vaksina";
    candidates.push({ userId: row.user_id, recordId: row.id, name, days });
  }

  if (candidates.length === 0) {
    return new Response(JSON.stringify({ checked: data?.length ?? 0, sent: 0 }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // Cilësimet: mungesa e rreshtit do të thotë "po" (parazgjedhja e app-it).
  const userIds = [...new Set(candidates.map((c) => c.userId))];
  const { data: settings } = await supabase
    .from("notification_settings")
    .select("user_id, vaccine_reminders")
    .in("user_id", userIds);

  const disabled = new Set(
    (settings ?? []).filter((s) => s.vaccine_reminders === false).map((s) => s.user_id)
  );

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

  const messages: PushMessage[] = [];
  const logRows: { user_id: string; kind: string; ref: string }[] = [];

  for (const c of candidates) {
    if (disabled.has(c.userId)) continue;

    const tokens = tokensByUser.get(c.userId) ?? [];
    if (tokens.length === 0) continue;

    const text = messageFor(c.name, c.days);
    if (!text) continue;

    // Çelësi i mospërsëritjes: ky regjistrim, kjo pikë e kujtesës.
    const ref = `${c.recordId}:${c.days}`;
    const { error: logError } = await supabase
      .from("notification_log")
      .insert({ user_id: c.userId, kind: "vaccine", ref });

    // 23505 = e dërguar më parë. Çdo gabim tjetër: mos dërgo, që të mos
    // rrezikojmë dërgim të përsëritur pa gjurmë.
    if (logError) continue;

    logRows.push({ user_id: c.userId, kind: "vaccine", ref });
    for (const token of tokens) {
      messages.push({ to: token, title: text.title, body: text.body, sound: "default", data: { type: "vaccine" } });
    }
  }

  // Expo pranon deri në 100 mesazhe për kërkesë.
  for (let i = 0; i < messages.length; i += 100) {
    await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(messages.slice(i, i + 100)),
    });
  }

  return new Response(
    JSON.stringify({ checked: data?.length ?? 0, reminders: logRows.length, messages: messages.length }),
    { headers: { "Content-Type": "application/json" } }
  );
});
