import type { FeedingEntry, SleepEntry, DiaperEntry } from "@/lib/state/babyTypes";

/**
 * Ora 24-orëshe e bebit.
 *
 * Shiriti i drejtë tregonte "sa larg nga tani", që do të thotë se e njëjta
 * orë e murit binte çdo ditë në një vend tjetër. Në një rreth pozicioni
 * është vetë ora: mesnata rri gjithmonë lart, mesdita poshtë. Prindi e njeh
 * formën e natës pa lexuar asnjë numër.
 *
 * Dritarja mbetet 24 orët e fundit, pra çdo kënd i rrethit mbulohet saktësisht
 * një herë. Ajo që ndryshon është si lexohet, jo çfarë tregon.
 *
 * Funksione të pastra: asnjë React, dhe "tani" jepet gjithmonë nga jashtë që
 * testet të mos varen nga ora kur xhirojnë.
 */

export const DAY_MS = 86400000;

/** Ora kur nis dhe mbaron nata — vetëm për hijezimin e rrethit. */
export const NIGHT_FROM = 21;
export const NIGHT_TO = 6;

export type ClockKind = "sleep" | "feeding" | "diaper";

export type ClockItem =
  | {
      kind: "sleep";
      /** `id` i regjistrimit; një gjumë që kapërcen mesnatën jep dy copa me të njëjtin id. */
      id: string;
      key: string;
      from: number;
      to: number;
      entry: SleepEntry;
      minutes: number;
    }
  | { kind: "feeding"; id: string; key: string; at: number; entry: FeedingEntry }
  | { kind: "diaper"; id: string; key: string; at: number; entry: DiaperEntry };

