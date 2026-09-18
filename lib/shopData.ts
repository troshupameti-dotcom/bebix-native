import { supabase } from "@/lib/supabase/client";
import { Product, ProductCategory, CATEGORY_META, Brand } from "@/lib/homeContent";
import { IconName } from "@/components/ui/Icon";

/**
 * Lidhja e Shop-it me tabelën `products`.
 *
 * KUJDES — kjo shtresë është rishkruar për katalog të madh (5000+ produkte).
 * Rregulli: filtrimi, kërkimi, renditja dhe faqosja bëhen NË SERVER.
 * Asnjë funksion këtu nuk duhet të kthejë "të gjitha produktet": më parë
 * `fetchProducts()` i merrte të gjitha pa asnjë kufi. Me 5000 produkte kjo
 * do të thoshte disa MB në një përgjigje të vetme, dhe nëse projekti ka
 * `db-max-rows` të vendosur, produktet mbi atë numër do të zhdukeshin pa
 * asnjë gabim — thjesht nuk do të ishin aty.
 */

/** Sa produkte merren për faqe gjatë scroll-it. */
export const PRODUCT_PAGE_SIZE = 24;

/** Kolonat e nevojshme për një kartelë liste — pa `description`, pa `gallery_urls`. */
const LIST_COLUMNS =
  "id, name, price, compare_at_price, image_url, accent, rating, review_count, badge, stock, free_delivery, merchant_name, brands(name), categories(key)";

const DETAIL_COLUMNS = `${LIST_COLUMNS}, description, gallery_urls`;

type ProductRow = {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  compare_at_price: number | null;
  image_url: string | null;
  gallery_urls?: string[] | null;
  accent: "olive" | "orange";
  rating: number;
  review_count: number;
  badge: "new" | "sale" | "bestseller" | null;
  stock: number;
  free_delivery: boolean;
  merchant_name: string | null;
  brands: { name: string } | null;
  categories: { key: string } | null;
};

type BrandRow = {
  id: string;
  name: string;
  tagline: string | null;
  icon: string | null;
  logo_url: string | null;
};

export type ProductSort = "newest" | "priceAsc" | "priceDesc" | "rating";

export type ProductQuery = {
  search?: string;
  category?: ProductCategory | "all";
  brandId?: string;
  sort?: ProductSort;
  /** Faqja, duke nisur nga 0. */
  page?: number;
  pageSize?: number;
  /** Vetëm produktet me çmim të vjetër më të lartë — për seksionin "Në ofertë". */
  onSaleOnly?: boolean;
};

export type ProductPage = {
  items: Product[];
  /** Sa produkte i përgjigjen filtrit në total (jo sa u kthyen). */
  total: number;
  hasMore: boolean;
};

function iconForCategoryKey(key: string | undefined): IconName {
  if (key && key in CATEGORY_META) return CATEGORY_META[key as ProductCategory].icon;
  return "cube";
}

const VALID_ICONS = new Set<IconName>([
  "home", "baby", "shop", "community", "more", "chevronLeft", "chevronRight", "share", "edit",
  "bell", "cart", "search", "sparkle", "send", "plus", "camera", "flash", "close", "heart",
  "comment", "bookmark", "moon", "globe", "lock", "download", "family", "shield", "repeat",
  "droplet", "spoon", "chart", "cube", "check", "flame", "bath", "pill", "play", "syringe",
  "eye", "eyeOff",
]);
function iconForBrand(icon: string | null): IconName {
  if (icon && VALID_ICONS.has(icon as IconName)) return icon as IconName;
  return "sparkle";
}

function mapRow(row: ProductRow): Product {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? null,
    brand: row.brands?.name ?? "Bebix",
    price: Number(row.price),
    compareAtPrice: row.compare_at_price != null ? Number(row.compare_at_price) : null,
    category: (row.categories?.key as ProductCategory) ?? "feeding",
    icon: iconForCategoryKey(row.categories?.key),
    accent: row.accent,
    rating: Number(row.rating),
    badge: row.badge,
    reviewCount: row.review_count,
    imageUrl: row.image_url,
    freeDelivery: row.free_delivery ?? false,
    merchant: row.merchant_name ?? null,
    stock: row.stock ?? 0,
    galleryUrls: Array.isArray(row.gallery_urls) ? row.gallery_urls : [],
  };
}

function mapBrandRow(row: BrandRow, index: number): Brand {
  return {
    id: row.id,
    name: row.name,
    tagline: row.tagline ?? "",
    icon: iconForBrand(row.icon),
    accent: index % 2 === 0 ? "olive" : "orange",
    logoUrl: row.logo_url ?? null,
  };
}

// ---------------------------------------------------------------------
// Kategoritë — tabelë e vogël, mbahet në memorie për të kthyer key -> id.
// Filtri duhet të jetë `category_id = ...` në server; pa këtë hartë do të
// duhej një join `!inner`, që i heq produktet pa kategori.
// ---------------------------------------------------------------------

export type ShopCategory = { id: string; key: string; label: string };

