import { LOW_DAYS, type DiaperStockEstimate } from "@/lib/baby/diaperStock";

/**
 * Dyqani që "lexon mendjen": një kartë e vetme sugjerimi, sipas radhës së
 * rëndësisë — pelenat po mbarojnë → koha për madhësinë tjetër → diçka që i
 * përshtatet moshës. Çdo kartë mbyllet dhe s'del sërish për një kohë.
 * Asnjë njoftim: sugjerimet e dyqanit rrinë vetëm në app.
 */

// --- Madhësitë e pelenave -------------------------------------------------

export type DiaperSize = { size: number; minKg: number; maxKg: number };

/** Intervalet e zakonshme sipas peshës (markat ndryshojnë pak; orientuese). */
export const DIAPER_SIZES: DiaperSize[] = [
  { size: 1, minKg: 2, maxKg: 5 },
  { size: 2, minKg: 4, maxKg: 8 },
  { size: 3, minKg: 6, maxKg: 10 },
  { size: 4, minKg: 9, maxKg: 14 },
  { size: 5, minKg: 11, maxKg: 16 },
  { size: 6, minKg: 13, maxKg: 18 },
  { size: 7, minKg: 15, maxKg: 25 },
];

const bySize = (n: number) => DIAPER_SIZES.find((s) => s.size === n) ?? null;

/**
 * Madhësia aktuale: nga cilësimet e bebit ("Madhësia e pelenës"), ose nga emri
 * i pelenave të blera herën e fundit ("Pampers Premium 3 (6-10 kg)", "Nr. 4").
 */
export function currentDiaperSize(settingValue: string | null | undefined, lastItemName: string | null | undefined): DiaperSize | null {
  const fromSetting = /([1-7])/.exec(settingValue ?? "");
  if (fromSetting) return bySize(Number(fromSetting[1]));

  const name = lastItemName ?? "";
  const labelled = /(?:nr\.?|no\.?|size|madh[eë]si[ae]?|#)\s*([1-7])\b/i.exec(name);
  if (labelled) return bySize(Number(labelled[1]));

  // Intervali në kg: madhësia që i afrohet më shumë.
  const kg = /(\d{1,2})\s*[-–]\s*(\d{1,2})\s*kg/i.exec(name);
  if (kg) {
    const min = Number(kg[1]);
    const max = Number(kg[2]);
    return [...DIAPER_SIZES].sort((a, b) => Math.abs(a.minKg - min) + Math.abs(a.maxKg - max) - (Math.abs(b.minKg - min) + Math.abs(b.maxKg - max)))[0];
  }
  return null;
}

export type SizeUpHint = { current: DiaperSize; next: DiaperSize; weightKg: number; urgent: boolean };

/** Sa afër kufirit të sipërm (kg) quhet "së shpejti". */
export const SIZE_UP_MARGIN_KG = 0.5;

/** Pesha po i afrohet (ose e ka kaluar) kufirit të madhësisë aktuale → madhësia tjetër. */
export function sizeUpHint(current: DiaperSize | null, weightKg: number | null | undefined): SizeUpHint | null {
  if (!current || weightKg == null || !Number.isFinite(weightKg)) return null;
  const next = bySize(current.size + 1);
  if (!next || weightKg < current.maxKg - SIZE_UP_MARGIN_KG) return null;
  return { current, next, weightKg, urgent: weightKg >= current.maxKg };
}

// --- Pelenat po mbarojnë --------------------------------------------------

/** E njëjta prag si karta e stokut te Pelenat (dërgesa zgjat 1–3 ditë). */
export const REORDER_DAYS = LOW_DAYS;

export type DiaperPrompt = { daysLeft: number; left: number };

export function diaperPrompt(estimate: DiaperStockEstimate | null): DiaperPrompt | null {
  if (!estimate) return null;
  if (estimate.daysLeft !== null && estimate.daysLeft <= REORDER_DAYS) return { daysLeft: Math.max(0, Math.round(estimate.daysLeft)), left: estimate.left };
  if (estimate.daysLeft === null && estimate.low) return { daysLeft: 0, left: estimate.left };
  return null;
}

// --- Sipas moshës ----------------------------------------------------------

export type AgeProduct = {
  id: string;
  name: string;
  minAgeMonths?: number | null;
  maxAgeMonths?: number | null;
  stock?: number;
  rating?: number;
};

const DIAPER_PATTERN = /pelen|diaper|pampers|huggies|libero|mamypoko/i;

/**
 * Produkti më i përshtatshëm për moshën: vetëm ato me kufi moshe (jo "për të
 * gjithë"), në stok, jo pelena, jo të blera dhe jo të mbyllura. Para dalin ato
 * që sapo i përshtaten moshës ("tani që mbushi 6 muaj"), pastaj vlerësimi.
 */
export function pickAgeProduct<T extends AgeProduct>(products: T[], months: number | null, purchased: ReadonlySet<string>, dismissed: ReadonlySet<string>): T | null {
  if (months == null) return null;
  const fits = products.filter(
    (p) =>
      (p.minAgeMonths != null || p.maxAgeMonths != null) &&
      (p.minAgeMonths == null || p.minAgeMonths <= months) &&
      (p.maxAgeMonths == null || p.maxAgeMonths >= months) &&
      (p.stock ?? 0) > 0 &&
      !DIAPER_PATTERN.test(p.name) &&
      !purchased.has(p.id) &&
      !dismissed.has(`product:${p.id}`)
  );
  const freshness = (p: AgeProduct) => (p.minAgeMonths == null ? 99 : months - p.minAgeMonths);
  return fits.sort((a, b) => freshness(a) - freshness(b) || (b.rating ?? 0) - (a.rating ?? 0))[0] ?? null;
}

// --- Një kartë e vetme ----------------------------------------------------

export type Suggestion<P> =
  | { kind: "diaper"; key: string; prompt: DiaperPrompt }
  | { kind: "size"; key: string; hint: SizeUpHint }
  | { kind: "product"; key: string; product: P };

/** Sa kohë s'del sërish një kartë e mbyllur. */
export const SNOOZE_MS = { diaper: 86_400_000, size: 7 * 86_400_000, product: 30 * 86_400_000 } as const;

/** Mbylljet e ruajtura: çelës → deri kur. Të skaduarat hiqen. */
export function activeDismissals(stored: Record<string, string>, now: Date): Set<string> {
  return new Set(Object.entries(stored).filter(([, until]) => new Date(until).getTime() > now.getTime()).map(([k]) => k));
}

export function chooseSuggestion<P extends { id: string }>(input: {
  diaper: DiaperPrompt | null;
  /** Çelësi i stokut aktual (data e vendosjes), që mbyllja të vlejë vetëm për këtë paketë. */
  stockKey: string | null;
  size: SizeUpHint | null;
  product: P | null;
  dismissed: ReadonlySet<string>;
}): Suggestion<P> | null {
  const { diaper, size, product, dismissed } = input;
  if (diaper) {
    const key = `diaper:${input.stockKey ?? "none"}`;
    if (!dismissed.has(key)) return { kind: "diaper", key, prompt: diaper };
  }
  if (size) {
    const key = `size:${size.next.size}`;
    if (!dismissed.has(key)) return { kind: "size", key, hint: size };
  }
  if (product) {
    const key = `product:${product.id}`;
    if (!dismissed.has(key)) return { kind: "product", key, product };
  }
  return null;
}
