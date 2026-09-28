import type { GrowthHistoryEntry } from "@/lib/state/babyTypes";

export type LatestMeasure = {
  /** Vlera e matjes më të fundit. */
  value: number;
  /** Data e asaj matjeje (ISO). */
  date: string;
  /** Ndryshimi nga matja e mëparshme e së njëjtës madhësi; null kur s'ka të mëparshme. */
  delta: number | null;
};

export type LatestGrowth = {
  weight: LatestMeasure | null;
  height: LatestMeasure | null;
  head: LatestMeasure | null;
};

type Field = "weightKg" | "heightCm" | "headCm";

function latestOf(entries: GrowthHistoryEntry[], field: Field): LatestMeasure | null {
  const withValue = entries
    .filter((e) => typeof e[field] === "number" && Number.isFinite(e[field]))
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  const [last, prev] = withValue;
  if (!last) return null;
  const value = last[field] as number;
  return {
    value,
    date: last.date,
    delta: prev ? Math.round((value - (prev[field] as number)) * 100) / 100 : null,
  };
}

/**
 * Pesha, gjatësia dhe koka e fundit, nga historiku i rritjes.
 *
 * Kartat e rritjes më parë mbanin vlerën e tyre veç, vetëm në telefon: pas
 * rimarrjes së të dhënave nga llogaria (telefon i ri, familja, ri-instalim)
 * dilnin bosh, edhe pse matja ishte e ruajtur. Historiku sinkronizohet, prandaj
 * kartat lexojnë prej tij.
 */
export function latestGrowth(history: GrowthHistoryEntry[]): LatestGrowth {
  const live = history.filter((e) => !e.deletedAt && !e.archivedAt);
  return {
    weight: latestOf(live, "weightKg"),
    height: latestOf(live, "heightCm"),
    head: latestOf(live, "headCm"),
  };
}

/** "3.45" → 3.45; pranon edhe presjen ("3,45"). Kthen null për tekst të pavlefshëm ose ≤ 0. */
export function parseMeasure(text: string): number | null {
  const n = parseFloat(text.trim().replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
}
