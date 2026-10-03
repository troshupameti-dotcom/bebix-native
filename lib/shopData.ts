import { supabase } from "@/lib/supabase/client";
import { Product, Brand } from "@/lib/homeContent";
import { IconName } from "@/components/ui/Icon";
import { ageOverlapFilter, type AgeBand } from "@/lib/shop/age";

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
  "id, name, price, compare_at_price, image_url, accent, rating, review_count, badge, stock, free_delivery, merchant_name, min_age_months, max_age_months, brands(name), categories(key, icon)";

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
  min_age_months: number | null;
  max_age_months: number | null;
  brands: { name: string } | null;
  categories: { key: string; icon: string | null } | null;
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
  /** Celesi i kategorise nga baza, ose "all". */
  category?: string;
  brandId?: string;
  sort?: ProductSort;
  /** Faqja, duke nisur nga 0. */
  page?: number;
  pageSize?: number;
  /** Vetëm produktet me çmim të vjetër më të lartë — për seksionin "Në ofertë". */
  onSaleOnly?: boolean;
  /** Grupmosha: produktet e përshtatshme për këtë interval (ose pa kufi moshe). */
  age?: AgeBand | null;
};

export type ProductPage = {
  items: Product[];
  /** Sa produkte i përgjigjen filtrit në total (jo sa u kthyen). */
  total: number;
  hasMore: boolean;
};

/** Ikona e kategorise vjen nga paneli; nese s'eshte e vlefshme, kub. */
function iconForCategory(icon: string | null | undefined): IconName {
  if (icon && VALID_ICONS.has(icon as IconName)) return icon as IconName;
  return "cube";
}

/**
 * Fusha `icon` e kategorise mban ose emrin e nje ikone, ose nje emoji.
 *
 * Nente kategori me te njejten ikone `sparkle` ishin nente kuti te njejta:
 * shiriti nuk tregonte asgje. Emoji-t dallohen menjehere, vijne me ngjyren e
 * vet dhe nuk kerkojne asnje aset. Nese paneli vendos nje emer ikone, ajo
 * ikone perdoret si me pare.
 */
function emojiForCategory(icon: string | null | undefined): string | null {
  if (!icon) return null;
  if (VALID_ICONS.has(icon as IconName)) return null;
  const trimmed = icon.trim();
  if (isImageUrl(trimmed)) return null;
  // Cdo gje jo-ASCII trajtohet si emoji; emrat e ikonave jane ASCII.
  return trimmed && /[^\u0000-\u007F]/.test(trimmed) ? trimmed : null;
}

/**
 * Fusha `icon` mban tashme ose nje emer ikone, ose nje emoji, ose nje URL.
 *
 * Tre kuptime ne nje kolone eshte nje me shume se sa do te doja, por kjo i
 * lejon panelit ta nderroje figuren e nje kategorie duke ngjitur nje link,
 * pikerisht si behet me produktet, pa migrim skeme.
 */
function isImageUrl(value: string | null | undefined): boolean {
  if (!value) return false;
  return /^https?:\/\//i.test(value.trim());
}

function imageUrlForCategory(icon: string | null | undefined): string | null {
  const trimmed = icon?.trim() ?? "";
  return isImageUrl(trimmed) ? trimmed : null;
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
    category: row.categories?.key ?? "",
    icon: iconForCategory(row.categories?.icon),
    emoji: emojiForCategory(row.categories?.icon),
    accent: row.accent,
    rating: Number(row.rating),
    badge: row.badge,
    reviewCount: row.review_count,
    imageUrl: row.image_url,
    freeDelivery: row.free_delivery ?? false,
    merchant: row.merchant_name ?? null,
    stock: row.stock ?? 0,
    minAgeMonths: row.min_age_months ?? null,
    maxAgeMonths: row.max_age_months ?? null,
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

export type ShopCategory = {
  id: string;
  key: string;
  label: string;
  icon: IconName;
  /** Emoji nga paneli; kur eshte null, perdoret `icon`. */
  emoji: string | null;
  /** URL figure nga paneli; ka perparesi mbi figuren e app-it. */
  imageUrl: string | null;
};

/** Kategoritë mbahen pak minuta (jo gjithë sesionin), që ndryshimet e adminit të duken pa e rihapur app-in. */
const CATEGORY_TTL_MS = 5 * 60 * 1000;
let categoryCache: { at: number; list: ShopCategory[] } | null = null;

export async function fetchCategories(): Promise<ShopCategory[]> {
  if (categoryCache && Date.now() - categoryCache.at < CATEGORY_TTL_MS) return categoryCache.list;
  const { data, error } = await supabase.from("categories").select("id, key, label, icon").order("sort_order");
  if (error) throw error;
  // Vetëm kategoritë me të paktën një produkt aktiv: kategoria bosh te filtrat duket e papërfunduar.
  const counts = await Promise.all(
    (data ?? []).map((c: any) => supabase.from("products").select("id", { count: "exact", head: true }).eq("category_id", c.id).eq("is_active", true)),
  );
  const list = (data ?? []).filter((_: unknown, i: number) => (counts[i].count ?? 0) > 0).map((c: any) => ({
    id: c.id,
    key: c.key,
    label: c.label,
    icon: iconForCategory(c.icon),
    emoji: emojiForCategory(c.icon),
    imageUrl: imageUrlForCategory(c.icon),
  }));
  categoryCache = { at: Date.now(), list };
  return list;
}

async function categoryIdFor(key: string | undefined): Promise<string | null> {
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
  if (q.age) query = query.or(ageOverlapFilter(q.age));

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
  category: string,
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
