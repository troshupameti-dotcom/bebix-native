/**
 * Motori i moshës: i vetmi vend ku llogaritet mosha dhe faza e fëmijës aktiv.
 * Gjithçka tjetër (kreu, dyqani, komuniteti, njoftimet) pyet këtu, që një
 * fëmijë të mos dalë "foshnjë" në një ekran dhe "fëmijë" në një tjetër.
 *
 * Faza (mosha në muaj të plotë):
 *   pregnancy  ka datë të pritur të lindjes, pa datëlindje
 *   infant     0–11
 *   toddler    12–35
 *   child      36–155 (3–12 vjeç)
 *   archive    156+ (13+): mbetet si arkiv, pa feed dhe pa rekomandime
 */
export type Stage = "pregnancy" | "infant" | "toddler" | "child" | "archive";

export type ChildAgeInput = {
  /** "YYYY-MM-DD" (nga serveri) ose ISO e plotë (profili në telefon). */
  birthDate: string | null | undefined;
  dueDate?: string | null;
};

/** Data si datë LOKALE: "2025-09-20" mbetet 20 shtator edhe në UTC−; ISO e plotë lexohet si është. */
export function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const ymd = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const d = ymd ? new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3])) : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Muaj të plotë nga lindja (lindur më 10 → muaji mbushet më 10 të muajit tjetër). null pa datë ose në të ardhmen. */
export function ageInMonths(birthDate: string | null | undefined, now: Date = new Date()): number | null {
  const dob = parseDate(birthDate);
  if (!dob || dob.getTime() > now.getTime()) return null;
  let m = (now.getFullYear() - dob.getFullYear()) * 12 + (now.getMonth() - dob.getMonth());
  if (now.getDate() < dob.getDate()) m -= 1;
  return Math.max(0, m);
}

/** Faza e fëmijës; null kur s'ka asnjë datë të vlefshme (kreu neutral, dyqani i plotë). */
export function getStage(child: ChildAgeInput | null | undefined, now: Date = new Date()): Stage | null {
  if (!child) return null;
  const months = ageInMonths(child.birthDate, now);
  if (months == null) {
    // Datëlindja në të ardhmen është gabim shtypi, jo shtatzëni.
    return !child.birthDate && parseDate(child.dueDate) ? "pregnancy" : null;
  }
  if (months < 12) return "infant";
  if (months < 36) return "toddler";
  if (months < 156) return "child";
  return "archive";
}

/**
 * Grupmosha e komunitetit, në formatin e `community_groups.auto_key` (muaj):
 * [0,3) [3,6) [6,12) [12,24) [24,36) [36,72) [72,120) [120,156). Shtatzënia ka
 * grupin e vet; arkivi (13+) s'ka grup.
 */
const AGE_GROUPS: [number, number][] = [
  [0, 3],
  [3, 6],
  [6, 12],
  [12, 24],
  [24, 36],
  [36, 72],
  [72, 120],
  [120, 156],
];

export const PREGNANCY_GROUP_KEY = "pregnancy";

export function getAgeGroupKey(child: ChildAgeInput | null | undefined, now: Date = new Date()): string | null {
  const stage = getStage(child, now);
  if (stage === "pregnancy") return PREGNANCY_GROUP_KEY;
  if (stage == null || stage === "archive") return null;
  const months = ageInMonths(child?.birthDate, now) as number;
  const group = AGE_GROUPS.find(([from, to]) => months >= from && months < to);
  return group ? `age:${group[0]}-${group[1]}` : null;
}

/**
 * Shtatzënia nga data e pritur e lindjes (280 ditë): java aktuale (1–42) dhe ditët deri në lindje (0 kur data kaloi).
 * null pa datë.
 */
export function pregnancyProgress(dueDate: string | null | undefined, now: Date = new Date()): { week: number; daysLeft: number } | null {
  const due = parseDate(dueDate);
  if (!due) return null;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  const daysLeft = Math.round((target.getTime() - today.getTime()) / 86_400_000);
  // Dita e shtatzënisë 1–7 = java 1, … dita 280 (data e pritur) = java 40; pas datës deri në 42.
  const week = Math.min(42, Math.max(1, Math.floor((280 - daysLeft - 1) / 7) + 1));
  return { week, daysLeft: Math.max(0, daysLeft) };
}
