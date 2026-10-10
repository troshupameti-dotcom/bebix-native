import type { FeedingEntry, SleepEntry, DiaperEntry } from "@/lib/state/babyTypes";
import type { TranslationKey } from "@/lib/i18n/translations";

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

/** Perkthyesi i app-it, i pranuar si argument qe kjo skedare te mbetet e paster. */
export type Translate = (key: TranslationKey, params?: Record<string, string | number>) => string;

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

/**
 * Shumat e një dite kalendarike (nga mesnata lokale e `day`), deri në
 * `until` kur dita s'ka mbaruar ende ose kur krahasohet "deri në këtë orë".
 *
 *  - Ilaçet s'numërohen si ushqim (rrinë në të njëjtën listë).
 *  - Gjumi që kapërcen mesnatën numërohet vetëm për pjesën brenda ditës.
 *  - Gjumi që vazhdon: deri tani; i pauzuar: deri te pauza.
 */
export function dayTotals(
  feedings: FeedingEntry[],
  sleeps: SleepEntry[],
  diapers: DiaperEntry[],
  day: Date,
  until: Date
): TodayTotals {
  const start = new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime();
  const dayEnd = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1).getTime();
  const end = Math.min(dayEnd, until.getTime());
  const inside = (iso: string | null | undefined) => {
    const t = time(iso);
    return t !== null && t >= start && t < end;
  };

  let sleepMs = 0;
  for (const sleep of sleeps) {
    const from = time(sleep.startAt);
    if (from === null) continue;
    const to = time(sleep.endAt) ?? time(sleep.pausedAt) ?? until.getTime();
    const overlap = Math.min(to, end) - Math.max(from, start);
    if (overlap > 0) sleepMs += overlap;
  }

  return {
    feedings: feedings.filter((f) => f.type !== "medicine" && inside(f.at)).length,
    diapers: diapers.filter((d) => inside(d.at)).length,
    sleepMinutes: Math.round(sleepMs / 60000),
  };
}

/** Sa ka ndodhur sot — nga mesnata, jo 24 orët e fundit. */
export function todayTotals(
  feedings: FeedingEntry[],
  sleeps: SleepEntry[],
  diapers: DiaperEntry[],
  now: Date = new Date()
): TodayTotals {
  return dayTotals(feedings, sleeps, diapers, now, now);
}

/** "+1 nga dje" / "−30 min nga dje" / "njësoj si dje". Pa vlerësime — vetëm numra. */
export function deltaLabel(delta: number, kind: "count" | "minutes", t: Translate): string {
  if (delta === 0) return t("sum_same");
  const sign = delta > 0 ? "+" : "−";
  const abs = Math.abs(delta);
  const value = kind === "minutes" ? durationLabel(abs, t) : String(abs);
  return t("sum_vs_yesterday", { v: `${sign}${value}` });
}

export type DayDelta = { feedings: number | null; diapers: number | null; sleepMinutes: number | null };

/**
 * Sot kundrejt dje, deri në të njëjtën orë (që në mëngjes të mos dalë "−6
 * nga dje" vetëm sepse dita s'ka mbaruar). Krahasimi i një lloji jepet vetëm
 * kur dje ka pasur të paktën një shënim të tij — përndryshe null.
 */
