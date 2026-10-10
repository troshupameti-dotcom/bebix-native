import type { BabyModuleState, Moment } from "@/lib/state/babyTypes";
import { addMonths } from "@/lib/baby/celebrations";

/**
 * Kujtimet: "sot, para 1 muaji / 6 muajsh / 1 viti" dhe përmbledhja e një
 * muaji (momentet, arritjet, numrat). Funksione të pastra.
 */

const visible = <T extends { deletedAt: string | null; archivedAt: string | null }>(list: T[]) =>
  list.filter((e) => !e.deletedAt && !e.archivedAt);

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

export type MemoryAgo = { months: number };
export type OnThisDay = { ago: MemoryAgo; moments: Moment[] };

/** Sa kohë mbrapa kërkohen kujtimet (muaj): 1, 6, 12, 24, 36. */
export const MEMORY_OFFSETS = [1, 6, 12, 24, 36];

/** Momentet (me foto ose shënim) që ndodhën pikërisht sot para N muajsh — më të vjetrat para. */
export function onThisDay(moments: Moment[], now: Date = new Date()): OnThisDay[] {
  const list = visible(moments);
  const out: OnThisDay[] = [];
  // Sot është dita e fundit e një muaji të shkurtër (p.sh. 28 shkurt): kujtimet
  // e 29–31 janarit s'kanë ditën e vet këtë muaj, ndaj dalin sot.
  const nowIsLastDay = now.getDate() === new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  for (const months of [...MEMORY_OFFSETS].reverse()) {
    const then = addMonths(new Date(now.getFullYear(), now.getMonth(), now.getDate()), -months);
    const matches = list.filter((m) => {
      const d = new Date(m.date);
      if (Number.isNaN(d.getTime())) return false;
      if (sameDay(d, then)) return true;
      return nowIsLastDay && d.getFullYear() === then.getFullYear() && d.getMonth() === then.getMonth() && d.getDate() > then.getDate();
    });
    if (matches.length) out.push({ ago: { months }, moments: matches.sort((a, b) => Number(b.favorite) - Number(a.favorite)) });
  }
  return out;
}

export type MonthKey = string; // "2026-09"

const pad = (n: number) => String(n).padStart(2, "0");
export const monthKeyOf = (d: Date): MonthKey => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;

export function parseMonthKey(key: string | undefined | null): { start: Date; end: Date } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(key ?? "");
  if (!m) return null;
  const start = new Date(+m[1], +m[2] - 1, 1);
  if (Number.isNaN(start.getTime()) || +m[2] < 1 || +m[2] > 12) return null;
  return { start, end: new Date(start.getFullYear(), start.getMonth() + 1, 1) };
}

export type MonthRecap = {
  month: MonthKey;
  start: string;
  /** Momentet me foto (për diapozitivët), të preferuarat para. */
  photos: Moment[];
  /** Arritjet (momente "milestone") dhe ngjarjet e kalendarit, sipas datës. */
  milestones: { id: string; title: string; date: string }[];
  feedings: number;
  diapers: number;
  /** Mesatarja e gjumit në ditë me shënime (minuta), ose null. */
  sleepPerDayMin: number | null;
  /** Ndryshimi i peshës brenda muajit (kg), kur ka dy matje. */
  weightGainKg: number | null;
  heightGainCm: number | null;
  /** Ditët me të paktën një shënim. */
  activeDays: number;
};

export function buildMonthRecap(baby: BabyModuleState, month: MonthKey): MonthRecap | null {
  const range = parseMonthKey(month);
  if (!range) return null;
  const from = range.start.getTime();
  const to = range.end.getTime();
  const inMonth = (iso: string | null | undefined) => {
    const t = iso ? new Date(iso).getTime() : NaN;
    return !Number.isNaN(t) && t >= from && t < to;
  };
  const dayKey = (iso: string) => new Date(iso).toDateString();

  const moments = visible(baby.moments).filter((m) => inMonth(m.date));
  const photos = moments
    .filter((m) => m.type === "photo" && (m.uri || m.storagePath))
    .sort((a, b) => Number(b.favorite) - Number(a.favorite) || new Date(a.date).getTime() - new Date(b.date).getTime());
  const milestones = [
    ...moments.filter((m) => m.type === "milestone").map((m) => ({ id: m.id, title: m.title, date: m.date })),
    ...visible(baby.timeline).filter((e) => inMonth(e.date)).map((e) => ({ id: e.id, title: e.title, date: e.date })),
  ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const feedings = visible(baby.feedingLog).filter((f) => f.type !== "medicine" && inMonth(f.at));
  const diapers = visible(baby.diaperLog).filter((d) => inMonth(d.at));
  const sleeps = visible(baby.sleepLog).filter((s) => s.endAt && inMonth(s.startAt));
  const sleepMin = sleeps.reduce(
    (sum, s) => sum + Math.max(0, (new Date(s.endAt!).getTime() - new Date(s.startAt).getTime()) / 60000 - (s.pausedIntervalsMin ?? 0)),
    0
  );
  const sleepDays = new Set(sleeps.map((s) => dayKey(s.startAt))).size;

  const growth = visible(baby.growthHistory)
    .filter((g) => inMonth(g.date))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const gain = (pick: (g: (typeof growth)[number]) => number | null, digits: number) => {
    const vals = growth.map(pick).filter((v): v is number => typeof v === "number");
    if (vals.length < 2) return null;
    const f = 10 ** digits;
    return Math.round((vals[vals.length - 1] - vals[0]) * f) / f;
  };

  const activeDays = new Set([
    ...feedings.map((f) => dayKey(f.at)),
    ...diapers.map((d) => dayKey(d.at)),
    ...sleeps.map((s) => dayKey(s.startAt)),
    ...moments.map((m) => dayKey(m.date)),
  ]).size;

  return {
    month,
    start: range.start.toISOString(),
    photos,
    milestones,
    feedings: feedings.length,
    diapers: diapers.length,
    sleepPerDayMin: sleepDays ? Math.round(sleepMin / sleepDays) : null,
    weightGainKg: gain((g) => g.weightKg, 2),
    heightGainCm: gain((g) => g.heightCm, 1),
    activeDays,
  };
}

/** Karta e muajit të kaluar del 1–7 të muajit, kur ka diçka për të treguar. */
export function recapMonthToShow(baby: BabyModuleState, now: Date = new Date()): MonthRecap | null {
  if (now.getDate() > 7) return null;
  const recap = buildMonthRecap(baby, monthKeyOf(new Date(now.getFullYear(), now.getMonth() - 1, 1)));
  if (!recap) return null;
  return recap.photos.length > 0 || recap.milestones.length > 0 || recap.activeDays >= 5 ? recap : null;
}
