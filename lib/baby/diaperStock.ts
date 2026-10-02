import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Pelenat e mbetura. Prindi vendos një herë sa pelena ka; Bebix i heq vetë një
 * për çdo pelenë të shënuar te ditari dhe e di kur po mbarojnë, para se të
 * mbarojnë vërtet. Ruhet vetëm në telefon (nuk është e dhënë që duhet te serveri).
 */
export type DiaperStock = { remaining: number; setAt: string };

export type DiaperStockEstimate = {
  /** Sa pelena mbeten tani (sa u vendos, minus ato të shënuara pas asaj kohe). */
  left: number;
  /** Mesatarja e përdorimit në ditë, nga ditari i fundit; null kur s'ka të dhëna. */
  perDay: number | null;
  /** Sa ditë të mjaftojnë; null kur s'ka mesatare. */
  daysLeft: number | null;
  /** A duhet porositur tani. */
  low: boolean;
};

const DAY = 86_400_000;
const KEY = "bebix_diaper_stock_v1";
/** Prag i sigurt: edhe pa mesatare, nën kaq pelena kërkon porosi. */
export const LOW_COUNT = 6;
/** Dërgesa zgjat; kur të mjaftojnë për më pak se kaq ditë, porosit. */
export const LOW_DAYS = 2;

export function estimateDiaperStock(stock: DiaperStock, entries: { at: string }[], now: number = Date.now()): DiaperStockEstimate {
  const since = new Date(stock.setAt).getTime();
  const used = entries.filter((e) => new Date(e.at).getTime() > since).length;
  const left = Math.max(0, stock.remaining - used);

  // Mesatarja: 3 ditët e fundit; kur s'ka, 7 ditët; kur s'ka, asgjë.
  const within = (days: number) => entries.filter((e) => now - new Date(e.at).getTime() <= days * DAY).length;
  const last3 = within(3);
  const last7 = within(7);
  const perDay = last3 > 0 ? last3 / 3 : last7 > 0 ? last7 / 7 : null;

  const daysLeft = perDay ? left / perDay : null;
  const low = left <= LOW_COUNT || (daysLeft !== null && daysLeft <= LOW_DAYS);
  return { left, perDay, daysLeft, low };
}

export async function loadDiaperStock(): Promise<DiaperStock | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<DiaperStock>;
    return typeof parsed.remaining === "number" && typeof parsed.setAt === "string" ? { remaining: parsed.remaining, setAt: parsed.setAt } : null;
  } catch {
    return null;
  }
}

export async function saveDiaperStock(remaining: number): Promise<DiaperStock> {
  const stock: DiaperStock = { remaining: Math.max(0, Math.min(2000, Math.round(remaining))), setAt: new Date().toISOString() };
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(stock));
  } catch {
    // Pa ruajtje lokale, vlera mbetet vetëm gjatë kësaj seance.
  }
  return stock;
}
