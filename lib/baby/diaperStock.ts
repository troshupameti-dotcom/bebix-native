import { estimateSupply, loadSupply, saveSupply, type SupplyEstimate, type SupplyStock } from "@/lib/baby/supply";

/**
 * Pelenat e mbetura. Prindi vendos një herë sa pelena ka; Bebix i heq vetë një
 * për çdo pelenë të shënuar te ditari dhe e di kur po mbarojnë, para se të
 * mbarojnë vërtet. Ruhet vetëm në telefon (nuk është e dhënë që duhet te serveri).
 * Logjika është e përbashkët me formulën (`lib/baby/supply.ts`).
 */
export type DiaperStock = SupplyStock;
export type DiaperStockEstimate = SupplyEstimate;

const KEY = "bebix_diaper_stock_v1";
/** Prag i sigurt: edhe pa mesatare, nën kaq pelena kërkon porosi. */
export const LOW_COUNT = 6;
/** Dërgesa në Kosovë zgjat 1–3 ditë; kur të mjaftojnë për kaq ditë ose më pak, porosit. */
export const LOW_DAYS = 3;

export function estimateDiaperStock(stock: DiaperStock, entries: { at: string }[], now: number = Date.now()): DiaperStockEstimate {
  return estimateSupply(stock, entries, { count: LOW_COUNT, days: LOW_DAYS }, now);
}

export const loadDiaperStock = (): Promise<DiaperStock | null> => loadSupply(KEY);

export const saveDiaperStock = (remaining: number): Promise<DiaperStock> => saveSupply(KEY, remaining);
