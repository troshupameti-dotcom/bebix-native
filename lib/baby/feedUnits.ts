import { useEffect, useSyncExternalStore } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { TranslationKey } from "@/lib/i18n/translations";

/**
 * Njësitë e sasisë te ushqyerja. Shishja ruhet gjithmonë në ml (`amountMl`), që totalet e ditës të mbeten të sakta;
 * oz është vetëm mënyra si shfaqet dhe shkruhet. Ushqimi i ngurtë ruan sasinë dhe njësinë ashtu siç i zgjodhi prindi
 * (g, oz ose lugë), sepse lugët s'kthehen dot saktë në gramë.
 * Zgjedhja e njësive mbahet në telefon, njësoj për çdo fëmijë.
 */
export type VolumeUnit = "ml" | "oz";
export type SolidUnit = "g" | "oz" | "spoon";

export const VOLUME_UNITS: VolumeUnit[] = ["ml", "oz"];
export const SOLID_UNITS: SolidUnit[] = ["g", "oz", "spoon"];

export const ML_PER_OZ = 29.5735;
/** Kufijtë e fushave: aq sa s'ka kuptim të kalohen në një vakt. */
export const SOLID_MAX: Record<SolidUnit, number> = { g: 500, oz: 18, spoon: 20 };
const SOLID_STEP: Record<SolidUnit, number> = { g: 10, oz: 0.5, spoon: 1 };
export const OZ_QUICK = [2, 3, 4, 5, 6, 8];

/** Një shifër pas presjes, pa zero të tepërta (3, 3.5). */
const oneDecimal = (n: number) => Math.round(n * 10) / 10;

export function mlToOz(ml: number): number {
  return oneDecimal(ml / ML_PER_OZ);
}
export function ozToMl(oz: number): number {
  return Math.round(oz * ML_PER_OZ);
}

/** Numri sipas gjuhës: 3,5 në shqip dhe 3.5 në anglisht. */
export function formatNumber(n: number, lang: string): string {
  const s = String(oneDecimal(n));
  return lang === "en" ? s : s.replace(".", ",");
}

/** Leximi i një numri të shkruar me presje ose pikë. Kthen null kur s'ka numër. */
export function parseAmount(text: string): number | null {
  const clean = text.replace(",", ".").replace(/[^0-9.]/g, "");
  if (!clean) return null;
  const n = Number(clean);
  return Number.isFinite(n) ? n : null;
}

/** Sasia e shishes si tekst, në njësinë e zgjedhur. */
export function volumeText(ml: number, unit: VolumeUnit, lang: string): string {
  return unit === "oz" ? `${formatNumber(mlToOz(ml), lang)} oz` : `${Math.round(ml)} ml`;
}

/** Hapi i butonave − / + te shishja në oz: gjysmë oz. */
export function stepOz(ml: number, dir: 1 | -1, maxMl: number): number {
  const oz = mlToOz(ml);
  const next = dir === 1 ? Math.floor(oz * 2 + 1e-6) / 2 + 0.5 : Math.ceil(oz * 2 - 1e-6) / 2 - 0.5;
  return Math.max(0, Math.min(maxMl, ozToMl(next)));
}

/** Hapi i butonave − / + te ushqimi i ngurtë. */
export function stepSolid(amount: number | null, unit: SolidUnit, dir: 1 | -1): number {
  const step = SOLID_STEP[unit];
  const cur = amount ?? 0;
  const next = dir === 1 ? Math.floor(cur / step + 1e-6) * step + step : Math.ceil(cur / step - 1e-6) * step - step;
  return Math.max(0, Math.min(SOLID_MAX[unit], oneDecimal(next)));
}

/** Sasia e ushqimit si tekst: "40 g", "1,5 oz", "3 lugë". */
export function solidAmountText(amount: number, unit: SolidUnit, lang: string, t: (k: TranslationKey, p?: Record<string, string | number>) => string): string {
  const n = formatNumber(amount, lang);
  if (unit === "spoon") return amount === 1 ? t("feeding_unit_spoon_one") : t("feeding_unit_spoon", { n });
  return `${n} ${unit}`;
}

export function isSolidUnit(v: unknown): v is SolidUnit {
  return v === "g" || v === "oz" || v === "spoon";
}

// ---- Zgjedhja e njësive (në telefon) ------------------------------------------------------

export type FeedUnits = { volume: VolumeUnit; solid: SolidUnit };
const KEY = "bebix_feed_units_v1";
const DEFAULT: FeedUnits = { volume: "ml", solid: "g" };

let units: FeedUnits = DEFAULT;
let loaded = false;
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function load() {
  if (loaded || loading) return;
  loading = AsyncStorage.getItem(KEY)
    .then((raw) => {
      const v = raw ? (JSON.parse(raw) as Partial<FeedUnits>) : {};
      units = {
        volume: v.volume === "oz" ? "oz" : "ml",
        solid: isSolidUnit(v.solid) ? v.solid : "g",
      };
    })
    .catch(() => {})
    .finally(() => {
      loaded = true;
      loading = null;
      emit();
    });
}

export function setFeedUnits(patch: Partial<FeedUnits>) {
  units = { ...units, ...patch };
  loaded = true;
  emit();
  void AsyncStorage.setItem(KEY, JSON.stringify(units)).catch(() => {});
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}
const snapshot = () => units;

export function useFeedUnits(): FeedUnits {
  useEffect(load, []);
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

export function __resetFeedUnitsForTests() {
  units = DEFAULT;
  loaded = false;
  loading = null;
}
