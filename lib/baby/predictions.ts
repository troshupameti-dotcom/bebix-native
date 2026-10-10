import type { DiaperEntry, FeedingEntry, SleepEntry } from "@/lib/state/babyTypes";
import { isNightSleep } from "@/lib/baby/sleepKind";

/**
 * "Si e di?!" — parashikime të vogla nga ritmi i vetë bebit (7–14 ditët e
 * fundit), jo nga mesatare të huaja. Udhëzim, jo këshillë mjekësore: çdo
 * parashikim ka besueshmërinë e vet, dhe pa të dhëna të mjaftueshme s'jepet
 * fare (UI tregon "edhe disa ditë të dhëna").
 *
 * Funksione të pastra me `now` të dhënë, si dayStats.ts.
 */

const MIN = 60_000;
const DAY = 86_400_000;

export type Confidence = "high" | "medium";

export type PredictedWindow = {
  /** Mesi i dritares (ISO). */
  at: string;
  /** ± sa minuta, i rrumbullakosur në 5. */
  plusMinusMin: number;
  confidence: Confidence;
  /** "own" = nga të dhënat e bebit; "age" = nga tabela e moshës (kur s'ka mjaft të dhëna). */
  basis: "own" | "age";
  /** Dritarja ka kaluar ose po kalon tani. */
  due: boolean;
  /** Sa mostra e mbështetin (për testet dhe për "bazuar në N ushqyerje"). */
  samples: number;
};

export type Predictions = {
  nextFeeding: PredictedWindow | null;
  /** Po fle → kur zgjohet zakonisht. */
  nextWake: PredictedWindow | null;
  /** Zgjuar → kur vjen zakonisht gjumi tjetër. */
  nextSleep: PredictedWindow | null;
  /** Dritarja tipike e zgjimit për moshën (minuta). */
  ageWakeWindow: { minMin: number; maxMin: number } | null;
  /** Ende s'ka mjaft ditë me shënime për ushqimin / gjumin. */
  needsMoreData: { feeding: boolean; sleep: boolean };
};

type Logs = {
  feedingLog: FeedingEntry[];
  sleepLog: SleepEntry[];
  diaperLog: DiaperEntry[];
};

export const LOOKBACK_DAYS = 14;
/** Ushqyerjet më afër se kaq janë e njëjta seancë (p.sh. gji majtas, pastaj djathtas). */
export const SAME_SESSION_MIN = 20;
const MIN_FEED_INTERVALS = 8;
const MIN_SLEEP_SAMPLES = 4;
const MIN_DAYS = 2;

const visible = <T extends { deletedAt: string | null; archivedAt: string | null }>(list: T[]) =>
  list.filter((e) => !e.deletedAt && !e.archivedAt);

const ms = (iso: string | null | undefined) => {
  if (!iso) return NaN;
  return new Date(iso).getTime();
};

