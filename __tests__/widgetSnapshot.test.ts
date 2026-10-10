import { buildSnapshot, parseSnapshot, sameSnapshot } from "@/lib/widgets/snapshot";
import { clockLabel, diaperLabel, feedingLabel, wt } from "@/lib/widgets/texts";
import type { DiaperEntry, FeedingEntry, SleepEntry } from "@/lib/state/babyTypes";

jest.mock("@react-native-async-storage/async-storage", () => ({ getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn() }));

const life = { createdAt: "", updatedAt: "", editCount: 0, deletedAt: null as string | null, archivedAt: null as string | null };
const feed = (id: string, at: string, type: FeedingEntry["type"] = "bottle", extra: Partial<FeedingEntry> = {}): FeedingEntry =>
  ({ ...life, id, at, type, amountMl: null, durationMin: null, side: null, foodCategory: null, note: "", ...extra }) as FeedingEntry;
const diaper = (id: string, at: string, type: DiaperEntry["type"] = "wet"): DiaperEntry =>
  ({ ...life, id, at, type, color: null, consistency: null, note: "" }) as DiaperEntry;
const sleep = (id: string, startAt: string, endAt: string | null): SleepEntry =>
  ({ ...life, id, startAt, endAt, pausedIntervalsMin: 0, pausedAt: null, isNap: true, quality: null, note: "" }) as SleepEntry;

const NOW = new Date("2026-10-10T12:00:00Z");
const base = { lang: "sq" as const, babyName: "  Ana ", feedingLog: [], diaperLog: [], sleepLog: [], breastTimer: null, now: NOW };

describe("pamja e widget-it", () => {
  it("merr shënimin e fundit të çdo lloji, pa të fshirat dhe të arkivuarat", () => {
    const s = buildSnapshot({
      ...base,
      feedingLog: [
        feed("f1", "2026-10-10T08:00:00Z", "breast"),
        feed("f2", "2026-10-10T10:00:00Z", "solid", { deletedAt: "x" }),
        feed("f3", "2026-10-10T09:00:00Z", "bottle"),
      ],
      diaperLog: [diaper("d1", "2026-10-10T07:00:00Z", "dirty"), diaper("d2", "2026-10-10T11:00:00Z", "wet")],
    });
    expect(s.babyName).toBe("Ana");
    expect(s.feeding).toEqual({ at: "2026-10-10T09:00:00Z", type: "bottle" });
    expect(s.diaper).toEqual({ at: "2026-10-10T11:00:00Z", type: "wet" });
    expect(s.sleep).toBeNull();
  });

  it("gjumi në vazhdim dhe zgjimi i fundit", () => {
    const s = buildSnapshot({
      ...base,
      sleepLog: [sleep("s1", "2026-10-10T06:00:00Z", "2026-10-10T07:30:00Z"), sleep("s2", "2026-10-10T11:20:00Z", null)],
    });
    expect(s.sleep).toEqual({ id: "s2", since: "2026-10-10T11:20:00Z" });
    expect(s.lastWakeAt).toBe("2026-10-10T07:30:00Z");
  });

  it("timeri i gjirit kalon te pamja", () => {
    const s = buildSnapshot({ ...base, breastTimer: { startedAt: "2026-10-10T11:50:00Z", side: "left", sides: ["left"] } });
    expect(s.breastSince).toBe("2026-10-10T11:50:00Z");
  });

  it("pa të dhëna: pamja ekziston, por bosh (widget-i tregon 'Ende asgjë')", () => {
    const s = buildSnapshot({ ...base, babyName: null });
    expect(s).toMatchObject({ babyName: null, feeding: null, diaper: null, sleep: null, lastWakeAt: null, breastSince: null });
  });

  it("ruhet dhe lexohet; e prishur ose e versionit tjetër hidhet", () => {
    const s = buildSnapshot(base);
    expect(parseSnapshot(JSON.stringify(s))).toEqual(s);
    expect(parseSnapshot("{prishur")).toBeNull();
    expect(parseSnapshot(JSON.stringify({ ...s, v: 2 }))).toBeNull();
    expect(parseSnapshot(null)).toBeNull();
  });

  it("vetëm ora e përditësimit s'llogaritet si ndryshim", () => {
    const a = buildSnapshot(base);
    const b = buildSnapshot({ ...base, now: new Date(NOW.getTime() + 60000) });
    expect(sameSnapshot(a, b)).toBe(true);
    expect(sameSnapshot(a, { ...a, lang: "en" })).toBe(false);
    expect(sameSnapshot(null, a)).toBe(false);
  });
});

describe("tekstet e widget-it", () => {
  it("sq dhe en, me llojet e ushqimit dhe pelenës", () => {
    expect(wt("sq", "widget_sleep")).toBe("Gjumi");
    expect(wt("en", "widget_sleep")).toBe("Sleep");
    expect(feedingLabel("sq", "breast")).toBe("Gji");
    expect(feedingLabel("en", "medicine")).toBe("Medicine");
    expect(diaperLabel("sq", "dirty")).toBe("Bajga");
    expect(diaperLabel("en", "both")).toBe("Both");
  });

  it("ora: vetëm HH:MM sot, me datë për ditët e tjera", () => {
    const now = new Date(2026, 9, 10, 15, 0);
    expect(clockLabel(new Date(2026, 9, 10, 9, 5).toISOString(), now)).toBe("09:05");
    expect(clockLabel(new Date(2026, 9, 9, 22, 10).toISOString(), now)).toBe("09.10 22:10");
    expect(clockLabel("jo-datë", now)).toBe("");
  });
});
