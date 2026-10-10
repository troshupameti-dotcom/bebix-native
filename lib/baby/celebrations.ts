import type { Moment } from "@/lib/state/babyTypes";

/**
 * Festimet automatike: dita e 100-të, çdo muaj (deri në 2 vjeç), gjysmë
 * viti, ditëlindjet, dhe çdo arritje e re (moment i llojit "milestone").
 *
 * Secila del një herë (id e qëndrueshme), brenda 3 ditëve pas datës — që
 * prindi që s'e hap app-in pikërisht atë ditë ta shohë prapë. Pa faj: asnjë
 * "e humbe", thjesht s'del më pas dritares.
 */

export type Celebration =
  | { id: string; kind: "day100"; date: string }
  | { id: string; kind: "month"; months: number; date: string }
  | { id: string; kind: "half"; date: string }
  | { id: string; kind: "year"; years: number; date: string }
  | { id: string; kind: "milestone"; momentId: string; title: string; date: string };

export const SHOW_DAYS = 3;
const DAY = 86_400_000;

/** Data + n muaj, me ditën e kufizuar në fund të muajit (31 janar + 1 = 28/29 shkurt). */
export function addMonths(d: Date, n: number): Date {
  const target = new Date(d.getFullYear(), d.getMonth() + n, 1);
  const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  return new Date(target.getFullYear(), target.getMonth(), Math.min(d.getDate(), last));
}

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

function inWindow(date: Date, now: Date): boolean {
  const from = startOfDay(date).getTime();
  const t = startOfDay(now).getTime();
  return t >= from && t < from + SHOW_DAYS * DAY;
}

/** Ditëlindja e bebit si datë lokale (pa zhvendosje nga zona kohore). */
function birthDate(dob: string | null): Date | null {
  if (!dob) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dob);
  const d = m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(dob);
  return Number.isNaN(d.getTime()) ? null : startOfDay(d);
}

/** Festimet e moshës që bien në dritaren e sotme. */
export function ageCelebrations(dob: string | null, now: Date): Celebration[] {
  const born = birthDate(dob);
  if (!born || born > now) return [];
  const out: Celebration[] = [];

  const day100 = new Date(born.getFullYear(), born.getMonth(), born.getDate() + 100);
  if (inWindow(day100, now)) out.push({ id: "age:d100", kind: "day100", date: day100.toISOString() });

  const months = (now.getFullYear() - born.getFullYear()) * 12 + now.getMonth() - born.getMonth();
  // Muaji aktual dhe ai para tij (dritarja mund të kalojë në muajin tjetër).
  for (const n of [months, months - 1]) {
    if (n < 1) continue;
    const date = addMonths(born, n);
    if (!inWindow(date, now)) continue;
    if (n % 12 === 0) out.push({ id: `age:y${n / 12}`, kind: "year", years: n / 12, date: date.toISOString() });
    else if (n === 6) out.push({ id: "age:half", kind: "half", date: date.toISOString() });
    else if (n < 24) out.push({ id: `age:m${n}`, kind: "month", months: n, date: date.toISOString() });
  }
  return out;
}

/**
 * Arritjet e reja: momente "milestone" të shtuara në 3 ditët e fundit (nga
 * cilido prind i familjes), me datë jo më të vjetër se 60 ditë — që
 * importimi i arritjeve të vjetra të mos shpërthejë në festime.
 */
export function milestoneCelebrations(moments: Moment[], now: Date): Celebration[] {
  return moments
    .filter((m) => m.type === "milestone" && !m.deletedAt && !m.archivedAt)
    .filter((m) => {
      const created = new Date(m.createdAt).getTime();
      const date = new Date(m.date).getTime();
      return (
        !Number.isNaN(created) &&
        now.getTime() - created < SHOW_DAYS * DAY &&
        created <= now.getTime() + 60_000 &&
        !Number.isNaN(date) &&
        now.getTime() - date < 60 * DAY
      );
    })
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .map((m) => ({ id: `ms:${m.id}`, kind: "milestone" as const, momentId: m.id, title: m.title, date: m.date }));
}

/** Festimi që duhet treguar tani (një në një kohë), ose null. Mosha para arritjeve. */
export function nextCelebration(dob: string | null, moments: Moment[], seen: ReadonlySet<string>, now: Date = new Date()): Celebration | null {
  return [...ageCelebrations(dob, now), ...milestoneCelebrations(moments, now)].find((c) => !seen.has(c.id)) ?? null;
}
