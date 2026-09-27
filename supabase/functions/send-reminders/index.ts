import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Kujtesat e bebit. Xhiron cdo 30 minuta.
 *
 * Dy lloje:
 *  - BOSHLLEQE (ushqyerje, pelena, gjume): kontrollohen sa here xhiron.
 *    Kane skadence — nje kujtese "4 ore pa ushqyerje" e derguar 5 ore me
 *    vone eshte zhurme.
 *  - DITORE (vaksina, matje, muaj i ri): vetem kur ora lokale eshte 7.
 *
 * Asgje nuk dergohet prej ketu: gjithcka shkruhet ne `notification_outbox`
 * dhe e dergon `send-notifications`. Nje rruge e vetme, me cilesimet e
 * perdoruesit dhe oret e qeta te zbatuara ne nje vend.
 */

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

// Pragjet e boshlleqeve, ne ore. Ushqyerjen dhe pelenat i zgjedh prindi
// (notification_settings.feeding_gap_h / diaper_gap_h); keto jane parazgjedhjet.
const DEFAULT_FEEDING_GAP_H = 4;
const DEFAULT_DIAPER_GAP_H = 4;
const AWAKE_GAP_H = 3;

const REMIND_DAYS_BEFORE = [1, 0];
const REMIND_DAYS_AFTER = [3, 7];

type Row = { user_id: string; id: string; payload: Record<string, unknown>; occurred_at: string; kind: string };

function hoursSince(iso: string | null | undefined): number {
  if (!iso) return Number.POSITIVE_INFINITY;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return Number.POSITIVE_INFINITY;
  return (Date.now() - t) / 3600000;
}

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function daysUntil(dueDate: string, today: Date): number | null {
  const due = new Date(dueDate);
  if (Number.isNaN(due.getTime())) return null;
  return Math.round((startOfDay(due) - startOfDay(today)) / 86400000);
}

async function enqueue(
  userId: string, key: string, title: string, body: string,
  data: Record<string, unknown>, dedupe: string, expiresInMinutes?: number
) {
  await supabase.rpc("enqueue_notification", {
    p_user: userId,
    p_key: key,
    p_title: title,
    p_body: body,
    p_data: data,
    p_dedupe: dedupe,
    p_send_after: new Date().toISOString(),
    p_expires_at: expiresInMinutes
      ? new Date(Date.now() + expiresInMinutes * 60000).toISOString()
      : null,
  });
}

/**
 * Regjistrimi i fundit per cdo perdorues, per nje lloj, brenda dritares
 * kohore. Llogaritet ne baze (distinct on), jo duke lexuar rreshtat e te
 * gjitheve ketu: perndryshe, me shume perdorues, disa nuk do te merrnin kujtese.
 */
async function lastByUser(kind: string, withinHours: number): Promise<Map<string, Row>> {
  const { data, error } = await supabase.rpc("latest_baby_record_per_user", {
    p_kind: kind,
    p_since: new Date(Date.now() - withinHours * 3600000).toISOString(),
  });
  if (error) console.log(`latest_baby_record_per_user(${kind}):`, error.message);

  const map = new Map<string, Row>();
  for (const row of (data ?? []) as Omit<Row, "kind">[]) map.set(row.user_id, { ...row, kind });
  return map;
}

/** Pas sa oresh i kujtohet secilit prind ushqyerja dhe pelena. */
async function gapSettings(userIds: string[]): Promise<Map<string, { feeding: number; diaper: number }>> {
  const map = new Map<string, { feeding: number; diaper: number }>();
  // Ne grupe, qe adresa e kerkeses te mos behet shume e gjate.
  for (let i = 0; i < userIds.length; i += 200) {
    const { data } = await supabase
      .from("notification_settings")
      .select("user_id, feeding_gap_h, diaper_gap_h")
      .in("user_id", userIds.slice(i, i + 200));
    for (const s of (data ?? []) as { user_id: string; feeding_gap_h: number | null; diaper_gap_h: number | null }[]) {
      map.set(s.user_id, {
        feeding: s.feeding_gap_h ?? DEFAULT_FEEDING_GAP_H,
        diaper: s.diaper_gap_h ?? DEFAULT_DIAPER_GAP_H,
      });
    }
  }
  return map;
}