export type DayClock = {
  items: ClockItem[];
  /** Pozicioni i çastit aktual në rreth, 0–1. */
  now: number;
  windowStart: Date;
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

/** Pjesa e ditës si thyesë 0–1, ku 0 është mesnata. */
export function fractionOfDay(at: number): number {
  const d = new Date(at);
  return (d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds()) / 86400;
}

/**
 * Blloqet e gjumit që kapërcejnë mesnatën priten në dy copa.
 *
 * Pa këtë, një gjumë 22:00–06:00 do të kishte `from` 0.92 dhe `to` 0.25, dhe
 * do të vizatohej mbrapsht rreth 3/4 të rrethit.
 */
function pushSleepArcs(out: ClockItem[], entry: SleepEntry, from: number, to: number, minutes: number) {
  const a = fractionOfDay(from);
  const b = fractionOfDay(to);
  // Nje gjume me i gjate se 24 ore mbulon gjithe rrethin.
  if (to - from >= DAY_MS) {
    out.push({ kind: "sleep", id: entry.id, key: `${entry.id}-full`, from: 0, to: 1, entry, minutes });
    return;
  }
  if (b > a) {
    out.push({ kind: "sleep", id: entry.id, key: entry.id, from: a, to: b, entry, minutes });
    return;
  }
  // Kapercen mesnaten.
  out.push({ kind: "sleep", id: entry.id, key: `${entry.id}-a`, from: a, to: 1, entry, minutes });
  out.push({ kind: "sleep", id: entry.id, key: `${entry.id}-b`, from: 0, to: b, entry, minutes });
}

export function buildDayClock(
  feedings: FeedingEntry[],
  sleeps: SleepEntry[],
  diapers: DiaperEntry[],
  now: Date = new Date()
): DayClock {
  const end = now.getTime();
  const start = end - DAY_MS;
  const items: ClockItem[] = [];

  for (const sleep of sleeps) {
    const from = ms(sleep.startAt);
    if (from === null) continue;
    // Gjumi që vazhdon shtrihet deri tani.
    const to = ms(sleep.endAt) ?? end;
    if (to <= start || from >= end) continue;
    const clippedFrom = Math.max(from, start);
    const clippedTo = Math.min(to, end);
    if (clippedTo <= clippedFrom) continue;
    pushSleepArcs(items, sleep, clippedFrom, clippedTo, Math.round((clippedTo - clippedFrom) / 60000));
  }

  for (const feeding of feedings) {
    const at = ms(feeding.at);
    if (at === null || at < start || at > end) continue;
    items.push({ kind: "feeding", id: feeding.id, key: feeding.id, at: fractionOfDay(at), entry: feeding });
  }

  for (const diaper of diapers) {
    const at = ms(diaper.at);
    if (at === null || at < start || at > end) continue;
    items.push({ kind: "diaper", id: diaper.id, key: diaper.id, at: fractionOfDay(at), entry: diaper });
  }

  return { items, now: fractionOfDay(end), windowStart: new Date(start) };
}

export function clockTotals(
  feedings: FeedingEntry[],
  sleeps: SleepEntry[],
  diapers: DiaperEntry[],
  now: Date = new Date()
): ClockTotals {
  const end = now.getTime();
  const start = end - DAY_MS;

  let sleepMs = 0;
  let longest = 0;
  for (const sleep of sleeps) {
    const from = ms(sleep.startAt);
    if (from === null) continue;
    const to = ms(sleep.endAt) ?? end;
    const overlap = Math.min(to, end) - Math.max(from, start);
    if (overlap <= 0) continue;
    sleepMs += overlap;
    if (overlap > longest) longest = overlap;
  }

  const inWindow = (iso: string) => {
    const at = ms(iso);
    return at !== null && at >= start && at <= end;
  };

  const diapersIn = diapers.filter((d) => inWindow(d.at));

  return {
    sleepMinutes: Math.round(sleepMs / 60000),
    longestSleepMinutes: Math.round(longest / 60000),
    feedings: feedings.filter((f) => inWindow(f.at)).length,
    diapers: diapersIn.length,
    poops: diapersIn.filter((d) => d.type === "dirty" || d.type === "both").length,
  };
}

/** Distanca mes dy pozicioneve në rreth: 0.99 dhe 0.01 janë afër, jo larg. */
export function circularDistance(a: number, b: number): number {
  const d = Math.abs(a - b) % 1;
  return d > 0.5 ? 1 - d : d;
}

/**
 * Çfarë ndodhet te ky kënd i rrethit.
 *
 * Shenjat e çastit kontrollohen para blloqeve të gjumit sepse vizatohen mbi
 * to: nëse prindi shtyp mbi një ushqyerje që bie brenda një gjumi, pret të
 * shohë ushqyerjen, jo gjumin nën të.
 *
 * `tolerance` është sa larg lejohet gishti — 0.012 e rrethit janë rreth 17
 * minuta, gjerësia e një gishti mbi një rreth të kësaj madhësie.
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

/** Nje unaze e vetme: cfare mban dhe ku rri. */
export type RingBand = { kind: ClockKind; radius: number; width: number };

/**
 * Cila unaze u prek.
 *
 * Merret ajo me e afert, jo ajo qe e permban saktesisht prekjen: mes dy
 * unazave ka hapesire, dhe nje gisht qe bie ne hapesire duhet te kape
 * unazen me te afert, jo asgje. `slack` eshte sa larg buzes lejohet.
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
  const cx = size / 2;
  const cy = size / 2;
  // atan2 nis nga djathtas dhe shkon kundër akrepave; ora nis lart dhe shkon
  // me akrepat, prandaj boshtet ndërrohen.
  const angle = Math.atan2(x - cx, cy - y);
  const fraction = angle / (Math.PI * 2);
  return fraction < 0 ? fraction + 1 : fraction;
}

/** Sa larg qendrës ra prekja, në piksele. */
export function distanceFromTouch(x: number, y: number, size: number): number {
  const cx = size / 2;
  const cy = size / 2;
  return Math.hypot(x - cx, y - cy);
}

/** Pjesët e rrethit që janë natë — pozicione fikse, sepse ora nuk rrëshqet. */
export function nightArcs(): { from: number; to: number }[] {
  return [
    { from: NIGHT_FROM / 24, to: 1 },
    { from: 0, to: NIGHT_TO / 24 },
  ];
}
