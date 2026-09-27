import { cleanupSeedBabyData } from "@/lib/state/seedCleanup";
import { initialBabyState, type BabyModuleState } from "@/lib/state/babyTypes";

const NOW = "2026-09-28T10:00:00.000Z";
const life = (editCount = 0) => ({
  createdAt: "2026-05-01T08:00:00.000Z",
  updatedAt: "2026-05-01T08:00:00.000Z",
  editCount,
  deletedAt: null,
  archivedAt: null,
});

/** Gjendja që kishte një instalim i vjetër: shënimet dhe profili demo. */
function oldInstall(): BabyModuleState {
  return {
    ...initialBabyState,
    growthStats: [
      { key: "weight", labelKey: "growth_weight", value: "7.8 kg", subKey: "pct_50", isCustom: false },
      { key: "height", labelKey: "growth_height", value: "66 cm", subKey: "pct_45", isCustom: false },
    ],
    medicalInfo: [
      { key: "blood", labelKey: "baby_blood_type", value: "0+", isCustom: false },
      { key: "doctor", labelKey: "baby_doctor", value: "Dr. Arta Elezi", isCustom: false },
      { key: "birth_weight", labelKey: "info_birth_weight", value: "3.4 kg", isCustom: false },
      { key: "rh", labelKey: "info_rh", value: "Rh+", isCustom: false },
    ],
    milestones: [
      { key: "smile", labelKey: "ms_smile", done: true, isCustom: false },
      { key: "rolling", labelKey: "ms_rolling", done: true, isCustom: false },
      { key: "sitting", labelKey: "ms_sitting", done: false, isCustom: false },
    ],
    feedingLog: [
      { id: "f1", type: "bottle", amountMl: 120, durationMin: null, side: null, foodCategory: null, at: NOW, note: "", ...life() },
      { id: "real-1", type: "breast", amountMl: null, durationMin: 10, side: "left", foodCategory: null, at: NOW, note: "", ...life() },
    ],
    vaccines: [
      { id: "v1", name: "Hepatit B", description: "", dueDate: NOW, givenDate: NOW, doctor: "Dr. Arta Elezi", clinic: "", batchNumber: "", note: "", reminderEnabled: true, ...life(2) },
    ],
  };
}

describe("heqja e të dhënave demo", () => {
  it("fshin butë shënimet demo të pa prekura, që fshirja të arrijë te serveri", () => {
    const patch = cleanupSeedBabyData(oldInstall(), NOW)!;
    const f1 = patch.feedingLog!.find((f) => f.id === "f1")!;
    expect(f1.deletedAt).toBe(NOW);
    expect(f1.updatedAt).toBe(NOW);
    expect(f1.editCount).toBe(1);
  });

  it("nuk prek shënimet e prindit, as demo-t që prindi i ka ndryshuar", () => {
    const patch = cleanupSeedBabyData(oldInstall(), NOW)!;
    expect(patch.feedingLog!.find((f) => f.id === "real-1")!.deletedAt).toBeNull();
    // v1 u ndryshua nga prindi (editCount 2): mbetet.
    expect(patch.vaccines).toBeUndefined();
  });

  it("pastron grupin e gjakut, mjekun dhe peshën demo, dhe përqindjet e sajuara", () => {
    const patch = cleanupSeedBabyData(oldInstall(), NOW)!;
    expect(patch.medicalInfo!.every((r) => r.value === "")).toBe(true);
    expect(patch.growthStats!.every((g) => g.value === "" && g.subKey === undefined)).toBe(true);
    expect(patch.milestones!.every((m) => !m.done)).toBe(true);
  });

  it("një profil i plotësuar nga prindi mbetet i paprekur", () => {
    const mine: BabyModuleState = {
      ...initialBabyState,
      medicalInfo: [
        { key: "blood", labelKey: "baby_blood_type", value: "0+", isCustom: false },
        { key: "doctor", labelKey: "baby_doctor", value: "Dr. Blerta Hoxha", isCustom: false },
        { key: "birth_weight", labelKey: "info_birth_weight", value: "3.1 kg", isCustom: false },
        { key: "rh", labelKey: "info_rh", value: "Rh-", isCustom: false },
      ],
      milestones: [
        { key: "smile", labelKey: "ms_smile", done: true, isCustom: false },
        { key: "rolling", labelKey: "ms_rolling", done: true, isCustom: false },
      ],
    };
    const patch = cleanupSeedBabyData(mine, NOW);
    expect(patch?.medicalInfo).toBeUndefined();
    expect(patch?.milestones).toBeUndefined();
  });

  it("një instalim i ri s'ka asgjë për të pastruar", () => {
    expect(cleanupSeedBabyData(initialBabyState, NOW)).toBeNull();
  });
});
