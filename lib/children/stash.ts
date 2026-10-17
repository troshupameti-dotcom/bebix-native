import AsyncStorage from "@react-native-async-storage/async-storage";
import type { BabyModuleState } from "@/lib/state/babyTypes";
import type { BabyProfile } from "@/lib/state/types";
import type { RecordsSyncState } from "@/lib/baby/babyRecordsSync";

/**
 * Të dhënat e fëmijëve JOAKTIVË në telefon. Fëmija aktiv rri aty ku rrinte gjithmonë bebi (gjendja e app-it);
 * kur prindi ndërron fëmijë, ai aktual ruhet këtu dhe tjetri merret prej këtu. Kështu ndërrimi s'shkarkon gjithçka
 * nga e para, dhe asgjë s'përzihet mes fëmijëve.
 *
 * Çdo listë ka çelësin e vet (si te lib/state/persistence.ts): Android-i s'lexon vlera mbi ~2 MB.
 */
const PREFIX = "bebix_child_v1:";

/** Fushat e profilit që i përkasin fëmijës (jo prindit). */
export const CHILD_PROFILE_KEYS = [
  "babyName",
  "nickname",
  "babyDob",
  "babyGender",
  "babyPhoto",
  "babyPhotoPath",
  "bloodType",
  "allergies",
  "pediatrician",
  "medicalNotes",
  "parentNotes",
] as const satisfies readonly (keyof BabyProfile)[];

export type ChildProfileFields = Pick<BabyProfile, (typeof CHILD_PROFILE_KEYS)[number]>;

export type ChildSnapshot = {
  baby: Partial<BabyModuleState>;
  profile: Partial<ChildProfileFields>;
  sync: RecordsSyncState | null;
};

export function childProfileOf(profile: BabyProfile): ChildProfileFields {
  const out = {} as Record<string, unknown>;
  for (const k of CHILD_PROFILE_KEYS) out[k] = profile[k];
  return out as ChildProfileFields;
}

const listKey = (childId: string, key: string) => `${PREFIX}${childId}:baby:${key}`;
const profileKey = (childId: string) => `${PREFIX}${childId}:profile`;
const syncKey = (childId: string) => `${PREFIX}${childId}:sync`;

/** Ruan fëmijën që po lihet. Hedh gabim kur s'ruhet dot (ndërrimi atëherë s'bëhet). */
export async function saveChildSnapshot(childId: string, snapshot: ChildSnapshot): Promise<void> {
  const writes: [string, string][] = Object.entries(snapshot.baby).map(([k, v]) => [listKey(childId, k), JSON.stringify(v)]);
  writes.push([profileKey(childId), JSON.stringify(snapshot.profile)]);
  writes.push([syncKey(childId), JSON.stringify(snapshot.sync)]);
  await AsyncStorage.multiSet(writes);
}

/** Fëmija që po hapet; null kur s'është hapur kurrë në këtë telefon (merret i plotë nga serveri). */
export async function loadChildSnapshot(childId: string): Promise<ChildSnapshot | null> {
  const keys = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith(`${PREFIX}${childId}:`));
  if (keys.length === 0) return null;
  const baby: Record<string, unknown> = {};
  let profile: Partial<ChildProfileFields> = {};
  let sync: RecordsSyncState | null = null;
  const babyPrefix = `${PREFIX}${childId}:baby:`;
  for (const key of keys) {
    try {
      const raw = await AsyncStorage.getItem(key);
      if (raw == null) continue;
      const value = JSON.parse(raw);
      if (key.startsWith(babyPrefix)) baby[key.slice(babyPrefix.length)] = value;
      else if (key === profileKey(childId)) profile = value ?? {};
      else if (key === syncKey(childId)) sync = value;
    } catch {
      // Një listë e prishur: sync-u i plotë (pa kursor) e rimerr nga serveri.
      sync = null;
    }
  }
  return { baby: baby as Partial<BabyModuleState>, profile, sync };
}

/** Pasi fëmija u hap: kopja e vjetër s'duhet më (gjendja e app-it është tani burimi). */
export async function dropChildSnapshot(childId: string): Promise<void> {
  const keys = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith(`${PREFIX}${childId}:`));
  if (keys.length) await AsyncStorage.multiRemove(keys);
}

/** Dalja nga llogaria / ndërrimi i familjes. */
export async function clearChildSnapshots(): Promise<void> {
  const keys = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith(PREFIX));
  if (keys.length) await AsyncStorage.multiRemove(keys);
}
