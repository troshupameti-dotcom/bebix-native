import { supabase } from "@/lib/supabase/client";

/**
 * Porositë e klientit. Statusi ndryshohet nga paneli i adminit; këtu
 * vetëm lexohet, sipas politikës RLS `orders_select_own`.
 */

export const ORDER_STATUSES = ["pending", "confirmed", "shipped", "delivered", "cancelled"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

/** Si ruhen artikujt te `orders.items` — e njëjta formë me shportën. */
export type OrderItem = {
  id: string;
  name: string;
  price: number;
  qty: number;
  imageUrl?: string | null;
  icon?: string | null;
};

export type MyOrder = {
  id: string;
  createdAt: string;
  status: OrderStatus;
  total: number;
  fullName: string;
  phone: string;
  address: string;
  city: string;
  items: OrderItem[];
};

/** Kontakti i porosisë së fundit, për të parambushur checkout-in. */
export type SavedContact = {
  fullName: string;
  phone: string;
  address: string;
  city: string;
};

function isStatus(value: unknown): value is OrderStatus {
  return typeof value === "string" && (ORDER_STATUSES as readonly string[]).includes(value);
}

function mapItems(raw: unknown): OrderItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const item = entry as Record<string, unknown>;
    const qty = Number(item.qty);
    const price = Number(item.price);
    if (!item.id || !Number.isFinite(qty) || !Number.isFinite(price)) return [];
    return [{
      id: String(item.id),
      name: typeof item.name === "string" ? item.name : "Produkt",
      price,
      qty,
      imageUrl: typeof item.imageUrl === "string" ? item.imageUrl : null,
      icon: typeof item.icon === "string" ? item.icon : null,
    }];
  });
}

function mapOrder(row: Record<string, any>): MyOrder {
  return {
    id: row.id,
    createdAt: row.created_at,
    status: isStatus(row.status) ? row.status : "pending",
    total: Number(row.total_price) || 0,
    fullName: row.full_name ?? "",
    phone: row.phone ?? "",
    address: row.address ?? "",
    city: row.city ?? "",
    items: mapItems(row.items),
  };
}

export async function fetchMyOrders(): Promise<MyOrder[]> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData?.user?.id;
  if (!userId) return [];

  const { data, error } = await supabase
    .from("orders")
    .select("id, created_at, status, total_price, full_name, phone, address, city, items")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw new Error(error.message);
  return (data ?? []).map(mapOrder);
}

/**
 * Kontakti i porosisë së fundit. Profili mban vetëm emrin e prindit, pra
 * telefoni dhe adresa vijnë nga porosia e kaluar — kush ka porositur një
 * herë, nuk e rishkruan adresën çdo herë.
 */
export async function fetchSavedContact(): Promise<SavedContact | null> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData?.user?.id;
  if (!userId) return null;

  const { data, error } = await supabase
    .from("orders")
    .select("full_name, phone, address, city")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return {
    fullName: data.full_name ?? "",
    phone: data.phone ?? "",
    address: data.address ?? "",
    city: data.city ?? "",
  };
}

export function orderStatusLabel(status: OrderStatus): string {
  return {
    pending: "Në pritje",
    confirmed: "E konfirmuar",
    shipped: "Nisur për dërgesë",
    delivered: "Dorëzuar",
    cancelled: "Anuluar",
  }[status];
}

/** Çfarë pret klienti tani — shpjegim, jo vetëm etiketë. */
export function orderStatusHint(status: OrderStatus): string {
  return {
    pending: "Porosia u regjistrua. Do të kontaktohesh për konfirmim.",
    confirmed: "Porosia u konfirmua dhe po përgatitet.",
    shipped: "Porosia është nisur. Paguan kur ta marrësh.",
    delivered: "Porosia u dorëzua. Faleminderit!",
    cancelled: "Porosia u anulua.",
  }[status];
}

/** Hapat e dukshëm te ekrani; "cancelled" s'ka vijë kohore. */
export const ORDER_TIMELINE: OrderStatus[] = ["pending", "confirmed", "shipped", "delivered"];