let categoryCache: ShopCategory[] | null = null;

export async function fetchCategories(): Promise<ShopCategory[]> {
  if (categoryCache) return categoryCache;
  const { data, error } = await supabase.from("categories").select("id, key, label").order("sort_order");
  if (error) throw error;
  categoryCache = (data ?? []).map((c: any) => ({ id: c.id, key: c.key, label: c.label }));
  return categoryCache;
}

async function categoryIdFor(key: ProductCategory | "all" | undefined): Promise<string | null> {
  if (!key || key === "all") return null;
  const categories = await fetchCategories();
  return categories.find((c) => c.key === key)?.id ?? null;
}

/** Markat që përputhen me tekstin e kërkimit — tabelë e vogël, një kërkesë e shpejtë. */
async function brandIdsMatching(search: string): Promise<string[]> {
  const { data } = await supabase.from("brands").select("id").ilike("name", `%${search}%`).limit(20);
  return (data ?? []).map((b: any) => b.id);
}

/** Karakteret që PostgREST i lexon si sintaksë brenda një filtri `or`. */
function sanitize(term: string): string {
  return term.replace(/[(),*%\\]/g, " ").trim();
}

/**
 * Një faqe produktesh. E vetmja rrugë që duhet përdorur nga listat.
 */
export async function fetchProductPage(q: ProductQuery = {}): Promise<ProductPage> {
  const page = q.page ?? 0;
  const pageSize = q.pageSize ?? PRODUCT_PAGE_SIZE;
  const from = page * pageSize;

  let query = supabase
    .from("products")
    .select(LIST_COLUMNS, { count: "exact" })
    .eq("is_active", true);

  const categoryId = await categoryIdFor(q.category);
  if (categoryId) query = query.eq("category_id", categoryId);
  if (q.brandId) query = query.eq("brand_id", q.brandId);
  if (q.onSaleOnly) query = query.not("compare_at_price", "is", null);

  const search = sanitize(q.search ?? "");
  if (search) {
    // Emri i produktit ose emri i markës. Marka kërkohet veçmas sepse një
    // filtër mbi tabelën e lidhur do të kërkonte join `!inner`, që i heq
    // produktet pa markë.
    const brandIds = await brandIdsMatching(search);
    query = brandIds.length
      ? query.or(`name.ilike.%${search}%,brand_id.in.(${brandIds.join(",")})`)
      : query.ilike("name", `%${search}%`);
  }

  switch (q.sort ?? "newest") {
    case "priceAsc":
      query = query.order("price", { ascending: true });
      break;
    case "priceDesc":
      query = query.order("price", { ascending: false });
      break;
    case "rating":
      query = query.order("rating", { ascending: false });
      break;
    default:
      query = query.order("created_at", { ascending: false });
  }

  // Renditje e dytë e qëndrueshme: pa të, produktet me të njëjtin çmim
  // mund të ndërrojnë vend mes faqeve dhe të dublohen gjatë scroll-it.
  query = query.order("id", { ascending: true }).range(from, from + pageSize - 1);

  const { data, error, count } = await query;
  if (error) throw error;

  const items = (data as unknown as ProductRow[]).map(mapRow);
  const total = count ?? items.length;
  return { items, total, hasMore: from + items.length < total };
}

export async function fetchProductById(id: string): Promise<Product | null> {
  const { data, error } = await supabase
    .from("products")
    .select(DETAIL_COLUMNS)
    .eq("id", id)
    .eq("is_active", true)
    .maybeSingle();

  if (error) throw error;
  return data ? mapRow(data as unknown as ProductRow) : null;
}

/** Produkte të ngjashme për ekranin e detajeve — më parë shkarkohej gjithë katalogu për 4 kartela. */
export async function fetchRelatedProducts(
  category: ProductCategory,
  excludeId: string,
  limit = 6
): Promise<Product[]> {
  const categoryId = await categoryIdFor(category);
  let query = supabase.from("products").select(LIST_COLUMNS).eq("is_active", true).neq("id", excludeId);
  if (categoryId) query = query.eq("category_id", categoryId);

  const { data, error } = await query.order("created_at", { ascending: false }).limit(limit);
  if (error) throw error;
  return (data as unknown as ProductRow[]).map(mapRow);
}

/** Produkte të zgjedhura për Home — një rresht i vetëm, jo katalogu. */
export async function fetchFeaturedProducts(limit = 6): Promise<Product[]> {
  const { data, error } = await supabase
    .from("products")
    .select(LIST_COLUMNS)
    .eq("is_active", true)
    .gt("stock", 0)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data as unknown as ProductRow[]).map(mapRow);
}

export async function fetchBrands(limit = 40): Promise<Brand[]> {
  const { data, error } = await supabase.from("brands").select("*").order("name").limit(limit);
  if (error) throw error;
  return (data as unknown as BrandRow[]).map(mapBrandRow);
}

export async function fetchBrandById(id: string): Promise<Brand | null> {
  const { data, error } = await supabase.from("brands").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? mapBrandRow(data as unknown as BrandRow, 0) : null;
}
