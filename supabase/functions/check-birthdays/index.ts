import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Ditëlindja e bebit dhe kujtesa e dhuratës (7 ditë para).
 *
 * Auditimi (28 shtator 2026) e rishkroi, sepse versioni i vjetër:
 *   - mund të thirrej nga kushdo në internet (verify_jwt ishte i fikur dhe s'kishte
 *     asnjë kontroll), dhe çdo thirrje u dërgonte prindërve njoftimin sërish;
 *   - i dërgonte njoftimet direkt te Expo, duke anashkaluar cilësimin "Ditëlindja"
 *     dhe orët e qeta;
 *   - xhironte në 22:00 UTC dhe krahasonte me datën UTC: në verë kjo është mesnata
 *     e ditës TJETËR në Kosovë, pra urimi vinte një ditë vonë dhe në mesnatë.
 * Tani: vetëm cron-i (service_role) e thërret; njoftimet shkojnë në radhë
 * (`notification_outbox`) me dedupe vjetor dhe me `send_after` në 09:00 ora lokale;
 * i marrin edhe anëtarët e familjes.
 */

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

const TIME_ZONE = "Europe/Belgrade";

/** Vetëm thirrjet me çelësin e shërbimit (cron-i). verify_jwt vetëm kontrollon nënshkrimin. */
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

/** Data lokale (YYYY-MM-DD) e një çasti, në zonën e Kosovës. */
function localDate(at: Date): { y: number; m: number; d: number } {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" })
    .format(at)
    .split("-")
    .map(Number);
  return { y: parts[0], m: parts[1], d: parts[2] };
}

/** 09:00 ora lokale e një date, si çast UTC (për `send_after`). */
function nineLocal(date: { y: number; m: number; d: number }): string {
  // Diferenca e zonës në atë çast: provohet 09:00 UTC dhe korrigjohet me orën lokale që del.
  const guess = new Date(Date.UTC(date.y, date.m - 1, date.d, 9, 0, 0));
  const localHour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: TIME_ZONE, hour: "numeric", hour12: false }).format(guess));
  return new Date(guess.getTime() - (localHour - 9) * 3600000).toISOString();
}

/**
 * A bie ditëlindja (muaji `m`, dita `d`) në këtë datë. Bebet e lindura më 29 shkurt
 * e festojnë më 28 shkurt në vitet që s'janë të brishta (përndryshe s'merrnin urim
 * 3 vjet nga 4).
 */
function isBirthday(m: number, d: number, date: { y: number; m: number; d: number }): boolean {
  if (m === date.m && d === date.d) return true;
  const leap = (date.y % 4 === 0 && date.y % 100 !== 0) || date.y % 400 === 0;
  return m === 2 && d === 29 && !leap && date.m === 2 && date.d === 28;
}

type Profile = { user_id: string; baby_name: string | null; baby_dob: string };

async function allProfiles(): Promise<Profile[]> {
  const out: Profile[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("baby_profiles")
      .select("user_id, baby_name, baby_dob")
      .not("baby_dob", "is", null)
      .order("user_id")
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    out.push(...((data ?? []) as Profile[]));
    if (!data || data.length < 1000) break;
  }
  return out;
}

/** Pronari + anëtarët e familjes së tij: të gjithë e kanë të njëjtin bebe. */
async function householdOf(ownerIds: string[]): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  for (const id of ownerIds) map.set(id, [id]);
  for (let i = 0; i < ownerIds.length; i += 200) {
    const { data } = await supabase
      .from("baby_household_members")
      .select("owner_id, member_id")
      .in("owner_id", ownerIds.slice(i, i + 200));
    for (const row of (data ?? []) as { owner_id: string; member_id: string }[]) {
      map.get(row.owner_id)?.push(row.member_id);
    }
  }
  return map;
}

serve(async (req) => {
  if (!isServiceRole(req)) {
    return new Response(JSON.stringify({ error: "forbidden" }), { status: 403 });
  }

  // +6 orë: cron-i xhiron në mbrëmje UTC; kështu dita që trajtohet është gjithmonë
  // dita lokale që sapo nis (ose që do të nisë pas pak), si në verë ashtu edhe në dimër.
  const target = new Date(Date.now() + 6 * 3600000);
  const today = localDate(target);
  const inSeven = localDate(new Date(target.getTime() + 7 * 86400000));
  const sendAt = nineLocal(today);

  let profiles: Profile[];
  try {
    profiles = await allProfiles();
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }

  const birthdays: { profile: Profile; years: number }[] = [];
  const gifts: Profile[] = [];
  for (const p of profiles) {
    const [y, m, d] = p.baby_dob.slice(0, 10).split("-").map(Number);
    if (!y || !m || !d) continue;
    if (isBirthday(m, d, today) && today.y > y) birthdays.push({ profile: p, years: today.y - y });
    if (isBirthday(m, d, inSeven) && inSeven.y > y) gifts.push(p);
  }

  const household = await householdOf([...new Set([...birthdays.map((b) => b.profile.user_id), ...gifts.map((g) => g.user_id)])]);
  let queued = 0;

  for (const { profile, years } of birthdays) {
    const name = profile.baby_name?.trim() || "Bebi";
    for (const userId of household.get(profile.user_id) ?? [profile.user_id]) {
      const { error } = await supabase.rpc("enqueue_notification", {
        p_user: userId,
        p_key: "baby_birthday",
        p_title: "Gëzuar ditëlindjen!",
        p_body: years === 1 ? `Sot ${name} mbush 1 vjeç.` : `Sot ${name} mbush ${years} vjeç.`,
        p_data: { type: "birthday" },
        p_dedupe: `birthday:${profile.user_id}:${today.y}`,
        p_send_after: sendAt,
        p_expires_at: new Date(new Date(sendAt).getTime() + 14 * 3600000).toISOString(),
      });
      if (!error) queued++;
    }
  }

  for (const profile of gifts) {
    const name = profile.baby_name?.trim() || "bebit";
    for (const userId of household.get(profile.user_id) ?? [profile.user_id]) {
      const { error } = await supabase.rpc("enqueue_notification", {
        p_user: userId,
        p_key: "baby_birthday",
        p_title: "Ditëlindja po vjen",
        p_body: `Ditëlindja e ${name} është pas 7 ditësh.`,
        p_data: { type: "birthday" },
        p_dedupe: `gift:${profile.user_id}:${inSeven.y}`,
        p_send_after: sendAt,
        p_expires_at: new Date(new Date(sendAt).getTime() + 14 * 3600000).toISOString(),
      });
      if (!error) queued++;
    }
  }

  return new Response(JSON.stringify({ date: today, birthdays: birthdays.length, gifts: gifts.length, queued }), {
    headers: { "Content-Type": "application/json" },
  });
});
