import { ageWakeWindow, buildPredictions, predictNextFeeding, predictNextSleep, predictNextWake } from "@/lib/baby/predictions";
import type { FeedingEntry, SleepEntry } from "@/lib/state/babyTypes";

const life = { createdAt: "", updatedAt: "", editCount: 0, deletedAt: null as string | null, archivedAt: null as string | null };
let n = 0;
const feed = (at: Date, type: FeedingEntry["type"] = "bottle"): FeedingEntry =>
  ({ ...life, id: `f${n++}`, at: at.toISOString(), type, amountMl: null, durationMin: null, side: null, foodCategory: null, note: "" }) as FeedingEntry;
const sleep = (start: Date, end: Date | null, isNap = true): SleepEntry =>
  ({ ...life, id: `s${n++}`, startAt: start.toISOString(), endAt: end?.toISOString() ?? null, pausedIntervalsMin: 0, pausedAt: null, isNap, quality: null, note: "" }) as SleepEntry;

const H = 3600_000;
const M = 60_000;
/** E shtunë 10 tetor 2026, ora lokale. */
const day = (d: number, h: number, m = 0) => new Date(2026, 9, d, h, m);

/** Ushqyerje çdo 3 orë gjatë ditës (07–19) për disa ditë. */
function dayFeeds(days: number[], every = 3) {
  const out: FeedingEntry[] = [];
  for (const d of days) for (let h = 7; h <= 19; h += every) out.push(feed(day(d, h)));
  return out;
}

describe("ushqyerja tjetër", () => {
  it("nga ritmi i bebit: e fundit + intervali tipik", () => {
    const log = dayFeeds([6, 7, 8, 9, 10]).filter((f) => new Date(f.at) <= day(10, 13));
    const p = predictNextFeeding(log, day(10, 14))!;
    expect(new Date(p.at).getTime()).toBe(day(10, 16).getTime());
    expect(p.basis).toBe("own");
    expect(p.plusMinusMin).toBe(10);
    expect(p.due).toBe(false);
    expect(p.confidence).toBe("high");
  });

  it("gji majtas + djathtas brenda 20 min = një seancë; ilaçet dhe uji s'numërohen", () => {
    const base = dayFeeds([6, 7, 8, 9]);
    const extras = [feed(new Date(day(9, 19).getTime() + 10 * M)), feed(day(9, 20), "medicine"), feed(day(9, 20, 30), "water")];
    const p = predictNextFeeding([...base, ...extras], day(9, 20, 45))!;
    // nata: s'ka mjaft intervale nate, përdoren të gjitha (3 orë)
    expect(new Date(p.at).getTime()).toBe(day(9, 22).getTime());
  });

  it("pa mjaft të dhëna (një ditë, pak shënime) s'jep parashikim", () => {
    expect(predictNextFeeding(dayFeeds([10]), day(10, 20))).toBeNull();
    expect(predictNextFeeding([], day(10, 20))).toBeNull();
  });

  it("ritmi i natës veçmas kur ka mjaft netë", () => {
    const log: FeedingEntry[] = [];
    for (const d of [5, 6, 7, 8, 9]) {
      for (let h = 7; h <= 19; h += 3) log.push(feed(day(d, h)));
      log.push(feed(day(d, 23)));
      log.push(feed(day(d + 1, 3)));
    }
    // e fundit: 03:00 natën → intervali i natës 4 orë
    const p = predictNextFeeding(log.filter((f) => new Date(f.at) <= day(10, 3)), day(10, 3, 30))!;
    expect(new Date(p.at).getTime()).toBe(day(10, 7).getTime());
  });

  it("dritarja e kaluar del 'tani'; orë të tëra pas saj = asgjë (shënim i harruar)", () => {
    const log = dayFeeds([6, 7, 8, 9, 10]).filter((f) => new Date(f.at) <= day(10, 13));
    expect(predictNextFeeding(log, day(10, 15, 55))!.due).toBe(true);
    expect(predictNextFeeding(log, day(10, 19, 30))).toBeNull();
  });
});

describe("gjumi", () => {
  /** Sy gjumë 1 orë çdo ditë në 10:00 dhe 14:00 (zgjuar 3 orë mes tyre). */
  function naps(days: number[]) {
    const out: SleepEntry[] = [];
    for (const d of days) {
      out.push(sleep(day(d, 10), day(d, 11)));
      out.push(sleep(day(d, 14), day(d, 15)));
    }
    return out;
  }

  it("po fle: zgjohet zakonisht pas kohëzgjatjes tipike të sy gjumit", () => {
    const log = [...naps([6, 7, 8, 9]), sleep(day(10, 10), null)];
    const p = predictNextWake(log, day(10, 10, 20))!;
    expect(new Date(p.at).getTime()).toBe(day(10, 11).getTime());
    expect(p.samples).toBe(8);
  });

  it("zgjuar: gjumi tjetër nga dritaret e vetë bebit", () => {
    const log = [...naps([5, 6, 7, 8, 9]), sleep(day(10, 10), day(10, 11))];
    const p = predictNextSleep(log, null, day(10, 12))!;
    expect(p.basis).toBe("own");
    expect(new Date(p.at).getTime()).toBe(day(10, 14).getTime());
  });

  it("pak të dhëna: tabela e moshës, me besueshmëri mesatare", () => {
    const log = [sleep(day(10, 10), day(10, 11))];
    const dob = new Date(2026, 6, 10).toISOString(); // ~13 javë
    const p = predictNextSleep(log, dob, day(10, 11, 30))!;
    expect(p.basis).toBe("age");
    expect(p.confidence).toBe("medium");
    // 75–120 min → mesi 97.5 min pas zgjimit
    expect(new Date(p.at).getTime()).toBe(day(10, 11).getTime() + 97.5 * M);
    expect(predictNextSleep(log, null, day(10, 11, 30))).toBeNull();
  });

  it("s'parashikon kur gjumi i fundit është shumë i vjetër ose kur po fle", () => {
    const log = naps([6, 7, 8, 9]);
    expect(predictNextSleep(log, null, new Date(day(9, 15).getTime() + 9 * H))).toBeNull();
    expect(predictNextSleep([...log, sleep(day(10, 10), null)], null, day(10, 10, 30))).toBeNull();
  });
});

describe("mosha", () => {
  it("dritarja e zgjimit rritet me moshën", () => {
    const now = day(10, 12);
    expect(ageWakeWindow(new Date(2026, 9, 1).toISOString(), now)).toEqual({ minMin: 35, maxMin: 60 });
    expect(ageWakeWindow(new Date(2026, 3, 10).toISOString(), now)).toEqual({ minMin: 120, maxMin: 150 });
    expect(ageWakeWindow(new Date(2024, 9, 10).toISOString(), now)).toEqual({ minMin: 300, maxMin: 360 });
    expect(ageWakeWindow(null, now)).toBeNull();
    expect(ageWakeWindow(new Date(2027, 0, 1).toISOString(), now)).toBeNull();
  });

  it("të fshirat s'llogariten; pa të dhëna tregon 'edhe disa ditë'", () => {
    const p = buildPredictions({ feedingLog: [], sleepLog: [], diaperLog: [] }, null, day(10, 12));
    expect(p.needsMoreData).toEqual({ feeding: true, sleep: true });
    const deleted = dayFeeds([6, 7, 8, 9, 10]).map((f) => ({ ...f, deletedAt: "x" }));
    expect(predictNextFeeding(deleted, day(10, 20))).toBeNull();
  });
});
