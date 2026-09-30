import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/lib/supabase/client";
import { mapOrder, type MyOrder } from "@/lib/shop/orders";

/**
 * Porositë e mysafirit. S'ka llogari, prandaj telefoni ruan numrat e porosive
 * dhe i kërkon te serveri (`get_guest_orders`): statusi dhe konfirmimi dalin
 * edhe kur mysafiri del nga app-i dhe kthehet. Numrat krijohen nga serveri
 * dhe s'hamendësohen; kush e ka numrin, e ka bërë vetë porosinë.
 */
const KEY = "bebix_guest_orders_v1";
const MAX = 50;

async function readIds(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

/** E ruan porosinë e sapobërë (më e reja e para). */
export async function rememberGuestOrder(orderId: string): Promise<void> {
  const ids = await readIds();
  const next = [orderId, ...ids.filter((id) => id !== orderId)].slice(0, MAX);
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Pa ruajtje lokale porosia mbetet e vlefshme; thjesht s'shfaqet më vonë.
  }
}

export async function fetchGuestOrders(): Promise<MyOrder[]> {
  const ids = await readIds();
  if (ids.length === 0) return [];
  const { data, error } = await supabase.rpc("get_guest_orders", { p_ids: ids });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map(mapOrder);
}
