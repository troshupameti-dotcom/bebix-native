import type { FeedingEntry, SleepEntry, DiaperEntry } from "@/lib/state/babyTypes";

/**
 * Ritmi i ditës: çfarë ka ndodhur në 24 orët e fundit dhe ku është bebi tani.
 *
 * Funksione të pastra, pa React dhe pa varësi nga gjendja — që pamja
 * kryesore e app-it të mund të testohet pa hapur app-in.
 *
 * "Tani" nuk llogaritet nga ora e murit por nga një `now` i dhënë, që
 * testet të mos varen nga koha kur xhirojnë.
 */

export const DAY_MS = 86400000;

export type RhythmKind = "sleep" | "feeding" | "diaper";

/** Një bllok gjumi i vendosur në shiritin 24-orësh, si pjesë 0–1. */
export type RhythmBlock = {
  start: number;
  end: number;
};

/** Një ngjarje e çastit (ushqyerje ose pelenë), si pikë 0–1. */
export type RhythmMark = {
  at: number;
  kind: "feeding" | "diaper";
};

export type DayRhythm = {
  sleepBlocks: RhythmBlock[];
  marks: RhythmMark[];
  /** Ora e fillimit të dritares, për etiketat. */
  windowStart: Date;
};

export type TodayTotals = {
  feedings: number;
  diapers: number;
  sleepMinutes: number;
};

export type LiveStatus = {
  /** Po fle tani? `since` është kur nisi gjumi. */
  asleepSince: string | null;
  /** Kur mbaroi gjumi i fundit — pra prej sa kohësh është zgjuar. */
  awakeSince: string | null;
  lastFeedingAt: string | null;
  lastDiaperAt: string | null;
};

function time(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? null : t;
}

/** Pozicioni i një çasti brenda dritares, i kufizuar në 0–1. */
function position(at: number, windowStart: number, windowEnd: number): number {
  const span = windowEnd - windowStart;
  if (span <= 0) return 0;
  return Math.min(1, Math.max(0, (at - windowStart) / span));
}

export function buildDayRhythm(
  feedings: FeedingEntry[],
  sleeps: SleepEntry[],
  diapers: DiaperEntry[],
  now: Date = new Date()
): DayRhythm {
  const end = now.getTime();
  const start = end - DAY_MS;

  const sleepBlocks: RhythmBlock[] = [];
  for (const sleep of sleeps) {
    const from = time(sleep.startAt);
    if (from === null) continue;
    // Gjumi që vazhdon shtrihet deri tani.
    const to = time(sleep.endAt) ?? end;
    if (to <= start || from >= end) continue;

    sleepBlocks.push({
      start: position(Math.max(from, start), start, end),
      end: position(Math.min(to, end), start, end),
    });
  }

  const marks: RhythmMark[] = [];
  for (const feeding of feedings) {
    const at = time(feeding.at);
    if (at === null || at < start || at > end) continue;
    marks.push({ at: position(at, start, end), kind: "feeding" });
  }
  for (const diaper of diapers) {
    const at = time(diaper.at);
    if (at === null || at < start || at > end) continue;
    marks.push({ at: position(at, start, end), kind: "diaper" });
  }

  return {
    sleepBlocks: sleepBlocks.sort((a, b) => a.start - b.start),
    marks: marks.sort((a, b) => a.at - b.at),
    windowStart: new Date(start),
  };
}

/** Sa ka ndodhur sot — nga mesnata, jo 24 orët e fundit. */
export function todayTotals(
  feedings: FeedingEntry[],
  sleeps: SleepEntry[],
  diapers: DiaperEntry[],
  now: Date = new Date()
): TodayTotals {
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const end = now.getTime();

  const feedingCount = feedings.filter((f) => (time(f.at) ?? 0) >= midnight).length;
  const diaperCount = diapers.filter((d) => (time(d.at) ?? 0) >= midnight).length;

  let sleepMs = 0;
  for (const sleep of sleeps) {
    const from = time(sleep.startAt);
    if (from === null) continue;
    const to = time(sleep.endAt) ?? end;
    // Gjumi që kapërcen mesnatën numërohet vetëm për pjesën e sotme.
    const overlap = Math.min(to, end) - Math.max(from, midnight);
    if (overlap > 0) sleepMs += overlap;
  }

  return {
    feedings: feedingCount,
    diapers: diaperCount,
    sleepMinutes: Math.round(sleepMs / 60000),
  };
}

export function liveStatus(
  feedings: FeedingEntry[],
  sleeps: SleepEntry[],
  diapers: DiaperEntry[]
): LiveStatus {
  const sortedSleeps = [...sleeps].sort((a, b) => (time(b.startAt) ?? 0) - (time(a.startAt) ?? 0));
  const ongoing = sortedSleeps.find((s) => !s.endAt);
  const lastFinished = sortedSleeps.find((s) => s.endAt);

  const lastFeeding = [...feedings].sort((a, b) => (time(b.at) ?? 0) - (time(a.at) ?? 0))[0];
  const lastDiaper = [...diapers].sort((a, b) => (time(b.at) ?? 0) - (time(a.at) ?? 0))[0];

  return {
    asleepSince: ongoing?.startAt ?? null,
    awakeSince: ongoing ? null : lastFinished?.endAt ?? null,
    lastFeedingAt: lastFeeding?.at ?? null,
    lastDiaperAt: lastDiaper?.at ?? null,
  };
}

/** "2 orë 15 min" ose "45 min" — pa sekonda, sepse askush nuk i lexon. */
export function durationLabel(minutes: number): string {
  if (minutes < 1) return "tani";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} orë` : `${hours} orë ${rest} min`;
}

/** Sa kohë ka kaluar nga një çast, si tekst i shkurtër. */
export function sinceLabel(iso: string | null, now: Date = new Date()): string | null {
  const at = time(iso);
  if (at === null) return null;
  return durationLabel(Math.max(0, Math.round((now.getTime() - at) / 60000)));
}
