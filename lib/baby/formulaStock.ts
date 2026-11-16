import { estimateSupply, loadSupply, saveSupply, type SupplyEstimate, type SupplyStock } from "@/lib/baby/supply";

/**
 * Formula e mbetur, si pelenat: prindi vendos sa servime ka (një servim = një shishe; kutia zakonisht e shkruan),
 * TROA heq një për çdo shishe formule të shënuar te ushqyerja dhe e kujton para se të mbarojë.
 */
export type FormulaStock = SupplyStock;
export type FormulaStockEstimate = SupplyEstimate;

const KEY = "bebix_formula_stock_v1";
/** Rreth një ditë shishesh për një bebe që pi vetëm formulë. */
export const FORMULA_LOW_COUNT = 8;
/**
 * Një ditë më shumë se pelenat: dërgesa zgjat 1–3 ditë, dhe formula s'zëvendësohet dot me diçka tjetër në shtëpi.
 * Ndaj kujtesa vjen pak më herët.
 */
export const FORMULA_LOW_DAYS = 4;

/** Shishet e formulës. "bottle" (qumësht gjiri në shishe) s'e harxhon formulën. */
export function formulaEntries<T extends { type: string; at: string }>(log: T[]): T[] {
  return log.filter((e) => e.type === "formula");
}

/** A ushqehet bebi me formulë: ka të paktën një shishe formule në 30 ditët e fundit. */
export function usesFormula(log: { type: string; at: string }[], now: number = Date.now()): boolean {
  return log.some((e) => e.type === "formula" && now - new Date(e.at).getTime() <= 30 * 86_400_000);
}

export function estimateFormulaStock(stock: FormulaStock, entries: { at: string }[], now: number = Date.now()): FormulaStockEstimate {
  return estimateSupply(stock, entries, { count: FORMULA_LOW_COUNT, days: FORMULA_LOW_DAYS }, now);
}

export const loadFormulaStock = (): Promise<FormulaStock | null> => loadSupply(KEY);

export const saveFormulaStock = (remaining: number): Promise<FormulaStock> => saveSupply(KEY, remaining);
