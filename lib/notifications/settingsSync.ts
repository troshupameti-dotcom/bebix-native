import { supabase } from "@/lib/supabase/client";
import type { NotificationPrefs } from "@/lib/state/types";

/**
 * Cilësimet e njoftimeve, te serveri.
 *
 * Deri tani rrinin vetëm në AsyncStorage. Kjo mjaftonte sa kohë njoftimet
 * ndërtoheshin në telefon — por tani kujtesat e vaksinave dhe statusi i
 * porosisë dërgohen nga serveri, dhe serveri s'ka si ta dijë që përdoruesi
 * i ka fikur nëse nuk ia themi.
 *
 * Mungesa e rreshtit do të thotë "të ndezura", njësoj si parazgjedhja e
 * app-it — pra një përdorues që nuk i prek kurrë cilësimet i merr.
 */

/** Ç'pjesë e cilësimeve ka kuptim për serverin. */
function toRow(prefs: NotificationPrefs) {
  return {
    // Push-i i fikur fare do të thotë asgjë nuk dërgohet.
    vaccine_reminders: prefs.pushEnabled && prefs.vaccinationReminders,
    order_updates: prefs.pushEnabled,
    updated_at: new Date().toISOString(),
  };
}

/**
 * Ruan cilësimet për përdoruesin aktual. Heshtazi: nëse s'ka rrjet ose
 * s'ka sesion, app-i vazhdon — dhe sinkronizohet herën tjetër.
 */
export async function syncNotificationSettings(prefs: NotificationPrefs): Promise<void> {
  try {
    const { data } = await supabase.auth.getUser();
    const userId = data?.user?.id;
    if (!userId) return;

    await supabase
      .from("notification_settings")
      .upsert({ user_id: userId, ...toRow(prefs) }, { onConflict: "user_id" });
  } catch {
    // Cilësimet mbeten lokale; provohet sërish në ndryshimin tjetër.
  }
}