/**
 * Vetem cron-i (service_role). verify_jwt kontrollon vetem nenshkrimin, dhe
 * celesi publik (anon) eshte po ashtu JWT i nenshkruar.
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

/**
 * Pronari + anetaret e familjes se tij. Kujtesat i perkasin bebit, jo
 * llogarise: prindi i dyte i ftuar duhet t'i marre njesoj.
 */
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
  const now = new Date();
  const localHour = Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Belgrade", hour: "numeric", hour12: false }).format(now)
  );
  const counts: Record<string, number> = {};
  const bump = (k: string) => { counts[k] = (counts[k] ?? 0) + 1; };

  // =============== BOSHLLEQET ===============
  // Kujtesat dalin vetem brenda 24 oresh (gjumi: nga fillimi i tij, qe
  // zgjimi te bjere ende brenda 12 oreve).
  const [feedings, diapers, sleeps] = await Promise.all([
    lastByUser("feeding", 24),
    lastByUser("diaper", 24),
    lastByUser("sleep", 36),
  ]);
  const household = await householdOf([...new Set([...feedings.keys(), ...diapers.keys(), ...sleeps.keys()])]);
  const recipients = [...new Set([...household.values()].flat())];
  const gaps = await gapSettings(recipients);

  for (const [ownerId, row] of feedings) {
    const gap = hoursSince(row.occurred_at);
    for (const userId of household.get(ownerId) ?? [ownerId]) {
      // Secili prind me pragun e vet (cilesimet jane per llogari).
      if (gap >= (gaps.get(userId)?.feeding ?? DEFAULT_FEEDING_GAP_H) && gap < 24) {
        // Dedupe mbi regjistrimin e fundit: nje kujtese per boshllek, jo nje
        // per cdo xhirim.
        await enqueue(userId, "baby_feeding", "Koha e ushqyerjes?",
          `Kane kaluar ${Math.floor(gap)} ore nga ushqyerja e fundit.`,
          { type: "feeding" }, `feed:${row.id}`, 90);
        bump("feeding");
      }
    }
  }

  for (const [ownerId, row] of diapers) {
    const gap = hoursSince(row.occurred_at);
    for (const userId of household.get(ownerId) ?? [ownerId]) {
      if (gap >= (gaps.get(userId)?.diaper ?? DEFAULT_DIAPER_GAP_H) && gap < 24) {
        await enqueue(userId, "baby_diaper", "Pelena",
          `Kane kaluar ${Math.floor(gap)} ore nga pelena e fundit.`,
          { type: "diaper" }, `diaper:${row.id}`, 90);
        bump("diaper");
      }
    }
  }

  for (const [ownerId, row] of sleeps) {
    const endAt = row.payload?.endAt;
    if (typeof endAt !== "string") continue; // ende duke fjetur
    const awake = hoursSince(endAt);
    if (awake >= AWAKE_GAP_H && awake < 12) {
      for (const userId of household.get(ownerId) ?? [ownerId]) {
        await enqueue(userId, "baby_sleep", "Koha e gjumit?",
          `Bebi eshte zgjuar prej ${Math.floor(awake)} oresh.`,
          { type: "sleep" }, `sleep:${row.id}`, 90);
        bump("sleep");
      }
    }
  }

  // =============== ILACET ===============
  const { data: dueMeds } = await supabase.rpc("due_medications");
  const meds = (dueMeds ?? []) as { id: string; user_id: string; name: string; dose: string | null; slot: string }[];
  const medHousehold = await householdOf([...new Set(meds.map((m) => m.user_id))]);
  const medIds: string[] = [];
  for (const med of meds) {
    for (const userId of medHousehold.get(med.user_id) ?? [med.user_id]) {
      await enqueue(userId, "baby_medicine", "Koha e ilacit",
        med.dose ? `${med.name} — ${med.dose}` : med.name,
        { type: "medicine", scheduleId: med.id }, `med:${med.id}:${med.slot}`, 120);
      bump("medicine");
    }
    medIds.push(med.id);
  }
  if (medIds.length > 0) {
    await supabase.rpc("mark_medication_sent", { p_ids: medIds });
  }

  // =============== DITORET (vetem ne oren 7) ===============
  if (localHour === 7) {
    // Ne faqe: me shume se 1000 vaksina te pabera s'duhet te humbasin kujtesen.
    const vaccines: Row[] = [];
    for (let from = 0; ; from += 1000) {
      const { data } = await supabase
        .from("baby_records")
        .select("user_id, id, payload")
        .eq("kind", "vaccine")
        .is("deleted_at", null)
        .filter("payload->>givenDate", "is", null)
        .order("user_id")
        .order("id")
        .range(from, from + 999);
      vaccines.push(...((data ?? []) as Row[]));
      if (!data || data.length < 1000) break;
    }

    const profiles: { user_id: string; baby_name: string | null; baby_dob: string }[] = [];
    for (let from = 0; ; from += 1000) {
      const { data } = await supabase
        .from("baby_profiles")
        .select("user_id, baby_name, baby_dob")
        .not("baby_dob", "is", null)
        .order("user_id")
        .range(from, from + 999);
      profiles.push(...((data ?? []) as { user_id: string; baby_name: string | null; baby_dob: string }[]));
      if (!data || data.length < 1000) break;
    }

    const dailyHousehold = await householdOf([...new Set([...vaccines.map((v) => v.user_id), ...profiles.map((p) => p.user_id)])]);

    for (const row of vaccines) {
      const dueDate = row.payload?.dueDate;
      if (typeof dueDate !== "string") continue;
      const days = daysUntil(dueDate, now);
      if (days === null) continue;

      const wanted = days >= 0 ? REMIND_DAYS_BEFORE.includes(days) : REMIND_DAYS_AFTER.includes(-days);
      if (!wanted) continue;

      const name = typeof row.payload?.name === "string" ? row.payload.name : "Vaksina";
      const title = days === 1 ? "Vaksine neser" : days === 0 ? "Vaksine sot" : "Vaksine me vonese";
      const body = days === 1
        ? `${name} eshte neser. Kontrollo orarin e qendres.`
        : days === 0
          ? `${name} eshte sot.`
          : `${name} kishte afat ${Math.abs(days)} dite me pare.`;

      for (const userId of dailyHousehold.get(row.user_id) ?? [row.user_id]) {
        await enqueue(userId, "baby_vaccine", title, body, { type: "vaccine" }, `vaccine:${row.id}:${days}`);
        bump("vaccine");
      }
    }

    // Mungesa brenda 30 diteve = koha per matje (edhe kur s'ka asnje matje).
    const growth = await lastByUser("growth", 30 * 24);

    for (const p of profiles) {
      const people = dailyHousehold.get(p.user_id) ?? [p.user_id];
      const name = p.baby_name?.trim() || "Bebi";
      const dob = new Date(p.baby_dob);
      if (Number.isNaN(dob.getTime())) continue;

      // Matjet: asnje e re prej 30 ditesh.
      const last = growth.get(p.user_id);
      const sinceGrowth = hoursSince(last?.occurred_at) / 24;
      if (sinceGrowth >= 30) {
        for (const userId of people) {
          await enqueue(userId, "baby_growth", "Koha per matje",
            `Ka kaluar nje muaj nga matja e fundit e ${name}. Pesha dhe gjatesia ndihmojne te shihet ecuria.`,
            { type: "growth" }, `growth:${p.user_id}:${now.getFullYear()}-${now.getMonth() + 1}`);
          bump("growth");
        }
      }

      // Muaji i ri: dita e muajit perputhet me datelindjen.
      if (dob.getDate() === now.getDate()) {
        const months = (now.getFullYear() - dob.getFullYear()) * 12 + (now.getMonth() - dob.getMonth());
        if (months >= 1 && months <= 36) {
          for (const userId of people) {
            await enqueue(userId, "baby_milestone", `${name} mbushi ${months} muaj`,
              "Shiko cfare pritet ne kete moshe dhe shenoje peshen e re.",
              { type: "milestone", months }, `milestone:${p.user_id}:${months}`);
            bump("milestone");
          }
        }
      }
    }
  }

  return new Response(JSON.stringify({ localHour, queued: counts }), {
    headers: { "Content-Type": "application/json" },
  });
});
