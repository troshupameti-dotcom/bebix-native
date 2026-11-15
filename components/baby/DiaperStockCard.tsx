import { SupplyCard, type SupplyConfig } from "@/components/baby/SupplyCard";
import { estimateDiaperStock, loadDiaperStock, saveDiaperStock } from "@/lib/baby/diaperStock";
import { lastDiaperItem } from "@/lib/shop/reorder";

const DIAPERS: SupplyConfig = {
  icon: "diaper",
  load: loadDiaperStock,
  save: saveDiaperStock,
  estimate: estimateDiaperStock,
  lastItem: lastDiaperItem,
  searchQuery: "pelena",
  text: {
    title: "diaper_stock_title",
    hint: "diaper_stock_hint",
    set: "diaper_stock_set",
    left: "diaper_stock_left",
    days: "diaper_stock_days",
    low: "diaper_stock_low",
    reorder: "diaper_stock_reorder",
    find: "diaper_stock_find",
  },
};

/**
 * "Pelenat e mbetura": prindi vendos sa pelena ka, Bebix i numëron vetë nga
 * ditari dhe, para se të mbarojnë, ofron porosinë me një prekje (të njëjtat pelena
 * që ka blerë herën e fundit, ose kërkimin e pelenave kur s'ka blerë ende).
 */
export function DiaperStockCard({ entries }: { entries: { at: string }[] }) {
  return <SupplyCard entries={entries} config={DIAPERS} />;
}
