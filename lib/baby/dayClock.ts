import type { FeedingEntry, SleepEntry, DiaperEntry } from "@/lib/state/babyTypes";

/**
 * Ora e bebit — një fytyrë ore e vërtetë: 12 lart, 3 djathtas, 6 poshtë, 9 majtas.
 *
 * Kjo e detyron rrethin të mbulojë 12 orë, jo 24. Nuk është zgjedhje stili:
 * që 3:00 të bjerë djathtas, çereku i rrethit duhet të jetë tri orë. Me 24
 * orë në rreth, çereku bëhet gjashtë orë, dhe djathtas do të binte 6:00.
 *
 * Prandaj dita ndahet në dy gjysma — paradite dhe pasdite — dhe prindi lëviz
 * mes tyre. Numrat e fytyrës janë të njëjtët në të dyja (12,1,2…11), saktësisht
 * si te një orë dore, pra asgjë nuk duhet rimësuar.
 *
 * Funksione të pastra: asnjë React, dhe "tani" jepet gjithmonë nga jashtë që
 * testet të mos varen nga ora kur xhirojnë.
 */

export const HALF_DAY_MS = 12 * 3600000;

export type ClockKind = "sleep" | "feeding" | "diaper";

/** Gjysma e ditës që po shihet. */
export type ClockPeriod = {
  start: Date;
  end: Date;
  /** E vërtetë për 00:00–12:00. */
  isAm: boolean;
};

export type ClockItem =
  | {
      kind: "sleep";
      id: string;
      key: string;
      from: number;
      to: number;
      entry: SleepEntry;
      /** Minuta brenda kësaj gjysme dite, jo gjithsej. */
      minutes: number;
    }
  | { kind: "feeding"; id: string; key: string; at: number; entry: FeedingEntry }
  | { kind: "diaper"; id: string; key: string; at: number; entry: DiaperEntry };

export type DayClock = {
  items: ClockItem[];
  /** Pozicioni i çastit aktual, 0–1; null kur "tani" s'bie në këtë gjysmë. */
  now: number | null;
  period: ClockPeriod;
};

export type ClockTotals = {
  sleepMinutes: number;
  longestSleepMinutes: number;
  feedings: number;
  diapers: number;
  /** Pelenat me jashtëqitje — `dirty` ose `both`. */
  poops: number;
};

function ms(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? null : t;
}

/* ------------------------------------------------------------------ *
 * Gjysmat e ditës
 * ------------------------------------------------------------------ */

/** Gjysma e ditës ku bie `now`. */
export function periodFor(now: Date = new Date()): ClockPeriod {
  const isAm = now.getHours() < 12;
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), isAm ? 0 : 12, 0, 0, 0);
  return { start, end: new Date(start.getTime() + HALF_DAY_MS), isAm };
}

/**
 * Lëviz `delta` gjysma dite.
 *
 * Nuk shtohen thjesht 12 orë: kalimi i orës së verës e bën një ditë 23 ose 25
 * orë, dhe mbledhja e milisekondave do ta zhvendoste fytyrën e orës.
 */
export function shiftPeriod(period: ClockPeriod, delta: number): ClockPeriod {
  const halves = (period.isAm ? 0 : 1) + delta;
  const dayShift = Math.floor(halves / 2);
  const isAm = ((halves % 2) + 2) % 2 === 0;
  const start = new Date(
    period.start.getFullYear(),
    period.start.getMonth(),
    period.start.getDate() + dayShift,
    isAm ? 0 : 12,
    0,
    0,
    0
  );
  return { start, end: new Date(start.getTime() + HALF_DAY_MS), isAm };
}

export function isCurrentPeriod(period: ClockPeriod, now: Date = new Date()): boolean {
  return periodFor(now).start.getTime() === period.start.getTime();
}

/** Pozicioni i një çasti brenda gjysmës, 0–1. Null kur bie jashtë saj. */
export function fractionInPeriod(at: number, period: ClockPeriod): number | null {
  const start = period.start.getTime();
  const span = period.end.getTime() - start;
  const f = (at - start) / span;
  return f < 0 || f > 1 ? null : f;
}

/* ------------------------------------------------------------------ *
 * Ndërtimi
 * ------------------------------------------------------------------ */

export function buildDayClock(
  feedings: FeedingEntry[],
  sleeps: SleepEntry[],
  diapers: DiaperEntry[],
  period: ClockPeriod,
  now: Date = new Date()
): DayClock {
  const start = period.start.getTime();
  const end = period.end.getTime();
  const span = end - start;
  const items: ClockItem[] = [];

  for (const sleep of sleeps) {
    const from = ms(sleep.startAt);
    if (from === null) continue;
    // Gjumi që vazhdon shtrihet deri tani, jo deri në fund të gjysmës.
    const to = ms(sleep.endAt) ?? now.getTime();
    const a = Math.max(from, start);
    const b = Math.min(to, end);
    if (b <= a) continue;
    items.push({
      kind: "sleep",
      id: sleep.id,
      key: sleep.id,
      from: (a - start) / span,
      to: (b - start) / span,
      entry: sleep,
      minutes: Math.round((b - a) / 60000),
    });
  }

  for (const feeding of feedings) {
    const at = ms(feeding.at);
    if (at === null) continue;
    const f = fractionInPeriod(at, period);
    if (f === null) continue;
    items.push({ kind: "feeding", id: feeding.id, key: feeding.id, at: f, entry: feeding });
  }

  for (const diaper of diapers) {
    const at = ms(diaper.at);
    if (at === null) continue;
    const f = fractionInPeriod(at, period);
    if (f === null) continue;
    items.push({ kind: "diaper", id: diaper.id, key: diaper.id, at: f, entry: diaper });
  }

  return { items, now: fractionInPeriod(now.getTime(), period), period };
}

