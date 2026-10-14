import type { DiaperEntry, FeedingEntry, SleepEntry } from "@/lib/state/babyTypes";
import { isNightTime, type NightPrefs } from "@/lib/baby/nightMode";

/**
 * "Nata deri tani": çka ka ndodhur që nga fillimi i natës, për shiritin e kohës te pamja e natës.
 * Funksion i pastër me `now` të dhënë, që testohet pa ekran.
 */

const HOUR = 3_600_000;

export type NightRange = { start: number; end: number };

export type NightSummary = {
  range: NightRange;
  /** Gjumi brenda natës, i prerë te kufijtë e saj dhe te "tani" për gjumin që vazhdon. */
  sleeps: { start: number; end: number; ongoing: boolean }[];
  feedings: number[];
  diapers: number[];
  sleptMin: number;
};

/**
 * Nata që po kalon. Brenda orarit: nga ora e fillimit deri te ora e mëngjesit. Kur modaliteti u ndez me dorë
 * jashtë orarit: katër orët e fundit (nga ora e plotë), me të njëjtën gjatësi si orari.
 */
export function nightRange(now: Date, prefs: Pick<NightPrefs, "fromHour" | "toHour">): NightRange {
  const span = ((prefs.toHour - prefs.fromHour + 24) % 24 || 8) * HOUR;
  if (isNightTime(now, prefs)) {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), prefs.fromHour);
    if (start.getTime() > now.getTime()) start.setDate(start.getDate() - 1);
    return { start: start.getTime(), end: start.getTime() + span };
  }
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours() - 4).getTime();
  return { start, end: Math.max(start + span, now.getTime() + HOUR) };
}

const time = (iso: string | null | undefined) => (iso ? new Date(iso).getTime() : NaN);
/** Si `active()`: pa të fshirat dhe pa të arkivuarat. */
const visible = <T extends { deletedAt: string | null; archivedAt: string | null }>(list: T[]) =>
  list.filter((e) => !e.deletedAt && !e.archivedAt);

export function nightSummary(
  logs: { feedingLog: FeedingEntry[]; sleepLog: SleepEntry[]; diaperLog: DiaperEntry[] },
  now: Date,
  prefs: Pick<NightPrefs, "fromHour" | "toHour">
): NightSummary {
  const range = nightRange(now, prefs);
  const nowMs = now.getTime();
  // Pamja e rillogarit përmbledhjen një herë në minutë: një shënim i sapo bërë mund të jetë pak pas `now`.
  const cutoff = Math.min(range.end, nowMs + 60_000);
  const within = (t: number) => !Number.isNaN(t) && t >= range.start && t <= cutoff;

  const sleeps = visible(logs.sleepLog)
    .map((s) => {
      const start = time(s.startAt);
      const ongoing = !s.endAt;
      const end = ongoing ? nowMs : time(s.endAt);
      return { start: Math.max(start, range.start), end: Math.min(end, range.end, nowMs), ongoing };
    })
    .filter((s) => !Number.isNaN(s.start) && !Number.isNaN(s.end) && s.end > s.start)
    .sort((a, b) => a.start - b.start);

  const feedings = visible(logs.feedingLog)
    .filter((f) => f.type !== "medicine" && f.type !== "water")
    .map((f) => time(f.at))
    .filter(within)
    .sort((a, b) => a - b);

  const diapers = visible(logs.diaperLog).map((d) => time(d.at)).filter(within).sort((a, b) => a - b);

  const sleptMin = Math.round(sleeps.reduce((sum, s) => sum + (s.end - s.start), 0) / 60_000);
  return { range, sleeps, feedings, diapers, sleptMin };
}

/** Ku bie një çast në shiritin e natës: 0 = fillimi, 1 = mëngjesi. */
export function positionIn(range: NightRange, t: number): number {
  return Math.max(0, Math.min(1, (t - range.start) / (range.end - range.start)));
}
