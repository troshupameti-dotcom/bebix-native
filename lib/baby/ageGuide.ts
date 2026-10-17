import type { VaccineEntry } from "@/lib/state/babyTypes";

/**
 * Përmbajtja e kreut sipas moshës: çfarë pritet në këtë fazë (zhvillimi, ushqimi, gjumi) dhe vaksina e radhës.
 * Tekstet janë udhëzime të përgjithshme (OBSH, AAP), jo këshillë mjekësore; ndryshojnë sipas muajve të bebit.
 */
export type AgeStage = "m0" | "m1" | "m3" | "m6" | "m9" | "m12" | "m18" | "m24";

/** Fillimi i çdo faze në muaj, nga më e reja. */
const STAGES: [AgeStage, number][] = [
  ["m0", 0],
  ["m1", 1],
  ["m3", 3],
  ["m6", 6],
  ["m9", 9],
  ["m12", 12],
  ["m18", 18],
  ["m24", 24],
];

/** Muaj të plotë nga lindja (data e lindjes 10 → muaji mbushet më 10 të muajit tjetër). null kur s'ka datë ose është në të ardhmen. */
export function fullMonths(dobIso: string | null, now: Date = new Date()): number | null {
  if (!dobIso) return null;
  const dob = new Date(dobIso);
  if (Number.isNaN(dob.getTime()) || dob.getTime() > now.getTime()) return null;
  let m = (now.getFullYear() - dob.getFullYear()) * 12 + (now.getMonth() - dob.getMonth());
  if (now.getDate() < dob.getDate()) m -= 1;
  return Math.max(0, m);
}

/** Faza e moshës; pas 5 vjetësh karta s'shfaqet më (null). */
export function ageStage(months: number | null): AgeStage | null {
  if (months == null || months >= 60) return null;
  let stage: AgeStage = "m0";
  for (const [key, from] of STAGES) if (months >= from) stage = key;
  return stage;
}

/** Vaksina e radhës që s'është bërë: e vonuara para të ardhshmeve, pastaj sipas datës. */
export function nextVaccine(vaccines: VaccineEntry[], now: Date = new Date()): VaccineEntry | null {
  const open = vaccines.filter((v) => !v.givenDate && !v.deletedAt && !v.archivedAt && !Number.isNaN(new Date(v.dueDate).getTime()));
  open.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  return open[0] ?? null;
}

/** A ka kaluar data e vaksinës (dita e sotme s'llogaritet vonesë). */
export function isOverdue(v: VaccineEntry, now: Date = new Date()): boolean {
  const due = new Date(v.dueDate);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return due.getTime() < startOfToday;
}
