import { fetchMyOrders, type MyOrder, type OrderItem } from "@/lib/shop/orders";
import { fetchGuestOrders } from "@/lib/shop/guestOrders";

/** Porositë e klientit (me llogari dhe si mysafir nga kjo pajisje), më e reja e para. */
export async function fetchAllOrders(): Promise<MyOrder[]> {
  const [mine, guest] = await Promise.all([fetchMyOrders().catch(() => [] as MyOrder[]), fetchGuestOrders().catch(() => [] as MyOrder[])]);
  const seen = new Set(mine.map((o) => o.id));
  return [...mine, ...guest.filter((o) => !seen.has(o.id))].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Emrat që e dallojnë një produkt pelenash (shqip dhe anglisht, markat e zakonshme). */
const DIAPER_PATTERN = /pelen|diaper|pampers|huggies|libero|mamypoko/i;

/**
 * Emrat që e dallojnë formulën e qumështit: fjala "formul…" ose markat e zakonshme. Jo çdo "qumësht": enët për
 * qumështin e gjirit s'janë formulë. HiPP shet edhe pure, ndaj vetëm me fjalët e formulës.
 */
export const FORMULA_PATTERN =
  /formul|aptamil|\bnan\s*(optipro|supreme|expert|ha\b|[1-4]\b)|humana|bebelac|similac|nutrilon|enfamil|bebivita|milupa|novalac|kendamil|hipp\b.*(combiotik|formul|milch|qum)|qumësht\s*(fillestar|pluhur|për\s*foshnj|[1-4]\b)/i;

/** Artikulli i fundit i porositur që i përshtatet emrit (porositë e anuluara nuk llogariten). */
function lastMatching(orders: MyOrder[], pattern: RegExp): OrderItem | null {
  for (const order of orders) {
    if (order.status === "cancelled") continue;
    const item = order.items.find((i) => pattern.test(i.name));
    if (item) return item;
  }
  return null;
}

/** Pelenat e fundit që klienti i ka porositur. */
export const lastDiaperItem = (orders: MyOrder[]): OrderItem | null => lastMatching(orders, DIAPER_PATTERN);

/** Formula e fundit që klienti e ka porositur te dyqani: kujtesa ofron pikërisht atë. */
export const lastFormulaItem = (orders: MyOrder[]): OrderItem | null => lastMatching(orders, FORMULA_PATTERN);
