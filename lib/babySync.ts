import { log } from "@/lib/log";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/lib/supabase/client";
import { resolveDataOwnerId } from "@/lib/baby/household";
import { getActiveChildId } from "@/lib/children/store";

/**
 * Sinkronizon emrin dhe datëlindjen e bebit te Supabase (tabela
 * `baby_profiles`) — nevojitet sepse skeduluesi i notifications
 * (Edge Function + cron) xhirohet në server dhe s'ka qasje te
 * AsyncStorage lokal i telefonit. Thirre çdo herë që ndryshon emri
 * ose data e lindjes (psh te "save()" te Cilësimet e bebit).
 */
/**
 * @param babyDobKey data e lindjes si "YYYY-MM-DD" LOKALE (shih localDateKey).
 *   Më parë dërgohej `toISOString().slice(0, 10)`: data e zgjedhur (mesnata
 *   lokale) në UTC bie një ditë më herët në Kosovë, pra serveri e ruante
 *   ditëlindjen një ditë para — dhe urimi e muaji i ri vinin një ditë herët.
 */
export async function syncBabyProfileToSupabase(babyName: string | null, babyDobKey: string | null): Promise<boolean> {
  // Disa fëmijë: emri dhe data shkojnë te fëmija aktiv (serveri e pasqyron fëmijën falas te baby_profiles).
  const childId = getActiveChildId();
  if (childId) {
    const { error } = await supabase
      .from("children")
      .update({ name: babyName, birth_date: babyDobKey, updated_at: new Date().toISOString() })
      .eq("id", childId);
    if (error) log("Gabim gjatë ruajtjes së fëmijës:", error.message);
    return !error;
  }
  // Profili i bebit i perket pronarit te te dhenave, jo secilit prind.
  const userId = await resolveDataOwnerId();
  if (!userId) return false;

  const { error } = await supabase.from("baby_profiles").upsert(
    {
      user_id: userId,
      baby_name: babyName,
      baby_dob: babyDobKey,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  if (error) log("Gabim gjatë sinkronizimit të profilit të bebit:", error.message);
  return !error;
}

const PROFILE_PENDING_KEY = "bebix_baby_profile_pending";

/**
 * Ruan emrin/datën te serveri; kur s'ka rrjet, e shënon si "në pritje" që të
 * dërgohet në hapjen tjetër — dhe që tërheqja nga serveri të mos e mbishkruajë
 * ndryshimin lokal me versionin e vjetër.
 */
export async function saveBabyProfileRemote(babyName: string | null, babyDobKey: string | null): Promise<boolean> {
  const ok = await syncBabyProfileToSupabase(babyName, babyDobKey).catch(() => false);
  if (ok) await AsyncStorage.removeItem(PROFILE_PENDING_KEY);
  else await AsyncStorage.setItem(PROFILE_PENDING_KEY, "1");
  return ok;
}

export async function isBabyProfilePending(): Promise<boolean> {
  return (await AsyncStorage.getItem(PROFILE_PENDING_KEY)) === "1";
}

/**
 * Emri dhe data e lindjes së bebit nga serveri — për telefonin e ri, për
 * prindin e dytë të familjes, dhe pas ri-instalimit. Më parë këto rrinin
 * vetëm në telefonin ku u shkruan: partneri e shihte bebin pa emër.
 */
export async function fetchBabyProfileBasics(): Promise<{ babyName: string | null; babyDob: string | null } | null> {
  const childId = getActiveChildId();
  if (childId) {
    const { data, error } = await supabase.from("children").select("name, birth_date").eq("id", childId).maybeSingle();
    if (error || !data) return null;
    return { babyName: data.name ?? null, babyDob: data.birth_date ?? null };
  }
  const ownerId = await resolveDataOwnerId();
  if (!ownerId) return null;
  const { data, error } = await supabase
    .from("baby_profiles")
    .select("baby_name, baby_dob")
    .eq("user_id", ownerId)
    .maybeSingle();
  if (error || !data) return null;
  return { babyName: data.baby_name ?? null, babyDob: data.baby_dob ?? null };
}
const PARENT_NAME_PENDING_KEY = "bebix_parent_name_pending";

/**
 * Emri i prindit te serveri, në rreshtin e VET (si fotoja e prindit): emri i takon llogarisë, jo bebit, ndaj
 * prindi i dytë i familjes s'e mbishkruan emrin e të parit. Më parë emri i ndryshuar te Cilësimet rrinte vetëm
 * në telefon: humbte në telefon të ri, pas ri-instalimit, ose pas hyrjes me një llogari tjetër ndërmjet.
 * Pa rrjet shënohet "në pritje" dhe dërgohet në hapjen tjetër, pa u mbishkruar nga versioni i vjetër i serverit.
 */
export async function saveParentNameRemote(name: string | null): Promise<boolean> {
  const userId = await currentUserId();
  let ok = false;
  if (userId) {
    const { error } = await supabase
      .from("baby_profiles")
      .upsert({ user_id: userId, parent_name: name, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
    ok = !error;
    if (error) log("Emri i prindit s'u ruajt te serveri:", error.message);
  }
  if (ok) await AsyncStorage.removeItem(PARENT_NAME_PENDING_KEY).catch(() => {});
  else await AsyncStorage.setItem(PARENT_NAME_PENDING_KEY, "1").catch(() => {});
  return ok;
}

export async function isParentNamePending(): Promise<boolean> {
  return (await AsyncStorage.getItem(PARENT_NAME_PENDING_KEY)) === "1";
}

/** Emri i prindit nga serveri; `undefined` kur s'u lexua (pa rrjet, pa sesion), `null` kur s'është vendosur. */
export async function fetchParentName(): Promise<string | null | undefined> {
  const userId = await currentUserId();
  if (!userId) return undefined;
  const { data, error } = await supabase.from("baby_profiles").select("parent_name").eq("user_id", userId).maybeSingle();
  if (error) return undefined;
  return (data as { parent_name?: string | null } | null)?.parent_name ?? null;
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
  // Fotoja e bebit i përket bebit (pronarit të të dhënave); fotoja e prindit
  // i përket llogarisë vetë. Më parë të dyja shkonin te pronari, dhe fotoja e
  // prindit të dytë zëvendësonte atë të pronarit në telefonin e tij.
  const childId = kind === "baby" ? getActiveChildId() : null;
  if (childId) {
    const { error } = await supabase
      .from("children")
      .update({ photo_path: storagePath, updated_at: new Date().toISOString() })
      .eq("id", childId);
    if (error) log("Gabim gjatë sinkronizimit të fotos së fëmijës:", error.message);
    return;
  }
  const userId = kind === "baby" ? await resolveDataOwnerId() : await currentUserId();
  if (!userId) return;

  const column = kind === "baby" ? "baby_photo_path" : "parent_photo_path";
  const { error } = await supabase.from("baby_profiles").upsert(
    { user_id: userId, [column]: storagePath, updated_at: new Date().toISOString() },
    { onConflict: "user_id" }
  );

  if (error) log("Gabim gjatë sinkronizimit të fotos së profilit:", error.message);
}

/** Rrugët e fotove të ruajtura te serveri, për t'i rikthyer në një pajisje të re. */
export async function fetchProfilePhotoPaths(): Promise<{
  babyPhotoPath: string | null;
  parentPhotoPath: string | null;
} | null> {
  const ownerId = await resolveDataOwnerId();
  const selfId = await currentUserId();
  if (!ownerId || !selfId) return null;

  const childId = getActiveChildId();
  const [{ data: owner, error: ownerError }, { data: self }] = await Promise.all([
    childId
      ? supabase.from("children").select("baby_photo_path:photo_path").eq("id", childId).maybeSingle()
      : supabase.from("baby_profiles").select("baby_photo_path").eq("user_id", ownerId).maybeSingle(),
    supabase.from("baby_profiles").select("parent_photo_path").eq("user_id", selfId).maybeSingle(),
  ]);
  if (ownerError) return null;

  return {
    babyPhotoPath: (owner as { baby_photo_path?: string | null } | null)?.baby_photo_path ?? null,
    parentPhotoPath: self?.parent_photo_path ?? null,
  };
}

async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}
