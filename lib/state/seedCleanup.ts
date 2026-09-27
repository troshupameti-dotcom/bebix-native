import type { BabyModuleState, GrowthStat, MedicalInfoRow, MilestoneItem } from "@/lib/state/babyTypes";

/**
 * Heq të dhënat demo me të cilat niste çdo instalim deri në shtator 2026.
 *
 * Gjendja fillestare e app-it kishte shënime të rreme — matje (4.1 kg ... 7.8 kg),
 * ushqyerje, gjumë, pelena, vaksina me "Dr. Arta Elezi", ngjarje si "Lindja 5 Maj
 * 2024" — dhe profil me grup gjaku "0+", peshë lindjeje "3.4 kg" e përqindje
 * rritjeje të sajuara. Çdo prind i ri i shihte si të bebit të vet, dhe sync-u
 * i dërgonte në server (web, partneri, kujtesat).
 *
 * Rregullat, që të mos preket asgjë që prindi e ka shkruar vetë:
 *   - Shënimet demo njihen nga id-ja e tyre fikse (f1, g1, v1...) DHE nga
 *     `editCount === 0`: të pa prekura. Fshihen butë (`deletedAt`), me
 *     `updatedAt` të ri, që fshirja të arrijë edhe te serveri dhe webi.
 *   - Vlerat demo të profilit pastrohen vetëm kur "nënshkrimi" demo është ende
 *     aty (p.sh. mjeku "Dr. Arta Elezi", që s'mund ta ketë shkruar prindi).
 *   - Bëhet një herë (flag-u `seedCleanupDone` te gjendja).
 */

export const SEED_RECORD_IDS: Partial<Record<keyof BabyModuleState, string[]>> = {
  growthHistory: ["g1", "g2", "g3", "g4"],
  timeline: ["t1", "t2", "t3", "t4"],
  feedingLog: ["f1", "f2"],
  sleepLog: ["s1"],
  diaperLog: ["d1"],
  vaccines: ["v1", "v2", "v3"],
};

const SEED_GROWTH_VALUES: Record<string, string> = { weight: "7.8 kg", height: "66 cm", head: "43 cm" };
const SEED_MEDICAL_VALUES: Record<string, string> = {
  blood: "0+",
  doctor: "Dr. Arta Elezi",
  birth_weight: "3.4 kg",
  rh: "Rh+",
};
const SEED_DONE_MILESTONES = ["smile", "rolling"];

type WithLifecycle = { id: string; editCount: number; deletedAt: string | null; updatedAt: string };

function softDeleteSeeds<T extends WithLifecycle>(list: T[], ids: string[], at: string): { list: T[]; changed: boolean } {
  let changed = false;
  const next = list.map((item) => {
    if (!ids.includes(item.id) || item.editCount !== 0 || item.deletedAt) return item;
    changed = true;
    return { ...item, deletedAt: at, updatedAt: at, editCount: 1 };
  });
  return { list: next, changed };
}

/** A është profili ende ai demo i pa prekur? Mjeku demo s'mund të jetë i shkruar nga prindi. */
function hasSeedProfileSignature(rows: MedicalInfoRow[]): boolean {
  const byKey = new Map(rows.map((r) => [r.key, r.value]));
  if (byKey.get("doctor") === SEED_MEDICAL_VALUES.doctor) return true;
  const others = ["blood", "birth_weight", "rh"].filter((k) => byKey.get(k) === SEED_MEDICAL_VALUES[k]);
  return others.length >= 2;
}

function cleanGrowthStats(stats: GrowthStat[]): { list: GrowthStat[]; changed: boolean } {
  let changed = false;
  const list = stats.map((s) => {
    if (s.isCustom) return s;
    // Përqindjet ("përqindja e 50-të") ishin të sajuara: app-i s'i llogarit.
    const seedValue = SEED_GROWTH_VALUES[s.key];
    const clearValue = seedValue !== undefined && s.value === seedValue;
    if (!clearValue && s.subKey === undefined) return s;
    changed = true;
    const { subKey: _dropped, ...rest } = s;
    return { ...rest, value: clearValue ? "" : s.value };
  });
  return { list, changed };
}

function cleanMedical(rows: MedicalInfoRow[]): { list: MedicalInfoRow[]; changed: boolean } {
  let changed = false;
  const list = rows.map((r) => {
    if (r.isCustom || SEED_MEDICAL_VALUES[r.key] === undefined || r.value !== SEED_MEDICAL_VALUES[r.key]) return r;
    changed = true;
    return { ...r, value: "" };
  });
  return { list, changed };
}

function cleanMilestones(items: MilestoneItem[]): { list: MilestoneItem[]; changed: boolean } {
  const doneKeys = items.filter((m) => m.done).map((m) => m.key).sort();
  const isSeed = doneKeys.length === SEED_DONE_MILESTONES.length && SEED_DONE_MILESTONES.every((k) => doneKeys.includes(k));
  if (!isSeed) return { list: items, changed: false };
  return { list: items.map((m) => (m.done ? { ...m, done: false } : m)), changed: true };
}

/**
 * Kthen pjesën e ndryshuar të gjendjes së bebit, ose null nëse s'kishte gjë
 * për të pastruar. Funksion i pastër: `now` jepet nga jashtë (testet).
 */
export function cleanupSeedBabyData(baby: BabyModuleState, now: string = new Date().toISOString()): Partial<BabyModuleState> | null {
  const patch: Partial<BabyModuleState> = {};

  for (const [key, ids] of Object.entries(SEED_RECORD_IDS) as [keyof BabyModuleState, string[]][]) {
    const list = baby[key] as unknown as WithLifecycle[] | undefined;
    if (!Array.isArray(list)) continue;
    const { list: next, changed } = softDeleteSeeds(list, ids, now);
    if (changed) (patch as Record<string, unknown>)[key] = next;
  }

  const growth = cleanGrowthStats(baby.growthStats ?? []);
  if (growth.changed) patch.growthStats = growth.list;

  if (hasSeedProfileSignature(baby.medicalInfo ?? [])) {
    const medical = cleanMedical(baby.medicalInfo);
    if (medical.changed) patch.medicalInfo = medical.list;
    const milestones = cleanMilestones(baby.milestones ?? []);
    if (milestones.changed) patch.milestones = milestones.list;
  }

  return Object.keys(patch).length ? patch : null;
}
