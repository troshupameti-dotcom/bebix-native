import type { CartItem } from "@/lib/state/types";

/**
 * Kontrolli i shportës para porosisë.
 *
 * Shporta ruan çmimin që kishte produkti kur u shtua. `place_order` merr
 * çmimin e sotëm nga baza — pra nëse çmimi ndryshonte, klienti porosiste me
 * një çmim që s'e kishte parë. Po ashtu, një produkt i çaktivizuar ose pa stok
 * kalonte deri te gabimi i fundit. Këtu krahasohet shporta me produktet e
 * sotme, që klienti ta shohë ndryshimin PARA se të konfirmojë.
 */

export type ProductNow = {
  id: string;
  name: string;
  price: number;
  is_active: boolean;
  stock: number | null;
  image_url: string | null;
};

export type CartChange =
  | { kind: "removed"; name: string }
  | { kind: "price"; name: string; from: number; to: number }
  | { kind: "qty"; name: string; to: number };

/** Sa copë pranon porosia për një produkt. */
export const MAX_QTY = 99;

export function reconcileCart(items: CartItem[], products: ProductNow[]): { items: CartItem[]; changes: CartChange[] } {
  const byId = new Map(products.map((p) => [p.id, p]));
  const next: CartItem[] = [];
  const changes: CartChange[] = [];

  for (const item of items) {
    const product = byId.get(item.id);
    if (!product || !product.is_active || product.stock === 0) {
      changes.push({ kind: "removed", name: item.name });
      continue;
    }

    let qty = Math.min(item.qty, MAX_QTY);
    if (typeof product.stock === "number" && product.stock > 0 && qty > product.stock) qty = product.stock;
    if (qty !== item.qty) changes.push({ kind: "qty", name: product.name, to: qty });

    const price = Number(product.price);
    if (Math.abs(price - item.price) >= 0.005) changes.push({ kind: "price", name: product.name, from: item.price, to: price });

    next.push({ ...item, name: product.name, price, qty, imageUrl: product.image_url ?? item.imageUrl });
  }

  return { items: next, changes };
}

/** Telefoni: shifra, hapësira, +, (), -, ., / — dhe të paktën 6 shifra (si në server). */
export function isValidPhone(value: string): boolean {
  const trimmed = value.trim();
  return /^[+0-9 ()./-]{6,30}$/.test(trimmed) && trimmed.replace(/\D/g, "").length >= 6;
}

/**
 * Referenca e një porosie (UUID v4). E njëjta referencë dërgohet sa herë
 * klienti riprovon të njëjtën porosi, dhe `place_order` e krijon vetëm një herë
 * (rrjet i dobët, prekje e dyfishtë). S'është sekret: mjafton të jetë unike.
 */
export function newOrderRef(random: () => number = Math.random): string {
  const hex = Array.from({ length: 32 }, () => Math.floor(random() * 16).toString(16));
  hex[12] = "4";
  hex[16] = ((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  const s = hex.join("");
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
}
