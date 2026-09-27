import AsyncStorage from "@react-native-async-storage/async-storage";
import type { AppState } from "@/lib/state/types";
import type { BabyModuleState } from "@/lib/state/babyTypes";

/**
 * Ruajtja e gjendjes së app-it në telefon.
 *
 * Më parë e gjithë gjendja (profili, shporta, çdo shënim i bebit, ditari i
 * ndryshimeve) ruhej si NJË vlerë e vetme dhe rishkruhej e tëra në çdo prekje.
 * Dy rreziqe:
 *   - Android-i nuk lexon dot një vlerë mbi ~2 MB ("Row too big to fit into
 *     CursorWindow"). Një prind që shënon çdo ditë e arrin këtë brenda disa
 *     muajve: leximi dështonte, app-i niste bosh, dhe shkrimi i parë e
 *     mbishkruante historikun e ruajtur me gjendjen bosh.
 *   - Serializimi i gjithë historikut në çdo shtypje e ngadalësonte UI-n.
 * Tani: çdo listë e bebit ka çelësin e vet, shkruhet vetëm kur ndryshon
 * (krahasim reference — gjendja është e pandryshueshme), dhe pjesa tjetër
 * ruhet veç.
 */

export const APP_STATE_KEY = "bebix_app_state_v3";
export const BABY_KEY_PREFIX = "bebix_baby_v1:";

export type LoadResult = {
  state: Partial<AppState> | null;
  /** Diçka s'u lexua dot: historiku duhet rimarrë i plotë nga serveri. */
  failed: boolean;
};

export async function loadAppState(): Promise<LoadResult> {
  let failed = false;
  let main: Partial<AppState> | null = null;

  try {
    const raw = await AsyncStorage.getItem(APP_STATE_KEY);
    if (raw) main = JSON.parse(raw) as Partial<AppState>;
  } catch {
    failed = true;
  }

  let baby: Partial<BabyModuleState> | undefined = main?.baby;
  try {
    const keys = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith(BABY_KEY_PREFIX));
    if (keys.length) {
      baby = {};
      for (const key of keys) {
        try {
          const value = await AsyncStorage.getItem(key);
          if (value != null) (baby as Record<string, unknown>)[key.slice(BABY_KEY_PREFIX.length)] = JSON.parse(value);
        } catch {
          // Një listë e prishur ose tepër e madhe s'duhet t'i marrë me vete të tjerat.
          failed = true;
        }
      }
    }
  } catch {
    failed = true;
  }

  if (!main && !baby) return { state: null, failed };
  return { state: { ...(main ?? {}), ...(baby ? { baby: baby as BabyModuleState } : {}) }, failed };
}

let lastMain: string | null = null;
const lastBabyRefs = new Map<string, unknown>();

/** Shkruan vetëm atë që ndryshoi që nga ruajtja e fundit. */
export async function saveAppState(state: AppState): Promise<void> {
  const { baby, ...rest } = state;
  const writes: [string, string][] = [];

  const main = JSON.stringify(rest);
  if (main !== lastMain) {
    writes.push([APP_STATE_KEY, main]);
    lastMain = main;
  }

  for (const [key, value] of Object.entries(baby)) {
    if (lastBabyRefs.get(key) === value) continue;
    writes.push([BABY_KEY_PREFIX + key, JSON.stringify(value)]);
    lastBabyRefs.set(key, value);
  }

  if (writes.length === 0) return;
  try {
    await AsyncStorage.multiSet(writes);
  } catch {
    // Herën tjetër riprovohet gjithçka.
    lastMain = null;
    lastBabyRefs.clear();
  }
}

/** Për testet dhe për daljen nga llogaria. */
export function resetPersistenceCache(): void {
  lastMain = null;
  lastBabyRefs.clear();
}
