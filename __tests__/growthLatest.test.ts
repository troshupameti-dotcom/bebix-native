import { latestGrowth, parseMeasure } from "@/lib/baby/growthLatest";
import type { GrowthHistoryEntry } from "@/lib/state/babyTypes";

const entry = (id: string, date: string, w: number | null, h: number | null, extra: Partial<GrowthHistoryEntry> = {}): GrowthHistoryEntry => ({
  id, date, weightKg: w, heightCm: h, headCm: null, note: "",
  createdAt: date, updatedAt: date, editCount: 0, deletedAt: null, archivedAt: null, ...extra,
});

describe("rritja e fundit", () => {
  it("merr matjen më të re dhe ndryshimin nga e mëparshmja", () => {
    const g = latestGrowth([
      entry("1", "2026-08-01T10:00:00Z", 5.2, 58),
      entry("2", "2026-09-01T10:00:00Z", 5.9, 61.5),
    ]);
    expect(g.weight).toEqual({ value: 5.9, date: "2026-09-01T10:00:00Z", delta: 0.7 });
    expect(g.height?.delta).toBe(3.5);
  });

  it("pesha dhe gjatësia mund të jenë në matje të ndryshme", () => {
    const g = latestGrowth([
      entry("1", "2026-08-01T10:00:00Z", null, 58),
      entry("2", "2026-09-01T10:00:00Z", 6.1, null),
    ]);
    expect(g.weight?.value).toBe(6.1);
    expect(g.weight?.delta).toBeNull();
    expect(g.height?.value).toBe(58);
  });

  it("injoron matjet e fshira", () => {
    const g = latestGrowth([
      entry("1", "2026-08-01T10:00:00Z", 5, null),
      entry("2", "2026-09-01T10:00:00Z", 9, null, { deletedAt: "2026-09-02T00:00:00Z" }),
    ]);
    expect(g.weight?.value).toBe(5);
  });

  it("bosh kur s'ka matje", () => {
    expect(latestGrowth([])).toEqual({ weight: null, height: null, head: null });
  });
});

describe("leximi i vlerës", () => {
  it("pranon pikën dhe presjen", () => {
    expect(parseMeasure("3.45")).toBe(3.45);
    expect(parseMeasure(" 3,45 ")).toBe(3.45);
  });
  it("refuzon tekstin dhe zeron", () => {
    expect(parseMeasure("abc")).toBeNull();
    expect(parseMeasure("0")).toBeNull();
  });
});
