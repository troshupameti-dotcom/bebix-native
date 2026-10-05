import { supabase } from "@/lib/supabase/client";
import type { TranslationKey } from "@/lib/i18n/translations";
import type { PaymentMethod } from "@/lib/shop/payment";

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

export type PaymentStatus = "unpaid" | "pending" | "paid" | "failed" | "refunded";

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
  /** Si paguhet porosia (parazgjedhja "cod": porositë e vjetra dhe ato të mysafirit pa këtë fushë). */
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  /** Dërgesa e përfshirë te totali. */
  shippingFee: number;
  /** Referenca sekrete e porosisë (vetëm porositë e llogarisë): me të hapet përsëri pagesa me kartë. */
  clientRef: string | null;
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

const PAYMENT_METHODS: readonly string[] = ["cod", "bank_transfer", "card"];
const PAYMENT_STATUSES: readonly string[] = ["unpaid", "pending", "paid", "failed", "refunded"];

export function mapOrder(row: Record<string, any>): MyOrder {
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
    paymentMethod: PAYMENT_METHODS.includes(row.payment_method) ? row.payment_method : "cod",
    paymentStatus: PAYMENT_STATUSES.includes(row.payment_status) ? row.payment_status : "unpaid",
    shippingFee: Number(row.shipping_fee) || 0,
    clientRef: typeof row.client_ref === "string" ? row.client_ref : null,
  };
}

export async function fetchMyOrders(): Promise<MyOrder[]> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData?.user?.id;
  if (!userId) return [];

  const { data, error } = await supabase
    .from("orders")
    .select("id, created_at, status, total_price, full_name, phone, address, city, items, shipping_fee, payment_method, payment_status, client_ref")
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

/** Celesi i perkthimit per statusin; teksti zgjidhet nga ekrani. */
export function orderStatusLabelKey(status: OrderStatus): TranslationKey {
  return {
    pending: "order_status_pending",
    confirmed: "order_status_confirmed",
    shipped: "order_status_shipped",
    delivered: "order_status_delivered",
    cancelled: "order_status_cancelled",
  }[status] as TranslationKey;
}

/** Cfare pret klienti tani — shpjegim, jo vetem etikete. */
export function orderStatusHintKey(status: OrderStatus): TranslationKey {
  return {
    pending: "order_hint_pending",
    confirmed: "order_hint_confirmed",
    shipped: "order_hint_shipped",
    delivered: "order_hint_delivered",
    cancelled: "order_hint_cancelled",
  }[status] as TranslationKey;
}

/**
 * Si paguhet porosia, për etiketën te lista: me kartë ose transfertë (e paguar, në pritje, e dështuar, e rimbursuar),
 * ose "paguan kur ta marrësh".
 */
export function orderPaymentLabelKey(o: Pick<MyOrder, "paymentMethod" | "paymentStatus">): TranslationKey {
  if (o.paymentMethod === "card") {
    if (o.paymentStatus === "paid") return "myorders_paid_card";
    if (o.paymentStatus === "refunded") return "myorders_refunded";
    if (o.paymentStatus === "failed") return "myorders_card_failed";
    return "myorders_awaiting_card";
  }
  if (o.paymentMethod === "bank_transfer") {
    if (o.paymentStatus === "paid") return "myorders_paid_bank";
    if (o.paymentStatus === "refunded") return "myorders_refunded";
    return "myorders_awaiting_bank";
  }
  return "myorders_cod";
}

/** Pagesa me kartë e hapur ende: mund të paguhet përsëri (faqja u mbyll para kohe). */
export function canPayByCard(o: Pick<MyOrder, "paymentMethod" | "paymentStatus" | "status" | "clientRef">): boolean {
  return o.paymentMethod === "card" && o.paymentStatus === "pending" && o.status === "pending" && !!o.clientRef;
}

/** Shpjegimi i statusit; për porositë me pagesë paraprake nuk thotë "paguan kur ta marrësh". */
export function orderHintKeyFor(o: Pick<MyOrder, "status" | "paymentMethod" | "paymentStatus">): TranslationKey {
  const prepaid = o.paymentMethod !== "cod";
  if (o.status === "pending" && o.paymentMethod === "card") {
    return o.paymentStatus === "paid" ? "order_hint_card_paid" : o.paymentStatus === "failed" ? "order_hint_card_failed" : "order_hint_card_pending";
  }
  if (o.status === "shipped" && prepaid) return "order_hint_shipped_prepaid";
  return orderStatusHintKey(o.status);
}

/** Hapat e dukshëm te ekrani; "cancelled" s'ka vijë kohore. */
export const ORDER_TIMELINE: OrderStatus[] = ["pending", "confirmed", "shipped", "delivered"];
