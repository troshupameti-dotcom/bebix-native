import { supabase } from "@/lib/supabase/client";

/**
 * Vlerësimet e produkteve.
 *
 * Mesatarja dhe numri mbahen te `products` nga një trigger në bazë — këtu
 * nuk llogaritet asgjë, që lista e produkteve të mos ketë nevojë t'i
 * numërojë vlerësimet për çdo kartelë.
 *
 * `verified_purchase` vendoset nga serveri, jo prej këtu: përndryshe
 * cilido do ta dërgonte si "i verifikuar".
 */

export type ProductReview = {
  id: string;
  rating: number;
  body: string | null;
  authorName: string;
  verifiedPurchase: boolean;
  createdAt: string;
  isMine: boolean;
};

export type ReviewSummary = {
  reviews: ProductReview[];
  total: number;
  /** Vlerësimi im, nëse kam shkruar — që forma të hapet e parambushur. */
  mine: ProductReview | null;
};

function mapRow(row: any, myId: string | null): ProductReview {
  return {
    id: row.id,
    rating: Number(row.rating),
    body: row.body ?? null,
    authorName: (row.author_name as string | null)?.trim() || "Prind",
    verifiedPurchase: !!row.verified_purchase,
    createdAt: row.created_at,
    isMine: !!myId && row.user_id === myId,
  };
}

export async function fetchReviews(productId: string, limit = 20): Promise<ReviewSummary> {
  const { data: userData } = await supabase.auth.getUser();
  const myId = userData?.user?.id ?? null;

  const { data, error, count } = await supabase
    .from("product_reviews")
    .select("id, user_id, rating, body, author_name, verified_purchase, created_at", { count: "exact" })
    .eq("product_id", productId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);

  const reviews = (data ?? []).map((row) => mapRow(row, myId));
  return {
    reviews,
    total: count ?? reviews.length,
    mine: reviews.find((r) => r.isMine) ?? null,
  };
}

/**
 * Shkruan ose përditëson vlerësimin tim. Një vlerësim për person për
 * produkt — kufiri është në bazë, jo vetëm këtu.
 */
export async function submitReview(input: {
  productId: string;
  rating: number;
  body: string;
  authorName: string | null;
}): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData?.user?.id;
  if (!userId) throw new Error("Duhet të jesh i kyçur për të vlerësuar.");

  const { error } = await supabase.from("product_reviews").upsert(
    {
      product_id: input.productId,
      user_id: userId,
      rating: input.rating,
      body: input.body.trim() || null,
      author_name: input.authorName?.trim() || null,
    },
    { onConflict: "product_id,user_id" }
  );

  if (error) throw new Error(error.message);
}

export async function deleteMyReview(productId: string): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData?.user?.id;
  if (!userId) return;

  const { error } = await supabase
    .from("product_reviews")
    .delete()
    .eq("product_id", productId)
    .eq("user_id", userId);

  if (error) throw new Error(error.message);
}
