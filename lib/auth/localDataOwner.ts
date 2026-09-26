import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Kujt i përkasin të dhënat e bebit që rrinë në këtë telefon.
 *
 * App-i punon offline: historiku i bebit rri në AsyncStorage dhe
 * sinkronizohet me llogarinë e kyçur. Pa këtë shenjë, kur një llogari
 * tjetër hynte në të njëjtin telefon, historiku i së parës dërgohej te e
 * dyta (dhe kujtesa e sync-ut ishte e përbashkët për të dyja).
 */
const KEY = "bebix_local_data_user";

export type OwnerCheck = "same" | "claimed" | "switched";

/**
 * "claimed": s'kishte pronar (hera e parë, ose app-i para këtij ndryshimi) —
 *   të dhënat lokale i kalojnë kësaj llogarie, si më parë.
 * "switched": i përkisnin një llogarie tjetër — thirrësi duhet t'i pastrojë.
 */
export async function claimLocalData(userId: string): Promise<OwnerCheck> {
  const current = await AsyncStorage.getItem(KEY);
  if (current === userId) return "same";
  await AsyncStorage.setItem(KEY, userId);
  return current ? "switched" : "claimed";
}

// ---- Rikthimi i fjalëkalimit ----
// Linku i rikthimit fut në app sesionin që mban vetë. Pa kontroll, dikush
// mund t'i dërgonte tjetrit një link me sesionin e VET, dhe telefoni i tjetrit
// do të kalonte në atë llogari. Tani linku pranohet vetëm kur rikthimi u
// kërkua nga ky telefon, pak më parë.

const RECOVERY_KEY = "bebix_recovery_requested_at";
/** Sa kohë vlen kërkesa (linku i Supabase-it skadon po ashtu brenda kësaj kohe). */
const RECOVERY_WINDOW_MS = 2 * 60 * 60 * 1000;

export async function markRecoveryRequested(): Promise<void> {
  await AsyncStorage.setItem(RECOVERY_KEY, String(Date.now()));
}

/** A u kërkua rikthimi nga ky telefon së fundmi? E shlyen shenjën pas leximit. */
export async function consumeRecoveryRequest(now: number = Date.now()): Promise<boolean> {
  const raw = await AsyncStorage.getItem(RECOVERY_KEY);
  await AsyncStorage.removeItem(RECOVERY_KEY);
  const at = raw ? Number(raw) : NaN;
  return Number.isFinite(at) && now - at >= 0 && now - at <= RECOVERY_WINDOW_MS;
}