function quantile(sorted: number[], q: number): number {
  if (!sorted.length) return NaN;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

const round5 = (n: number) => Math.max(5, Math.round(n / 5) * 5);

/** Mediana dhe gjysma e gjerësisë mes kuartileve — e qëndrueshme ndaj një dite të çuditshme. */
function summarize(values: number[]): { median: number; spread: number } {
  const sorted = [...values].sort((a, b) => a - b);
  return { median: quantile(sorted, 0.5), spread: (quantile(sorted, 0.75) - quantile(sorted, 0.25)) / 2 };
}

function distinctDays(times: number[]): number {
  return new Set(times.map((t) => new Date(t).toDateString())).size;
}

function makeWindow(atMs: number, spreadMin: number, samples: number, basis: "own" | "age", now: Date, minSpread = 10, maxSpread = 45): PredictedWindow {
  const plusMinus = round5(Math.min(maxSpread, Math.max(minSpread, spreadMin)));
  return {
    at: new Date(atMs).toISOString(),
    plusMinusMin: plusMinus,
    confidence: basis === "own" && samples >= 15 && plusMinus <= 25 ? "high" : "medium",
    basis,
    due: atMs - plusMinus * MIN <= now.getTime(),
    samples,
  };
}

/**
 * Ushqyerja tjetër: intervali tipik mes ushqyerjeve (pa ilaçe dhe ujë),
 * veçmas për natën dhe ditën kur ka mjaft mostra, sepse natën bebet hanë më rrallë.
 */
export function predictNextFeeding(feedingLog: FeedingEntry[], now: Date): PredictedWindow | null {
  const from = now.getTime() - LOOKBACK_DAYS * DAY;
  const times = visible(feedingLog)
    .filter((f) => f.type !== "medicine" && f.type !== "water")
    .map((f) => ms(f.at))
    .filter((t) => !Number.isNaN(t) && t >= from && t <= now.getTime())
    .sort((a, b) => a - b);

  // Bashko seancat (gji majtas + djathtas, ose biberon pas gjirit).
  const sessions: number[] = [];
  for (const t of times) {
    if (sessions.length && t - sessions[sessions.length - 1] < SAME_SESSION_MIN * MIN) continue;
    sessions.push(t);
  }
  if (sessions.length < 2 || distinctDays(sessions) < MIN_DAYS) return null;

  // Intervalet > 8 orë janë boshllëqe në shënime, jo ritëm.
  const intervals: { start: number; min: number }[] = [];
  for (let i = 1; i < sessions.length; i++) {
    const min = (sessions[i] - sessions[i - 1]) / MIN;
    if (min <= 8 * 60) intervals.push({ start: sessions[i - 1], min });
  }
  if (intervals.length < MIN_FEED_INTERVALS) return null;

  const last = sessions[sessions.length - 1];
  const nightNow = isNightSleep(new Date(last));
  const samePeriod = intervals.filter((iv) => isNightSleep(new Date(iv.start)) === nightNow);
  const used = samePeriod.length >= 5 ? samePeriod : intervals;
  const { median, spread } = summarize(used.map((iv) => iv.min));
  const at = last + median * MIN;
  // Kaluan orë pas dritares: ndoshta ushqyerja s'u shënua — s'hamendësojmë më.
  if (now.getTime() - at > 3 * 60 * MIN) return null;
  return makeWindow(at, spread, used.length, "own", now);
}

/**
 * Dritaret tipike të zgjimit sipas moshës (minuta) — vlera të zakonshme
 * orientuese që përdoren gjerësisht; çdo bebe është ndryshe.
 */
const WAKE_WINDOWS: { maxWeeks: number; minMin: number; maxMin: number }[] = [
  { maxWeeks: 4, minMin: 35, maxMin: 60 },
  { maxWeeks: 12, minMin: 60, maxMin: 90 },
  { maxWeeks: 20, minMin: 75, maxMin: 120 },
  { maxWeeks: 28, minMin: 120, maxMin: 150 },
  { maxWeeks: 36, minMin: 150, maxMin: 180 },
  { maxWeeks: 52, minMin: 180, maxMin: 240 },
  { maxWeeks: 78, minMin: 240, maxMin: 300 },
  { maxWeeks: Infinity, minMin: 300, maxMin: 360 },
];

export function ageWakeWindow(babyDob: string | null, now: Date): { minMin: number; maxMin: number } | null {
  const born = ms(babyDob);
  if (Number.isNaN(born) || born > now.getTime()) return null;
  const weeks = (now.getTime() - born) / (7 * DAY);
  const row = WAKE_WINDOWS.find((w) => weeks < w.maxWeeks)!;
  return { minMin: row.minMin, maxMin: row.maxMin };
}

/** Gjumi i mbaruar, i renditur, brenda dritares së shikimit. */
function finishedSleeps(sleepLog: SleepEntry[], now: Date) {
  const from = now.getTime() - LOOKBACK_DAYS * DAY;
  return visible(sleepLog)
    .map((s) => ({ s, start: ms(s.startAt), end: ms(s.endAt) }))
    .filter((x) => !Number.isNaN(x.start) && !Number.isNaN(x.end) && x.end > x.start && x.start >= from && x.end <= now.getTime())
    .sort((a, b) => a.start - b.start);
}

/** Po fle: kur zgjohet zakonisht, nga kohëzgjatja e gjumit të të njëjtit lloj (natë / sy gjumë). */
export function predictNextWake(sleepLog: SleepEntry[], now: Date): PredictedWindow | null {
  const running = visible(sleepLog)
    .filter((s) => !s.endAt && !Number.isNaN(ms(s.startAt)))
    .sort((a, b) => ms(b.startAt) - ms(a.startAt))[0];
  if (!running) return null;
  const night = isNightSleep(running.startAt);
  const same = finishedSleeps(sleepLog, now).filter((x) => isNightSleep(new Date(x.start)) === night);
  if (same.length < MIN_SLEEP_SAMPLES || distinctDays(same.map((x) => x.start)) < MIN_DAYS) return null;
  const { median, spread } = summarize(same.map((x) => (x.end - x.start) / MIN - (x.s.pausedIntervalsMin ?? 0)));
  return makeWindow(ms(running.startAt) + median * MIN, spread, same.length, "own", now, 10, night ? 60 : 30);
}

/**
 * Zgjuar: kur vjen gjumi tjetër. Nga dritaret e vetë bebit gjatë ditës
 * (fundi i një gjumi → nisja e tjetrit); pa mjaft të dhëna, nga tabela e moshës.
 */
export function predictNextSleep(sleepLog: SleepEntry[], babyDob: string | null, now: Date): PredictedWindow | null {
  if (visible(sleepLog).some((s) => !s.endAt)) return null;
  const done = finishedSleeps(sleepLog, now);
  const last = done[done.length - 1];
  if (!last) return null;
  // Zgjuar prej më shumë se 8 orësh = shënim i harruar; s'ka kuptim të hamendësojmë.
  if (now.getTime() - last.end > 8 * 60 * MIN) return null;

  const windows: number[] = [];
  for (let i = 1; i < done.length; i++) {
    const gap = (done[i].start - done[i - 1].end) / MIN;
    if (gap > 0 && gap <= 6 * 60 && !isNightSleep(new Date(done[i - 1].end))) windows.push(gap);
  }
  if (windows.length >= 5) {
    const { median, spread } = summarize(windows);
    return makeWindow(last.end + median * MIN, spread, windows.length, "own", now, 10, 40);
  }
  const age = ageWakeWindow(babyDob, now);
  if (!age) return null;
  const mid = (age.minMin + age.maxMin) / 2;
  return makeWindow(last.end + mid * MIN, (age.maxMin - age.minMin) / 2, 0, "age", now, 10, 60);
}

export function buildPredictions(logs: Logs, babyDob: string | null, now: Date = new Date()): Predictions {
  const nextFeeding = predictNextFeeding(logs.feedingLog, now);
  const nextWake = predictNextWake(logs.sleepLog, now);
  const nextSleep = predictNextSleep(logs.sleepLog, babyDob, now);
  const sleepKnown = nextWake !== null || (nextSleep !== null && nextSleep.basis === "own");
  return {
    nextFeeding,
    nextWake,
    nextSleep,
    ageWakeWindow: ageWakeWindow(babyDob, now),
    needsMoreData: { feeding: nextFeeding === null, sleep: !sleepKnown },
  };
}
