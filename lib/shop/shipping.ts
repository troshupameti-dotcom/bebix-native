/**
 * Dërgesa sipas vendit. Çmimi i VËRTETË llogaritet nga baza (`shipping_quote` dhe `place_order`);
 * këto vlera janë vetëm për emrat dhe për rastin kur baza s'përgjigjet.
 */
export type ShipCountry = "XK" | "AL" | "MK";

export const SHIPPING_COUNTRIES: { code: ShipCountry; fee: number; sq: string; en: string }[] = [
  { code: "XK", fee: 2.5, sq: "Kosovë", en: "Kosovo" },
  { code: "AL", fee: 5, sq: "Shqipëri", en: "Albania" },
  { code: "MK", fee: 5, sq: "Maqedoni e Veriut", en: "North Macedonia" },
];
