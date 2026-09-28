import { medicalCatalog, type MedicalInfoRow } from "@/lib/state/babyTypes";
import type { BloodType } from "@/lib/state/types";

/** Fushat e cilësimeve që kanë një rresht të vetin te "Info mjekësore". */
export type ProfileMedical = {
  bloodType: BloodType;
  pediatrician: string;
  allergies: string;
};

/** Rreshti i "Info mjekësore" për secilën fushë të cilësimeve. */
export const MEDICAL_ROW_FOR = { bloodType: "blood", pediatrician: "doctor", allergies: "allergies" } as const;

/**
 * Kopjon grupin e gjakut, pediatrin dhe alergjitë nga cilësimet te rreshtat e
 * "Info mjekësore" në faqen kryesore. Një rresht me vlerë shfaqet vetë (nëse
 * prindi s'e kishte shtuar); një vlerë bosh s'e fshin rreshtin.
 *
 * Më parë ishin dy vende të ndara: prindi shkruante mjekun te cilësimet dhe
 * faqja kryesore tregonte ende rreshtin bosh.
 */
export function applyProfileToMedical(
  medicalInfo: MedicalInfoRow[],
  activeKeys: string[],
  profile: ProfileMedical
): { medicalInfo: MedicalInfoRow[]; medicalActiveKeys: string[] } {
  let info = [...medicalInfo];
  let active = [...activeKeys];

  (Object.keys(MEDICAL_ROW_FOR) as (keyof ProfileMedical)[]).forEach((field) => {
    const key = MEDICAL_ROW_FOR[field];
    const value = (profile[field] ?? "").trim();
    const existing = info.find((m) => m.key === key);
    if (existing) {
      if (existing.value !== value) info = info.map((m) => (m.key === key ? { ...m, value } : m));
    } else {
      const preset = medicalCatalog.find((m) => m.key === key);
      if (preset) info = [...info, { ...preset, value }];
    }
    if (value && !active.includes(key)) active = [...active, key];
  });

  return { medicalInfo: info, medicalActiveKeys: active };
}

/** Grupi i gjakut nga teksti i lirë i rreshtit ("a+" → "A+"); null nëse s'njihet. */
export function parseBloodType(text: string): BloodType | undefined {
  const v = text.trim().toUpperCase().replace("O", "0");
  if (!v) return null;
  return /^(0|A|B|AB)[+-]$/.test(v) ? (v as BloodType) : undefined;
}
