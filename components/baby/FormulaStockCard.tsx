import { useMemo } from "react";
import { SupplyCard, type SupplyConfig } from "@/components/baby/SupplyCard";
import { estimateFormulaStock, formulaEntries, loadFormulaStock, saveFormulaStock, usesFormula } from "@/lib/baby/formulaStock";
import { lastFormulaItem } from "@/lib/shop/reorder";
import type { FeedingEntry } from "@/lib/state/babyTypes";

const FORMULA: SupplyConfig = {
  icon: "bottle",
  load: loadFormulaStock,
  save: saveFormulaStock,
  estimate: estimateFormulaStock,
  lastItem: lastFormulaItem,
  searchQuery: "formula",
  text: {
    title: "formula_stock_title",
    hint: "formula_stock_hint",
    set: "formula_stock_set",
    left: "formula_stock_left",
    days: "formula_stock_days",
    low: "formula_stock_low",
    reorder: "diaper_stock_reorder",
    find: "formula_stock_find",
    compact: "formula_stock_compact",
  },
};

/**
 * "Formula e mbetur", si pelenat: servimet që mbeten, sa ditë mjaftojnë dhe, para se të mbarojë, porosia e së
 * njëjtës formulë nga dyqani. Kur bebi s'ka pirë formulë 30 ditët e fundit dhe numri s'është vendosur, del vetëm një
 * rresht i vogël që hapet me prekje: prindi e gjen gjithmonë (14 nëntor: "ku e vendos sasinë? s'e shoh"), por nënat
 * që ushqejnë me gji s'shohin një formular që s'u përket.
 */
export function FormulaStockCard({ log }: { log: FeedingEntry[] }) {
  const entries = useMemo(() => formulaEntries(log), [log]);
  return <SupplyCard entries={entries} config={FORMULA} compactUntilSet={!usesFormula(log)} />;
}
