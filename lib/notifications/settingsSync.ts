import { supabase } from "@/lib/supabase/client";
import { NOTIFICATION_CATALOG, isNotificationEnabled, type NotificationPrefs } from "@/lib/notifications/catalog";

/**
 * Cilësimet e njoftimeve, te serveri.
 *
 * Kujtesat dhe njoftimet e komunitetit i dërgon serveri, jo telefoni — pra
 * ai duhet t'i dijë këto zgjedhje. Pa këtë, një prind që i fik kujtesat e
 * ushqyerjes do t'i merrte prapë.
 *
 * Dërgohet harta e plotë, jo vetëm ndryshimet: serveri nuk ka pse të dijë
 * parazgjedhjet e app-it, dhe kështu të dyja anët tregojnë të njëjtën gjë.
 */
export async function syncNotificationSettings(prefs: NotificationPrefs): Promise<void> {
  try {
    const { data } = await supabase.auth.getUser();
    const userId = data?.user?.id;
    if (!userId) return;

    const keys: Record<string, boolean> = {
      push: isNotificationEnabled(prefs, "push"),
    };
    for (const entry of NOTIFICATION_CATALOG) {
      keys[entry.key] = isNotificationEnabled(prefs, entry.key);
    }

    await supabase.from("notification_settings").upsert(
      {
        user_id: userId,
        prefs: keys,
        quiet_from: prefs.quietFrom,
        quiet_to: prefs.quietTo,
        feeding_gap_h: prefs.feedingGapH,
        diaper_gap_h: prefs.diaperGapH,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );
  } catch {
    // Cilësimet mbeten lokale; provohet sërish në ndryshimin tjetër.
  }
}