export function clockTotals(
  feedings: FeedingEntry[],
  sleeps: SleepEntry[],
  diapers: DiaperEntry[],
  period: ClockPeriod,
  now: Date = new Date()
): ClockTotals {
  const start = period.start.getTime();
  const end = period.end.getTime();

  let sleepMs = 0;
  let longest = 0;
  for (const sleep of sleeps) {
    const from = ms(sleep.startAt);
    if (from === null) continue;
    const to = ms(sleep.endAt) ?? now.getTime();
    const overlap = Math.min(to, end) - Math.max(from, start);
    if (overlap <= 0) continue;
    sleepMs += overlap;
    if (overlap > longest) longest = overlap;
  }

  const inPeriod = (iso: string) => {
    const at = ms(iso);
    return at !== null && at >= start && at <= end;
  };

  const diapersIn = diapers.filter((d) => inPeriod(d.at));

  return {
    sleepMinutes: Math.round(sleepMs / 60000),
    longestSleepMinutes: Math.round(longest / 60000),
    feedings: feedings.filter((f) => inPeriod(f.at)).length,
    diapers: diapersIn.length,
    poops: diapersIn.filter((d) => d.type === "dirty" || d.type === "both").length,
  };
}

/** Hyrjet e kësaj gjysme dite, për fshirje me një veprim. */
export function entryRefsInPeriod(
  feedings: FeedingEntry[],
  sleeps: SleepEntry[],
  diapers: DiaperEntry[],
  period: ClockPeriod
): { kind: "feeding" | "sleep" | "diaper"; id: string }[] {
  const start = period.start.getTime();
  const end = period.end.getTime();
  const inside = (iso: string | null | undefined) => {
    const at = ms(iso);
    return at !== null && at >= start && at <= end;
  };

  return [
    ...feedings.filter((f) => inside(f.at)).map((f) => ({ kind: "feeding" as const, id: f.id })),
    // Gjumi numërohet aty ku nisi, që të mos fshihet dy herë nga dy gjysma.
    ...sleeps.filter((s) => inside(s.startAt)).map((s) => ({ kind: "sleep" as const, id: s.id })),
    ...diapers.filter((d) => inside(d.at)).map((d) => ({ kind: "diaper" as const, id: d.id })),
  ];
}

/* ------------------------------------------------------------------ *
 * Prekja
 * ------------------------------------------------------------------ */

/** Distanca mes dy pozicioneve në rreth: 0.99 dhe 0.01 janë afër, jo larg. */
export function circularDistance(a: number, b: number): number {
  const d = Math.abs(a - b) % 1;
  return d > 0.5 ? 1 - d : d;
}

/**
 * Çfarë ndodhet te ky kënd i një unaze.
 *
 * Shenjat e çastit kontrollohen para blloqeve të gjumit sepse vizatohen mbi
 * to. `tolerance` është sa larg lejohet gishti — 0.012 e rrethit janë rreth
 * tetë minuta mbi një fytyrë 12-orëshe.
 */
export function itemAtFraction(
  items: ClockItem[],
  fraction: number,
  kind?: ClockKind,
  tolerance = 0.012
): ClockItem | null {
  const pool = kind ? items.filter((i) => i.kind === kind) : items;

  let nearest: ClockItem | null = null;
  let nearestDistance = tolerance;

  for (const item of pool) {
    if (item.kind === "sleep") continue;
    const d = circularDistance(item.at, fraction);
    if (d <= nearestDistance) {
      nearest = item;
      nearestDistance = d;
    }
  }
  if (nearest) return nearest;

  for (const item of pool) {
    if (item.kind !== "sleep") continue;
    if (fraction >= item.from && fraction <= item.to) return item;
  }

  return null;
}

/** Një unazë e vetme: çfarë mban dhe ku rri. */
export type RingBand = { kind: ClockKind; radius: number; width: number };

/**
 * Cila unazë u prek.
 *
 * Merret ajo më e afërt, jo ajo që e përmban saktësisht prekjen: mes dy
 * unazave ka hapësirë, dhe një gisht që bie në hapësirë duhet të kapë unazën
 * më të afërt, jo asgjë. `slack` është sa larg buzës lejohet.
 */
export function ringAtRadius(bands: RingBand[], distance: number, slack = 10): RingBand | null {
  let best: RingBand | null = null;
  let bestGap = Infinity;

  for (const band of bands) {
    const gap = Math.abs(distance - band.radius) - band.width / 2;
    if (gap <= slack && gap < bestGap) {
      best = band;
      bestGap = gap;
    }
  }

  return best;
}

/** Këndi i një prekjeje brenda rrethit, si thyesë 0–1 me 0 lart. */
export function fractionFromTouch(x: number, y: number, size: number): number {
  const c = size / 2;
  // atan2 nis nga djathtas dhe shkon kundër akrepave; ora nis lart dhe shkon
  // me akrepat, prandaj boshtet ndërrohen.
  const angle = Math.atan2(x - c, c - y);
  const fraction = angle / (Math.PI * 2);
  return fraction < 0 ? fraction + 1 : fraction;
}

/** Sa larg qendrës ra prekja, në piksele. */
export function distanceFromTouch(x: number, y: number, size: number): number {
  const c = size / 2;
  return Math.hypot(x - c, y - c);
}

/**
 * Pjesët e gjysmës që janë natë.
 *
 * Nata është 21:00–06:00. Paradite zë orët 0–6, pra gjysmën e parë të
 * fytyrës; pasdite zë orët 21–24, pra çerekun e fundit.
 */
export function nightArcs(period: ClockPeriod): { from: number; to: number }[] {
  return period.isAm ? [{ from: 0, to: 6 / 12 }] : [{ from: 9 / 12, to: 1 }];
}