export function compareWithYesterday(
  feedings: FeedingEntry[],
  sleeps: SleepEntry[],
  diapers: DiaperEntry[],
  now: Date = new Date()
): { today: TodayTotals; delta: DayDelta } {
  const today = dayTotals(feedings, sleeps, diapers, now, now);
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  const sameTimeYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, now.getHours(), now.getMinutes(), now.getSeconds());
  const soFar = dayTotals(feedings, sleeps, diapers, yesterday, sameTimeYesterday);
  const whole = dayTotals(feedings, sleeps, diapers, yesterday, new Date(now.getFullYear(), now.getMonth(), now.getDate()));
  return {
    today,
    delta: {
      feedings: whole.feedings > 0 ? today.feedings - soFar.feedings : null,
      diapers: whole.diapers > 0 ? today.diapers - soFar.diapers : null,
      sleepMinutes: whole.sleepMinutes > 0 ? today.sleepMinutes - soFar.sleepMinutes : null,
    },
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

/**
 * "2 orë 15 min" ose "45 min" — pa sekonda, sepse askush nuk i lexon.
 *
 * Perkthyesi jepet nga jashte: kjo skedare nuk njeh React, dhe teksti i
 * ngulitur ketu do te dilte shqip edhe kur app-i eshte ne anglisht.
 */
export function durationLabel(minutes: number, t: Translate): string {
  if (minutes < 1) return t("dur_now");
  if (minutes < 60) return t("dur_min", { n: minutes });
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? t("dur_hours", { h: hours }) : t("dur_hours_min", { h: hours, m: rest });
}

/** Sa kohë ka kaluar nga një çast, si tekst i shkurtër. */
export function sinceLabel(iso: string | null, t: Translate, now: Date = new Date()): string | null {
  const at = time(iso);
  if (at === null) return null;
  return durationLabel(Math.max(0, Math.round((now.getTime() - at) / 60000)), t);
}

/* ------------------------------------------------------------------ *
 * Konteksti i shiritit 24-oresh
 * ------------------------------------------------------------------ */

/** Ora kur nis nata dhe ora kur mbaron — per hijezimin e shiritit. */
export const NIGHT_FROM = 21;
export const NIGHT_TO = 6;

export type Band = { start: number; end: number };
export type HourTick = { at: number; label: string };

function isNightHour(hour: number): boolean {
  return hour >= NIGHT_FROM || hour < NIGHT_TO;
}

/**
 * Pjeset e dritares qe bien naten, si thyesa 0–1.
 *
 * Nje bllok gjumi pa kontekst nuk thote asgje: tri ore gjume ne mesdite dhe
 * tri ore ne mesnate lexohen njesoj. Hijezimi i nates e tregon dallimin pa
 * asnje fjale.
 */
export function nightBands(windowStart: Date, now: Date = new Date()): Band[] {
  const startMs = windowStart.getTime();
  const endMs = now.getTime();
  const span = endMs - startMs;
  if (span <= 0) return [];

  const bands: Band[] = [];
  let open: { from: number; to: number } | null = null;

  const firstHour = new Date(startMs);
  firstHour.setMinutes(0, 0, 0);

  for (let ms = firstHour.getTime(); ms < endMs; ms += 3600000) {
    // Ora ri-lexohet ne cdo hap, qe nderrimi i ores veres te mos e zhvendose.
    if (!isNightHour(new Date(ms).getHours())) {
      open = null;
      continue;
    }
    const from = Math.max(ms, startMs);
    const to = Math.min(ms + 3600000, endMs);
    if (to <= from) continue;
    if (open && open.to === from) open.to = to;
    else {
      open = { from, to };
      bands.push({ start: 0, end: 0 });
    }
    bands[bands.length - 1] = { start: (open.from - startMs) / span, end: (open.to - startMs) / span };
  }

  return bands;
}

/** Oret e plota qe bien brenda dritares, ne pozicionin e tyre te vertete. */
export function hourTicks(windowStart: Date, now: Date = new Date(), everyHours = 6): HourTick[] {
  const startMs = windowStart.getTime();
  const endMs = now.getTime();
  const span = endMs - startMs;
  if (span <= 0) return [];

  const ticks: HourTick[] = [];
  const firstHour = new Date(startMs);
  firstHour.setMinutes(0, 0, 0);

  for (let ms = firstHour.getTime(); ms <= endMs; ms += 3600000) {
    if (ms < startMs) continue;
    const d = new Date(ms);
    if (d.getHours() % everyHours !== 0) continue;
    ticks.push({ at: (ms - startMs) / span, label: `${String(d.getHours()).padStart(2, "0")}:00` });
  }

  return ticks;
}

/**
 * Gjumi me i gjate brenda dritares, ne minuta.
 *
 * Totali i gjumit nuk e tregon naten: dymbedhjete ore te copetuara ne
 * gjashte copa jane nje nate tjeter nga dymbedhjete ore rresht.
 */
export function longestSleepMinutes(
  sleeps: SleepEntry[],
  now: Date = new Date(),
  windowMs: number = DAY_MS
): number {
  const end = now.getTime();
  const start = end - windowMs;
  let longest = 0;

  for (const sleep of sleeps) {
    const from = time(sleep.startAt);
    if (from === null) continue;
    const to = time(sleep.endAt) ?? end;
    const overlap = Math.min(to, end) - Math.max(from, start);
    if (overlap > longest) longest = overlap;
  }

  return Math.round(longest / 60000);
}
