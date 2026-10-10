import { compareWithYesterday, dayTotals, deltaLabel } from "@/lib/baby/dayStats";
import { translations, type TranslationKey } from "@/lib/i18n/translations";
import type { DiaperEntry, FeedingEntry, SleepEntry } from "@/lib/state/babyTypes";

jest.mock("@react-native-async-storage/async-storage", () => ({ getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn() }));

const t = (key: TranslationKey, params?: Record<string, string | number>) => {
  let s: string = translations.sq[key] ?? key;
  for (const [k, v] of Object.entries(params ?? {})) s = s.replace(`{${k}}`, String(v));
  return s;
};

const life = { createdAt: "", updatedAt: "", editCount: 0, deletedAt: null, archivedAt: null };
let n = 0;
const at = (d: number, h: number, m = 0) => new Date(2026, 9, d, h, m);
const feed = (when: Date, type: FeedingEntry["type"] = "bottle"): FeedingEntry =>
  ({ ...life, id: `f${n++}`, at: when.toISOString(), type, amountMl: null, durationMin: null, side: null, foodCategory: null, note: "" }) as FeedingEntry;
const diaper = (when: Date): DiaperEntry => ({ ...life, id: `d${n++}`, at: when.toISOString(), type: "wet", color: null, consistency: null, note: "" }) as DiaperEntry;
const sleep = (from: Date, to: Date | null, pausedAt: Date | null = null): SleepEntry =>
  ({ ...life, id: `s${n++}`, startAt: from.toISOString(), endAt: to?.toISOString() ?? null, pausedIntervalsMin: 0, pausedAt: pausedAt?.toISOString() ?? null, isNap: false, quality: null, note: "" }) as SleepEntry;

describe("përmbledhja e ditës", () => {
  const NOW = at(14, 15); // 14 tetor, 15:00

  it("2 ushqime dhe 1 pelenë sot; ilaçi s'numërohet si ushqim; dje s'përzihet", () => {
    const feeds = [feed(at(14, 8)), feed(at(14, 11)), feed(at(14, 12), "medicine"), feed(at(13, 20))];
    const r = dayTotals(feeds, [], [diaper(at(14, 9)), diaper(at(13, 22))], NOW, NOW);
    expect(r).toEqual({ feedings: 2, diapers: 1, sleepMinutes: 0 });
  });

  it("gjumi mbi mesnatë: vetëm pjesa e sotme", () => {
    const night = sleep(at(13, 22), at(14, 6)); // 8 orë, 6 prej tyre sot
    expect(dayTotals([], [night], [], NOW, NOW).sleepMinutes).toBe(6 * 60);
    expect(dayTotals([], [night], [], at(13, 12), at(14, 0)).sleepMinutes).toBe(2 * 60);
  });

  it("gjumi aktiv numërohet deri tani; i pauzuar, deri te pauza", () => {
    expect(dayTotals([], [sleep(at(14, 13), null)], [], NOW, NOW).sleepMinutes).toBe(120);
    expect(dayTotals([], [sleep(at(14, 13), null, at(14, 14))], [], NOW, NOW).sleepMinutes).toBe(60);
  });

  it("krahasimi me dje në të njëjtën orë; pa të dhëna dje, pa krahasim", () => {
    const feeds = [feed(at(14, 8)), feed(at(14, 11)), feed(at(13, 9)), feed(at(13, 20))]; // dje deri 15:00: 1
    const sleeps = [sleep(at(14, 13), at(14, 14)), sleep(at(13, 13), at(13, 14, 30))];
    const r = compareWithYesterday(feeds, sleeps, [diaper(at(14, 9))], NOW);
    expect(r.today).toEqual({ feedings: 2, diapers: 1, sleepMinutes: 60 });
    expect(r.delta).toEqual({ feedings: 1, diapers: null, sleepMinutes: -30 });
  });

  it("ditë pa asnjë shënim: zero, pa krahasime", () => {
    const r = compareWithYesterday([], [], [], NOW);
    expect(r.today).toEqual({ feedings: 0, diapers: 0, sleepMinutes: 0 });
    expect(r.delta).toEqual({ feedings: null, diapers: null, sleepMinutes: null });
  });

  it("tekstet: +1 nga dje, −30 min nga dje, njësoj si dje", () => {
    expect(deltaLabel(1, "count", t)).toBe("+1 nga dje");
    expect(deltaLabel(-30, "minutes", t)).toBe("−30 min nga dje");
    expect(deltaLabel(0, "count", t)).toBe("njësoj si dje");
    expect(deltaLabel(90, "minutes", t)).toMatch(/^\+1/);
  });
});
