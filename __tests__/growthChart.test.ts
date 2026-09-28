import { buildSeries, metricHistory } from "@/lib/baby/growthChart";
import type { GrowthHistoryEntry } from "@/lib/state/babyTypes";

const e = (id: string, date: string, w: number | null, h: number | null): GrowthHistoryEntry => ({
  id, date, weightKg: w, heightCm: h, headCm: null, note: "",
  createdAt: date, updatedAt: date, editCount: 0, deletedAt: null, archivedAt: null,
});

const history = [
  e("a", "2026-06-01T00:00:00Z", 4, 55),
  e("b", "2026-06-08T00:00:00Z", 4.3, null),
  e("c", "2026-08-01T00:00:00Z", 5.5, 60),
];

describe("grafiku i rritjes", () => {
  it("pesha dhe gjatësia japin seri të ndryshme", () => {
    expect(metricHistory(history, "weight").map((p) => p.value)).toEqual([4, 4.3, 5.5]);
    expect(metricHistory(history, "height").map((p) => p.value)).toEqual([55, 60]);
  });

  it("boshti horizontal ndjek datën, jo radhën", () => {
    const { points } = buildSeries(history, "weight", 208, 100, 4);
    // 1 qershor → 4, 8 qershor pak më djathtas, 1 gusht në fund.
    expect(points[0].x).toBe(4);
    expect(points[2].x).toBe(204);
    expect(points[1].x).toBeLessThan(40);
  });

  it("vlera më e madhe është më lart", () => {
    const { points } = buildSeries(history, "weight", 200, 100);
    expect(points[2].y).toBeLessThan(points[0].y);
  });

  it("një matje e vetme del në mes, pa vijë", () => {
    const { points, line, area } = buildSeries([e("x", "2026-06-01T00:00:00Z", 4, null)], "weight", 200, 100, 0);
    expect(points[0].x).toBe(100);
    expect(line).toBe("M100,50");
    expect(area).toBe("");
  });
});
