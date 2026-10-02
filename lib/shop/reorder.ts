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

/** Pelenat e fundit që klienti i ka porositur (porositë e anuluara nuk llogariten). */
export function lastDiaperItem(orders: MyOrder[]): OrderItem | null {
  for (const order of orders) {
    if (order.status === "cancelled") continue;
    const item = order.items.find((i) => DIAPER_PATTERN.test(i.name));
    if (item) return item;
  }
  return null;
}
