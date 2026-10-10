import { buildWeeklyRecap, mondayOf, showRecapCard, weekStats } from "@/lib/baby/weeklyRecap";
import type { DiaperEntry, FeedingEntry, SleepEntry } from "@/lib/state/babyTypes";

const life = { createdAt: "", updatedAt: "", editCount: 0, deletedAt: null as string | null, archivedAt: null as string | null };
let n = 0;
const feed = (at: Date): FeedingEntry =>
  ({ ...life, id: `f${n++}`, at: at.toISOString(), type: "bottle", amountMl: null, durationMin: null, side: null, foodCategory: null, note: "" }) as FeedingEntry;
const diaper = (at: Date): DiaperEntry => ({ ...life, id: `d${n++}`, at: at.toISOString(), type: "wet", color: null, consistency: null, note: "" }) as DiaperEntry;
const sleep = (start: Date, minutes: number, isNap: boolean): SleepEntry =>
  ({
    ...life, id: `s${n++}`, startAt: start.toISOString(), endAt: new Date(start.getTime() + minutes * 60_000).toISOString(),
    pausedIntervalsMin: 0, pausedAt: null, isNap, quality: null, note: "",
  }) as SleepEntry;

const at = (d: number, h: number) => new Date(2026, 9, d, h);

/** Java që nis të hënën `monday` (tetor 2026): 6 ushqyerje, 5 pelena, gjumë nate `nightMin`. */
function week(monday: number, nightMin: number) {
  const feedingLog: FeedingEntry[] = [];
  const diaperLog: DiaperEntry[] = [];
  const sleepLog: SleepEntry[] = [];
  for (let i = 0; i < 7; i++) {
    const d = monday + i;
    for (let h = 7; h < 19; h += 2) feedingLog.push(feed(at(d, h)));
    for (let h = 8; h < 18; h += 2) diaperLog.push(diaper(at(d, h)));
    sleepLog.push(sleep(at(d, 21), nightMin, false));
    sleepLog.push(sleep(at(d, 13), 60, true));
  }
  return { feedingLog, diaperLog, sleepLog };
}

const merge = (...ws: ReturnType<typeof week>[]) => ({
  feedingLog: ws.flatMap((w) => w.feedingLog),
  diaperLog: ws.flatMap((w) => w.diaperLog),
  sleepLog: ws.flatMap((w) => w.sleepLog),
});

describe("përmbledhja e javës", () => {
  it("e hëna e javës", () => {
    expect(mondayOf(new Date(2026, 9, 10)).getDate()).toBe(5); // e shtunë → e hëna 5
    expect(mondayOf(new Date(2026, 9, 12)).getDate()).toBe(12); // e hëna
    expect(mondayOf(new Date(2026, 9, 11)).getDate()).toBe(5); // e diel
  });

  it("mesataret e javës", () => {
    const s = weekStats(week(5, 600), new Date(2026, 9, 5));
    expect(s).toEqual({ days: 7, feedingsPerDay: 6, diapersPerDay: 5, nightSleepMin: 600, sleepPerDayMin: 660, longestSleepMin: 600 });
  });

  it("gjumi i natës +40 min del si lajm i mirë", () => {
    // java e kaluar (5–11 tetor) kundrejt asaj para saj (28 shtator–4 tetor: dita -2 e tetorit)
    const recap = buildWeeklyRecap(merge(week(-2, 560), week(5, 600)), new Date(2026, 9, 12, 9))!;
    expect(recap.weekKey).toBe("2026-10-05");
    expect(recap.highlights).toEqual([
      { kind: "night_sleep_up", deltaMin: 40 },
      { kind: "longest_sleep_up", minutes: 600 },
    ]);
  });

  it("kur gjumi bie, s'ka asnjë 'më pak' — vetëm mesataret neutrale", () => {
    const recap = buildWeeklyRecap(merge(week(-2, 640), week(5, 600)), new Date(2026, 9, 12, 9))!;
    expect(recap.highlights).toEqual([]);
    expect(recap.stats.feedingsPerDay).toBe(6);
  });

  it("pa javën e mëparshme: pa krahasim; pa të paktën 3 ditë: pa kartë", () => {
    const recap = buildWeeklyRecap(week(5, 600), new Date(2026, 9, 12, 9))!;
    expect(recap.previous).toBeNull();
    expect(recap.highlights).toEqual([]);
    const sparse = { feedingLog: [feed(at(6, 9)), feed(at(7, 9))], diaperLog: [], sleepLog: [] };
    expect(buildWeeklyRecap(sparse, new Date(2026, 9, 12, 9))).toBeNull();
  });

  it("karta del e hënë–e mërkurë, derisa të mbyllet", () => {
    const recap = buildWeeklyRecap(week(5, 600), new Date(2026, 9, 12, 9));
    expect(showRecapCard(new Date(2026, 9, 12, 9), null, recap)).toBe(true);
    expect(showRecapCard(new Date(2026, 9, 14, 20), null, recap)).toBe(true);
    expect(showRecapCard(new Date(2026, 9, 15, 9), null, recap)).toBe(false);
    expect(showRecapCard(new Date(2026, 9, 12, 9), "2026-10-05", recap)).toBe(false);
    expect(showRecapCard(new Date(2026, 9, 12, 9), null, null)).toBe(false);
  });
});
