import { supabase } from "@/lib/supabase/client";

/** Lista e dhuratave e përdoruesit (një për llogari); RLS e kufizon vetë leximin te e vetja. */
export type GiftReservationRow = { id: string; name: string; qty: number; created_at: string };

export type GiftItemRow = {
  id: string;
  qty: number;
  reserved_qty: number;
  products: { id: string; name: string; price: number; image_url: string | null } | null;
  gift_reservations: GiftReservationRow[] | null;
};

export type GiftListRow = {
  id: string;
  slug: string;
  title: string;
  message: string | null;
  gift_list_items: GiftItemRow[] | null;
};

/** Gabim që do të thotë "SQL-i i listës ende s'është ekzekutuar" (tabela mungon). */
export function isGiftsNotReady(error: unknown): boolean {
  const message = String((error as { message?: string } | null)?.message ?? "");
  return /does not exist|relation|schema cache/i.test(message);
}

export async function fetchMyGiftList(): Promise<GiftListRow | null> {
  const { data: session } = await supabase.auth.getSession();
  const userId = session.session?.user.id;
  if (!userId) return null;
  const { data, error } = await supabase
    .from("gift_lists")
    .select("id, slug, title, message, gift_list_items(id, qty, reserved_qty, products(id, name, price, image_url), gift_reservations(id, name, qty, created_at))")
    .eq("owner_id", userId)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as GiftListRow | null) ?? null;
}

/** A është i kyçur përdoruesi (lexim lokal i sesionit, pa rrjet). */
export async function isSignedIn(): Promise<boolean> {
  const { data } = await supabase.auth.getSession();
  return !!data.session?.user;
}

async function currentUserId(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const id = data.session?.user.id;
  if (!id) throw new Error("Duhet të jesh i loguar.");
  return id;
}

export async function createGiftList(title: string, message: string): Promise<void> {
  const owner_id = await currentUserId();
  const { error } = await supabase.from("gift_lists").insert({ owner_id, title, message: message || null });
  if (error) throw error;
}

export async function updateGiftList(id: string, title: string, message: string): Promise<void> {
  const { error } = await supabase.from("gift_lists").update({ title, message: message || null }).eq("id", id);
  if (error) throw error;
}

/** Shton një produkt te lista; e krijon listën me parazgjedhjet nëse s'ka. Kthen "exists" kur është tashmë aty. */
export async function addGiftItem(productId: string): Promise<"added" | "exists"> {
  const owner_id = await currentUserId();
  const found = await supabase.from("gift_lists").select("id").eq("owner_id", owner_id).maybeSingle();
  if (found.error) throw found.error;
  let listId = found.data?.id as string | undefined;
  if (!listId) {
    const created = await supabase.from("gift_lists").insert({ owner_id }).select("id").single();
    if (created.error) throw created.error;
    listId = created.data.id as string;
  }
  const { error } = await supabase.from("gift_list_items").insert({ list_id: listId, product_id: productId });
  if (error) {
    if (error.code === "23505") return "exists";
    throw error;
  }
  return "added";
}

export async function setGiftQty(itemId: string, qty: number): Promise<void> {
  const { error } = await supabase.from("gift_list_items").update({ qty }).eq("id", itemId);
  if (error) throw error;
}

export async function removeGiftItem(itemId: string): Promise<void> {
  const { error } = await supabase.from("gift_list_items").delete().eq("id", itemId);
  if (error) throw error;
}

export async function releaseGiftReservation(reservationId: string): Promise<void> {
  const { error } = await supabase.from("gift_reservations").delete().eq("id", reservationId);
  if (error) throw error;
}
