/**
 * Mosha në dyqan. Çdo produkt mund të ketë "mosha nga/deri (muaj)" nga paneli; një produkt
 * pa kufij është i përshtatshëm për të gjitha moshat. Filtri punon me grupmosha: produkti
 * shfaqet kur intervali i tij mbivendoset me grupin.
 */
export type AgeBand = { key: string; from: number; to: number };

export const AGE_BANDS: AgeBand[] = [
  { key: "0-3", from: 0, to: 3 },
  { key: "3-6", from: 3, to: 6 },
  { key: "6-12", from: 6, to: 12 },
  { key: "12-24", from: 12, to: 24 },
  { key: "24-48", from: 24, to: 48 },
];

type Lang = "sq" | "en";

export function parseAgeBand(key: string | null | undefined): AgeBand | null {
  return AGE_BANDS.find((b) => b.key === key) ?? null;
}

/** Grupmosha që përmban moshën (në muaj), ose null kur është mbi 4 vjeç ose e pavlefshme. */
export function bandForMonths(months: number | null): AgeBand | null {
  if (months == null || !Number.isFinite(months) || months < 0) return null;
  return AGE_BANDS.find((b) => months >= b.from && months < b.to) ?? null;
}

/** Muaj të plotë nga data e lindjes deri tani; null kur data mungon, është e pavlefshme ose në të ardhmen. */
export function monthsSince(dob: string | null | undefined, now: Date = new Date()): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime()) || d.getTime() > now.getTime()) return null;
  let months = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
  if (now.getDate() < d.getDate()) months -= 1;
  return Math.max(0, months);
}

const UNIT: Record<Lang, { m: string; y: string }> = {
  sq: { m: "muaj", y: "vjeç" },
  en: { m: "mo", y: "yrs" },
};

function part(months: number): { n: number; u: "m" | "y" } {
  return months >= 24 && months % 12 === 0 ? { n: months / 12, u: "y" } : { n: months, u: "m" };
}

/** "0–6 muaj", "6+ muaj", "Deri në 12 muaj", "2–4 vjeç"; null kur s'ka kufij. */
export function formatAgeRange(min: number | null | undefined, max: number | null | undefined, lang: Lang): string | null {
  if (min == null && max == null) return null;
  const u = UNIT[lang] ?? UNIT.sq;
  if (min == null) {
    const b = part(max as number);
    return `${lang === "en" ? "Up to" : "Deri në"} ${b.n} ${u[b.u]}`;
  }
  const a = part(min);
  if (max == null) return `${a.n}+ ${u[a.u]}`;
  const b = part(max);
  return a.u === b.u ? `${a.n}–${b.n} ${u[b.u]}` : `${a.n} ${u[a.u]}–${b.n} ${u[b.u]}`;
}

/** Kushti PostgREST (`or`) për mbivendosjen e intervalit të produktit me grupin. */
export function ageOverlapFilter(band: AgeBand): string {
  const minOk = `min_age_months.lte.${band.to}`;
  const maxOk = `max_age_months.gte.${band.from}`;
  return [
    "and(min_age_months.is.null,max_age_months.is.null)",
    `and(min_age_months.is.null,${maxOk})`,
    `and(${minOk},max_age_months.is.null)`,
    `and(${minOk},${maxOk})`,
  ].join(",");
}
