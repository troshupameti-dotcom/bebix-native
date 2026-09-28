import type { GrowthHistoryEntry } from "@/lib/state/babyTypes";

export type GrowthMetric = "weight" | "height";

export type ChartPoint = { id: string; date: string; value: number; x: number; y: number };

export type GrowthSeries = {
  points: ChartPoint[];
  /** Kufijtë e boshtit vertikal (me pak hapësirë sipër e poshtë). */
  min: number;
  max: number;
  /** Rruga SVG e vijës dhe e sipërfaqes nën të. */
  line: string;
  area: string;
};

const FIELD: Record<GrowthMetric, "weightKg" | "heightCm"> = { weight: "weightKg", height: "heightCm" };

/** Matjet e një madhësie, nga më e vjetra te më e reja (pa të fshirat). */
export function metricHistory(history: GrowthHistoryEntry[], metric: GrowthMetric): { id: string; date: string; value: number }[] {
  const field = FIELD[metric];
  return history
    .filter((e) => !e.deletedAt && !e.archivedAt && typeof e[field] === "number" && Number.isFinite(e[field]))
    .map((e) => ({ id: e.id, date: e.date, value: e[field] as number }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/**
 * Pikat e grafikut. Boshti horizontal ndjek DATËN e vërtetë (dy matje një javë
 * larg rrinë afër, dy matje dy muaj larg rrinë larg), jo radhën: përndryshe
 * rritja duket e rregullt edhe kur s'është.
 */
export function buildSeries(
  history: GrowthHistoryEntry[],
  metric: GrowthMetric,
  width: number,
  height: number,
  pad = 8
): GrowthSeries {
  const items = metricHistory(history, metric);
  if (items.length === 0) return { points: [], min: 0, max: 0, line: "", area: "" };

  const values = items.map((i) => i.value);
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const spread = hi - lo || Math.max(1, hi * 0.1);
  const min = lo - spread * 0.2;
  const max = hi + spread * 0.2;

  const t0 = new Date(items[0].date).getTime();
  const t1 = new Date(items[items.length - 1].date).getTime();
  const span = t1 - t0;

  const points = items.map((item, index) => {
    const t = new Date(item.date).getTime();
    const fx = span > 0 ? (t - t0) / span : items.length === 1 ? 0.5 : index / (items.length - 1);
    const x = pad + fx * (width - 2 * pad);
    const y = pad + (1 - (item.value - min) / (max - min)) * (height - 2 * pad);
    return { ...item, x: round(x), y: round(y) };
  });

  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
  const area =
    points.length > 1
      ? `${line} L${points[points.length - 1].x},${height} L${points[0].x},${height} Z`
      : "";
  return { points, min, max, line, area };
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}
