import type { DiaperEntry, DiaperType, FeedingEntry, FeedingType, SleepEntry } from "@/lib/state/babyTypes";
import type { Language } from "@/lib/i18n/translations";
import type { BreastTimer } from "@/lib/baby/breastTimer";
import { predictNextFeeding } from "@/lib/baby/predictions";

/**
 * Pamja e vogël që lexon widget-i (Android tani, iOS më vonë): vetëm sa i
 * duhet për t'u vizatuar, pa historikun. Widget-i s'ka akses te gjendja e
 * app-it, ndaj app-i e shkruan këtë sa herë ndryshon diçka që shfaqet.
 */
export type WidgetSnapshot = {
  v: 1;
  lang: Language;
  babyName: string | null;
  feeding: { at: string; type: FeedingType } | null;
  diaper: { at: string; type: DiaperType } | null;
  /** Gjumi në vazhdim (endAt bosh). */
  sleep: { id: string; since: string } | null;
  /** Kur u zgjua herën e fundit — për "zgjuar që nga". */
  lastWakeAt: string | null;
  /** Timeri i gjirit, nëse po numëron. */
  breastSince: string | null;
  /** Mesi i dritares së ushqimit tjetër (lib/baby/predictions.ts); mungon te pamjet e vjetra. */
  nextFeedingAt?: string | null;
  /** Sot (nga mesnata lokale): për widget-et e mëdha. Mungon te pamjet e vjetra. */
  today?: { feedings: number; diapers: number; sleepMin: number };
  updatedAt: string;
};

const visible = <T extends { deletedAt: string | null; archivedAt: string | null }>(list: T[]) =>
  list.filter((e) => !e.deletedAt && !e.archivedAt);

function latestBy<T>(list: T[], at: (e: T) => string | null): T | null {
  let best: T | null = null;
  let bestMs = -Infinity;
  for (const e of list) {
    const v = at(e);
    const ms = v ? new Date(v).getTime() : NaN;
    if (!Number.isNaN(ms) && ms > bestMs) {
      best = e;
      bestMs = ms;
    }
  }
  return best;
}

/** Ushqimet e vërteta: ilaçet dhe uji s'janë "ushqimi i fundit". */
const isMeal = (f: FeedingEntry) => f.type !== "medicine" && f.type !== "water";

function todayStats(input: { feedingLog: FeedingEntry[]; diaperLog: DiaperEntry[]; sleepLog: SleepEntry[]; now: Date }) {
  const start = new Date(input.now.getFullYear(), input.now.getMonth(), input.now.getDate()).getTime();
  const end = input.now.getTime();
  const inToday = (iso: string) => {
    const t = new Date(iso).getTime();
    return t >= start && t <= end;
  };
  const sleepMs = visible(input.sleepLog).reduce((sum, s) => {
    const a = Math.max(new Date(s.startAt).getTime(), start);
    const b = Math.min(s.endAt ? new Date(s.endAt).getTime() : end, end);
    return Number.isFinite(a) && Number.isFinite(b) && b > a ? sum + (b - a) : sum;
  }, 0);
  return {
    feedings: visible(input.feedingLog).filter((f) => isMeal(f) && inToday(f.at)).length,
    diapers: visible(input.diaperLog).filter((d) => inToday(d.at)).length,
    sleepMin: Math.round(sleepMs / 60_000),
  };
}

export function buildSnapshot(input: {
  lang: Language;
  babyName: string | null;
  feedingLog: FeedingEntry[];
  diaperLog: DiaperEntry[];
  sleepLog: SleepEntry[];
  breastTimer: BreastTimer | null;
  now: Date;
}): WidgetSnapshot {
  // Ilaçet dhe uji s'janë "ushqimi i fundit": më parë widget-i tregonte ilaçin si ushqimin e fundit.
  const feeding = latestBy(visible(input.feedingLog).filter(isMeal), (e) => e.at);
  const diaper = latestBy(visible(input.diaperLog), (e) => e.at);
  const sleeps = visible(input.sleepLog);
  const running = latestBy(sleeps.filter((s) => !s.endAt), (s) => s.startAt);
  const lastEnded = latestBy(sleeps.filter((s) => s.endAt), (s) => s.endAt);
  return {
    v: 1,
    lang: input.lang,
    babyName: input.babyName?.trim() || null,
    feeding: feeding ? { at: feeding.at, type: feeding.type } : null,
    diaper: diaper ? { at: diaper.at, type: diaper.type } : null,
    sleep: running ? { id: running.id, since: running.startAt } : null,
    lastWakeAt: lastEnded?.endAt ?? null,
    breastSince: input.breastTimer?.startedAt ?? null,
    nextFeedingAt: predictNextFeeding(input.feedingLog, input.now)?.at ?? null,
    today: todayStats(input),
    updatedAt: input.now.toISOString(),
  };
}

/** Pamja e ruajtur; e prishur ose e versionit tjetër = asgjë (widget-i tregon "hap Bebix"). */
export function parseSnapshot(raw: string | null): WidgetSnapshot | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as WidgetSnapshot;
    return v && v.v === 1 && (v.lang === "sq" || v.lang === "en") ? v : null;
  } catch {
    return null;
  }
}

/** A ndryshon diçka që widget-i e tregon? (`updatedAt` s'llogaritet — përndryshe do rishkruhej pa fund.) */
export function sameSnapshot(a: WidgetSnapshot | null, b: WidgetSnapshot | null): boolean {
  if (!a || !b) return a === b;
  const strip = ({ updatedAt: _u, ...rest }: WidgetSnapshot) => JSON.stringify(rest);
  return strip(a) === strip(b);
}
