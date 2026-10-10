import type { DiaperEntry, FeedingEntry, SleepEntry } from "@/lib/state/babyTypes";

/**
 * Përmbledhja e së hënës: java e kaluar (e hënë–e diel) krahasuar me
 * javën para saj. Vetëm lajmet e mira dalin si "trend" (gjumi i natës më i
 * gjatë, copa më e gjatë e gjumit); çdo gjë tjetër jepet neutrale, pa
 * "më pak" dhe pa faj. Asnjë krahasim me bebe të tjera.
 */

const MIN = 60_000;

export type WeekStats = {
  /** Ditët me të paktën një shënim. */
  days: number;
  feedingsPerDay: number;
  diapersPerDay: number;
  /** Mesatarja e gjumit të natës për natë me shënim (minuta). */
  nightSleepMin: number | null;
  /** Mesatarja e gjithë gjumit në ditë (minuta). */
  sleepPerDayMin: number | null;
  /** Copa më e gjatë e gjumit gjatë javës (minuta). */
  longestSleepMin: number | null;
};

export type RecapHighlight =
  | { kind: "night_sleep_up"; deltaMin: number }
  | { kind: "total_sleep_up"; deltaMin: number }
  | { kind: "longest_sleep_up"; minutes: number };

export type WeeklyRecap = {
  /** "2026-10-05" — e hëna e javës që përmblidhet; çelësi për "e mbylla kartën". */
  weekKey: string;
  weekStart: string;
  stats: WeekStats;
  previous: WeekStats | null;
  highlights: RecapHighlight[];
};

/** Sa minuta duhet ndryshimi që të quhet trend (më pak = zhurmë e shënimeve). */
export const TREND_MIN = 15;

const visible = <T extends { deletedAt: string | null; archivedAt: string | null }>(list: T[]) =>
  list.filter((e) => !e.deletedAt && !e.archivedAt);

/** E hëna 00:00 e javës ku bie `d` (ora lokale). */
export function mondayOf(d: Date): Date {
  const day = (d.getDay() + 6) % 7; // e hëna = 0
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - day);
}

const pad = (n: number) => String(n).padStart(2, "0");
const dateKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

export function weekStats(
  logs: { feedingLog: FeedingEntry[]; sleepLog: SleepEntry[]; diaperLog: DiaperEntry[] },
  weekStart: Date
): WeekStats {
  const from = weekStart.getTime();
  const to = addDays(weekStart, 7).getTime();
  const inWeek = (iso: string | null) => {
    const t = iso ? new Date(iso).getTime() : NaN;
    return !Number.isNaN(t) && t >= from && t < to;
  };
  const dayOf = (iso: string) => dateKey(new Date(iso));

  const feedings = visible(logs.feedingLog).filter((f) => f.type !== "medicine" && inWeek(f.at));
  const diapers = visible(logs.diaperLog).filter((d) => inWeek(d.at));
  const sleeps = visible(logs.sleepLog).filter((s) => s.endAt && inWeek(s.startAt));

  const days = new Set([...feedings.map((f) => dayOf(f.at)), ...diapers.map((d) => dayOf(d.at)), ...sleeps.map((s) => dayOf(s.startAt))]);
  const n = Math.max(1, days.size);

  const minutes = (s: SleepEntry) => Math.max(0, (new Date(s.endAt!).getTime() - new Date(s.startAt).getTime()) / MIN - (s.pausedIntervalsMin ?? 0));

  // Nata i përket datës kur nisi (gjumi i 23:00 dhe i 02:00 janë e njëjta natë
  // vetëm nëse nisin në të njëjtën datë — mjafton për një mesatare javore).
  const nightByDate = new Map<string, number>();
  for (const s of sleeps.filter((x) => !x.isNap)) {
    const start = new Date(s.startAt);
    // Gjumi që nis pas mesnate (para 07:00) i përket natës së mbrëmshme.
    const key = start.getHours() < 7 ? dateKey(addDays(start, -1)) : dateKey(start);
    nightByDate.set(key, (nightByDate.get(key) ?? 0) + minutes(s));
  }
  const nights = [...nightByDate.values()];
  const totalSleep = sleeps.reduce((sum, s) => sum + minutes(s), 0);
  const sleepDays = new Set(sleeps.map((s) => dayOf(s.startAt))).size;

  return {
    days: days.size,
    feedingsPerDay: Math.round((feedings.length / n) * 10) / 10,
    diapersPerDay: Math.round((diapers.length / n) * 10) / 10,
    nightSleepMin: nights.length ? Math.round(nights.reduce((a, b) => a + b, 0) / nights.length) : null,
    sleepPerDayMin: sleepDays ? Math.round(totalSleep / sleepDays) : null,
    longestSleepMin: sleeps.length ? Math.round(Math.max(...sleeps.map(minutes))) : null,
  };
}

/**
 * Përmbledhja për javën që sapo mbaroi. `null` kur java s'ka të paktën 3 ditë
 * me shënime — një përmbledhje nga një ditë e vetme do të ishte e rreme.
 */
export function buildWeeklyRecap(
  logs: { feedingLog: FeedingEntry[]; sleepLog: SleepEntry[]; diaperLog: DiaperEntry[] },
  now: Date = new Date()
): WeeklyRecap | null {
  const weekStart = addDays(mondayOf(now), -7);
  const stats = weekStats(logs, weekStart);
  if (stats.days < 3) return null;
  const prevStats = weekStats(logs, addDays(weekStart, -7));
  const previous = prevStats.days >= 3 ? prevStats : null;

  const highlights: RecapHighlight[] = [];
  if (previous) {
    if (stats.nightSleepMin !== null && previous.nightSleepMin !== null && stats.nightSleepMin - previous.nightSleepMin >= TREND_MIN) {
      highlights.push({ kind: "night_sleep_up", deltaMin: stats.nightSleepMin - previous.nightSleepMin });
    } else if (stats.sleepPerDayMin !== null && previous.sleepPerDayMin !== null && stats.sleepPerDayMin - previous.sleepPerDayMin >= TREND_MIN) {
      highlights.push({ kind: "total_sleep_up", deltaMin: stats.sleepPerDayMin - previous.sleepPerDayMin });
    }
    if (stats.longestSleepMin !== null && previous.longestSleepMin !== null && stats.longestSleepMin - previous.longestSleepMin >= TREND_MIN) {
      highlights.push({ kind: "longest_sleep_up", minutes: stats.longestSleepMin });
    }
  }
  return { weekKey: dateKey(weekStart), weekStart: weekStart.toISOString(), stats, previous, highlights };
}

/** Karta shfaqet e hënë–e mërkurë, derisa prindi ta mbyllë. */
export function showRecapCard(now: Date, dismissedWeekKey: string | null, recap: WeeklyRecap | null): boolean {
  if (!recap) return false;
  const weekday = (now.getDay() + 6) % 7;
  return weekday <= 2 && dismissedWeekKey !== recap.weekKey;
}
