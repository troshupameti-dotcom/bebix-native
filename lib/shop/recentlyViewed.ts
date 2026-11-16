import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Product } from "@/lib/homeContent";

/** "Parë së fundmi": produktet që klienti ka hapur, më i fundit i pari. Vetëm në telefon, pa server. */
const KEY = "bebix_recent_products_v1";
export const RECENT_MAX = 10;

/** Vetëm fushat që i duhen kartës së produktit: lista mbetet e vogël në memorie. */
function slim(p: Product): Product {
  return {
    id: p.id,
    name: p.name,
    brand: p.brand,
    price: p.price,
    compareAtPrice: p.compareAtPrice,
    category: p.category,
    icon: p.icon,
    emoji: p.emoji ?? null,
    accent: p.accent,
    rating: p.rating,
    badge: p.badge,
    reviewCount: p.reviewCount,
    imageUrl: p.imageUrl ?? null,
    freeDelivery: p.freeDelivery,
    merchant: p.merchant ?? null,
    stock: p.stock,
    minAgeMonths: p.minAgeMonths ?? null,
    maxAgeMonths: p.maxAgeMonths ?? null,
  };
}

/** Lista e re pas hapjes së një produkti: ai del i pari, pa përsëritje, jo më shumë se `RECENT_MAX`. */
export function withViewed(list: Product[], product: Product): Product[] {
  return [slim(product), ...list.filter((p) => p.id !== product.id)].slice(0, RECENT_MAX);
}

export async function loadRecentlyViewed(): Promise<Product[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as Product[]) : [];
    return Array.isArray(list) ? list.filter((p) => p && typeof p.id === "string" && typeof p.price === "number") : [];
  } catch {
    return [];
  }
}

export async function recordViewed(product: Product): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(withViewed(await loadRecentlyViewed(), product)));
  } catch {
    // Pa vend në memorie: rreshti thjesht s'përditësohet.
  }
}
