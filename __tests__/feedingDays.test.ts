import {
  averageIntervalMin, dayLabel, feedsVsYesterday, foodChoices, gapsById, groupByDay, quickAmounts, recentFoods, stepMl, totals,
} from "@/lib/baby/feedingDays";
import type { FeedingEntry } from "@/lib/state/babyTypes";

const life = { createdAt: "", updatedAt: "", editCount: 0, deletedAt: null as string | null, archivedAt: null as string | null };
const feed = (id: string, at: Date, type: FeedingEntry["type"] = "bottle", extra: Partial<FeedingEntry> = {}): FeedingEntry =>
  ({ ...life, id, at: at.toISOString(), type, amountMl: null, durationMin: null, side: null, foodCategory: null, note: "", ...extra }) as FeedingEntry;

// Ora lokale, që ditët të ndahen njësoj në çdo zonë kohore.
const at = (d: number, h: number, m = 0) => new Date(2026, 10, d, h, m);

describe("llogaritjet e ushqyerjes", () => {
  it("totalet: ml vetëm nga biberoni/formula, minutat nga gjiri; uji dhe ilaçi s'janë ushqyerje", () => {
    const sum = totals([
      feed("a", at(3, 8), "bottle", { amountMl: 120 }),
      feed("b", at(3, 11), "formula", { amountMl: 90 }),
      feed("c", at(3, 14), "breast", { durationMin: 15 }),
      feed("d", at(3, 15), "water", { amountMl: 30 }),
      feed("e", at(3, 16), "medicine", { amountMl: 5 }),
      feed("f", at(3, 18), "solid"),
    ]);
    expect(sum).toEqual({ feeds: 4, ml: 210, breastMin: 15, solids: 1 });
  });

  it("grupon sipas ditës, më e reja e para", () => {
    const days = groupByDay([feed("a", at(2, 23)), feed("b", at(3, 1)), feed("c", at(3, 9)), feed("d", at(1, 12))]);
    expect(days.map((d) => d.entries.map((e) => e.id))).toEqual([["c", "b"], ["a"], ["d"]]);
    expect(days[0].totals.feeds).toBe(2);
  });

  it("intervali mesatar bashkon seancat (brenda 20 min) dhe s'merr boshllëqet mbi 8 orë", () => {
    const list = [
      feed("a", at(3, 6), "breast"),
      feed("b", at(3, 6, 10), "bottle"), // e njëjta seancë
      feed("c", at(3, 9), "bottle"),
      feed("d", at(3, 12), "bottle"),
      feed("e", at(3, 23), "bottle"), // 11 orë: shënime që mungojnë
    ];
    expect(averageIntervalMin(list)).toBe(180);
    expect(averageIntervalMin([feed("a", at(3, 6))])).toBeNull();
  });

  it("minutat nga ushqyerja e mëparshme, pa ujë/ilaç dhe pa boshllëqe mbi 12 orë", () => {
    const gaps = gapsById([feed("a", at(3, 6)), feed("w", at(3, 7), "water"), feed("b", at(3, 8, 30)), feed("c", at(4, 9))]);
    expect(gaps.get("b")).toBe(150);
    expect(gaps.has("w")).toBe(false);
    expect(gaps.has("c")).toBe(false);
  });

  it("sot kundrejt dje deri në të njëjtën orë; null kur dje s'ka shënime", () => {
    const now = at(3, 12);
    const list = [feed("y1", at(2, 7)), feed("y2", at(2, 10)), feed("y3", at(2, 18)), feed("t1", at(3, 7)), feed("t2", at(3, 9)), feed("t3", at(3, 11))];
    expect(feedsVsYesterday(list, now)).toBe(1);
    expect(feedsVsYesterday([feed("t1", at(3, 7))], now)).toBeNull();
  });

  it("ushqimet e fundit pa përsëritje, pastaj të zakonshmit", () => {
    const list = [
      feed("a", at(3, 12), "solid", { foodCategory: "Karotë, Patate" }),
      feed("b", at(3, 8), "solid", { foodCategory: "karotë, Mollë" }),
      feed("c", at(3, 9), "bottle"),
    ];
    const recent = recentFoods(list);
    expect(recent).toEqual(["Karotë", "Patate", "Mollë"]);
    expect(foodChoices(recent, ["Kos", "mollë", "Mish"])).toEqual(["Karotë", "Patate", "Mollë", "Kos", "Mish"]);
  });

  it("sasitë e shpejta dhe hapi i − / +", () => {
    expect(quickAmounts(null)).toEqual([60, 90, 120, 150, 180]);
    expect(quickAmounts(100)).toEqual([60, 90, 100, 120, 150, 180]);
    expect(quickAmounts(120)).toEqual([60, 90, 120, 150, 180]);
    expect(stepMl(90, 1)).toBe(100);
    expect(stepMl(95, 1)).toBe(100);
    expect(stepMl(90, -1)).toBe(80);
    expect(stepMl(30, -1)).toBe(25);
    expect(stepMl(25, 1)).toBe(30);
    expect(stepMl(0, -1)).toBe(0);
    expect(stepMl(400, 1)).toBe(400);
  });

  it("emri i ditës: Sot, Dje, pastaj dita e javës me datë", () => {
    const now = at(3, 12);
    const words = { today: "Sot", yesterday: "Dje" };
    expect(dayLabel(at(3, 0), now, "sq", words)).toBe("Sot");
    expect(dayLabel(at(2, 0), now, "sq", words)).toBe("Dje");
    expect(dayLabel(at(1, 0), now, "sq", words)).toBe("E diel, 1 nëntor");
    expect(dayLabel(at(1, 0), now, "en", words)).toBe("Sunday, 1 November");
    expect(dayLabel(new Date(2025, 11, 31), now, "sq", words)).toBe("E mërkurë, 31 dhjetor 2025");
  });
});
