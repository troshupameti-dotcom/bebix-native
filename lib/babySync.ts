import { supabase } from "@/lib/supabase/client";
import { resolveDataOwnerId } from "@/lib/baby/household";

/**
 * Sinkronizon emrin dhe datëlindjen e bebit te Supabase (tabela
 * `baby_profiles`) — nevojitet sepse skeduluesi i notifications
 * (Edge Function + cron) xhirohet në server dhe s'ka qasje te
 * AsyncStorage lokal i telefonit. Thirre çdo herë që ndryshon emri
 * ose data e lindjes (psh te "save()" te Cilësimet e bebit).
 */
export async function syncBabyProfileToSupabase(babyName: string | null, babyDobIso: string | null) {
  // Profili i bebit i perket pronarit te te dhenave, jo secilit prind.
  const userId = await resolveDataOwnerId();
  if (!userId) return;

  const { error } = await supabase.from("baby_profiles").upsert(
    {
      user_id: userId,
      baby_name: babyName,
      baby_dob: babyDobIso ? babyDobIso.slice(0, 10) : null, // vetëm YYYY-MM-DD
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  if (error) console.log("Gabim gjatë sinkronizimit të profilit të bebit:", error.message);
}
/**
 * Ngarkon rrugën e një fotoje (bebi ose prind) te Supabase, që fotoja të
 * mos jetojë vetëm në AsyncStorage të kësaj pajisjeje.
 *
 * Pa këtë, fotoja zhdukej sapo aplikacioni instalohej rishtazi, cache-i
 * pastrohej, ose përdoruesi kyçej në një pajisje tjetër: file-i mbetej në
 * Storage, i braktisur, por asnjë rrugë lokale s'e gjente më.
 */
export async function syncProfilePhotoToSupabase(
  kind: "baby" | "parent",
  storagePath: string
): Promise<void> {
  const userId = await resolveDataOwnerId();
  if (!userId) return;

  const column = kind === "baby" ? "baby_photo_path" : "parent_photo_path";
  const { error } = await supabase.from("baby_profiles").upsert(
    { user_id: userId, [column]: storagePath, updated_at: new Date().toISOString() },
    { onConflict: "user_id" }
  );

  if (error) console.log("Gabim gjatë sinkronizimit të fotos së profilit:", error.message);
}

/** Rrugët e fotove të ruajtura te serveri, për t'i rikthyer në një pajisje të re. */
export async function fetchProfilePhotoPaths(): Promise<{
  babyPhotoPath: string | null;
  parentPhotoPath: string | null;
} | null> {
  const userId = await resolveDataOwnerId();
  if (!userId) return null;

  const { data, error } = await supabase
    .from("baby_profiles")
    .select("baby_photo_path, parent_photo_path")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) return null;
  return {
    babyPhotoPath: data.baby_photo_path ?? null,
    parentPhotoPath: data.parent_photo_path ?? null,
  };
}
