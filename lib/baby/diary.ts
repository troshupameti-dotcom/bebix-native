import type { IconName } from "@/components/ui/Icon";

/**
 * Ditari: çfarë ndodhi, e grupuar sipas ditës.
 *
 * Lista e rrafshët tregonte datën e plotë në çdo rresht — njëzet herë të
 * njëjtën datë njëra nën tjetrën. Këtu data del një herë, si titull i ditës,
 * dhe rreshti mban vetëm orën. Titulli i ditës mban edhe përmbledhjen, që
 * prindi ta shohë ditën pa e numëruar vetë.
 *
 * Funksione të pastra: asnjë React, asnjë orë muri përveç asaj që jepet.
 */

export type DiaryKind =
  | "event"
  | "feeding"
  | "sleep"
  | "diaper"
  | "growth"
  | "vaccine"
  | "medical";

export type DiaryEntry = {
  id: string;
  kind: DiaryKind;
  title: string;
  /** Detaji i djathtë: sasia, kohëzgjatja, lloji. Bosh kur s'ka. */
  detail: string;
  at: number;
  icon: IconName;
  tint: "olive" | "orange";
  /** Vetëm për gjumin — që përmbledhja e ditës të dijë sa u fjet. */
  minutes?: number;
};

export type DiaryDay = {
  /** "2026-09-20" — çelësi i ditës lokale, jo UTC. */
  key: string;
  /** Mesnata e asaj dite, për etiketën. */
  date: Date;
  entries: DiaryEntry[];
  feedings: number;
  diapers: number;
  sleepMinutes: number;
};

/** "2026-09-20" nga një çast, sipas orës lokale. */
export function dayKeyOf(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Grupon hyrjet në ditë, më e reja lart, dhe numëron çdo ditë.
 *
 * Ditët pa asnjë hyrje nuk shfaqen fare: një ditar me vrima boshe është
 * listë kalendari, jo ditar.
 */
export function groupByDay(entries: DiaryEntry[]): DiaryDay[] {
  const days = new Map<string, DiaryDay>();

  for (const entry of entries) {
    const key = dayKeyOf(entry.at);
    let day = days.get(key);
    if (!day) {
      const d = new Date(entry.at);
      day = {
        key,
        date: new Date(d.getFullYear(), d.getMonth(), d.getDate()),
        entries: [],
        feedings: 0,
        diapers: 0,
        sleepMinutes: 0,
      };
      days.set(key, day);
    }
    day.entries.push(entry);
    if (entry.kind === "feeding") day.feedings++;
    else if (entry.kind === "diaper") day.diapers++;
    else if (entry.kind === "sleep") day.sleepMinutes += entry.minutes ?? 0;
  }

  const out = [...days.values()];
  for (const day of out) day.entries.sort((a, b) => b.at - a.at);
  return out.sort((a, b) => b.date.getTime() - a.date.getTime());
}

/** Ngjarjet që nuk përsëriten çdo ditë: dalin si rreth i veçantë te kalendari. */
export const SPECIAL_KINDS: ReadonlySet<DiaryKind> = new Set<DiaryKind>(["event", "growth", "vaccine", "medical"]);

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * Qelizat e një muaji, java nis të hënën. `null` janë vendet bosh para ditës
 * së parë dhe pas së fundit, që rrjeta të mbetet 7 kolona e drejtë.
 */
export function monthCells(year: number, month: number): (Date | null)[] {
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const lead = (first.getDay() + 6) % 7;
  const cells: (Date | null)[] = Array.from({ length: lead }, () => null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7) cells.push(null);
  return cells;
}

/** E hëna deri të dielën e javës ku bie `anchor`. */
export function weekDays(anchor: Date): Date[] {
  const start = startOfDay(anchor);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
}

export type DayMarks = {
  feeding: boolean;
  sleep: boolean;
  diaper: boolean;
  special: boolean;
  count: number;
};

/** Çfarë u shënua çdo ditë — për pikat e kalendarit, pa i ruajtur hyrjet. */
export function dayMarks(days: DiaryDay[]): Map<string, DayMarks> {
  const marks = new Map<string, DayMarks>();
  for (const day of days) {
    marks.set(day.key, {
      feeding: day.feedings > 0,
      sleep: day.entries.some((e) => e.kind === "sleep"),
      diaper: day.diapers > 0,
      special: day.entries.some((e) => SPECIAL_KINDS.has(e.kind)),
      count: day.entries.length,
    });
  }
  return marks;
}

export type DayLabelKind = { kind: "today" } | { kind: "yesterday" } | { kind: "date"; date: Date };

/** Sot / Dje / data — vendimi, pa e ditur si përkthehet. */
export function dayLabelKind(day: DiaryDay, now: Date = new Date()): DayLabelKind {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.round((today.getTime() - day.date.getTime()) / 86400000);
  if (diffDays === 0) return { kind: "today" };
  if (diffDays === 1) return { kind: "yesterday" };
  return { kind: "date", date: day.date };
}
