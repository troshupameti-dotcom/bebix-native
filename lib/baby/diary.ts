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

export type DayLabelKind = { kind: "today" } | { kind: "yesterday" } | { kind: "date"; date: Date };

/** Sot / Dje / data — vendimi, pa e ditur si përkthehet. */
export function dayLabelKind(day: DiaryDay, now: Date = new Date()): DayLabelKind {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.round((today.getTime() - day.date.getTime()) / 86400000);
  if (diffDays === 0) return { kind: "today" };
  if (diffDays === 1) return { kind: "yesterday" };
  return { kind: "date", date: day.date };
}
