import { supabase } from "@/lib/supabase/client";
import { Product, ProductCategory, CATEGORY_META, Brand } from "@/lib/homeContent";
import { IconName } from "@/components/ui/Icon";

/**
 * Lidhja reale e Shop-it me tabelën `products` te Supabase (admin panel).
 * Zëvendëson `productCatalog` statik nga homeContent.ts për ekranet e
 * Shop-it. `homeContent.ts` mbetet siç është (ende përdoret nga Home.tsx
 * dhe si "reserve" tipesh/kategorish) — s'e prekim.
 */

type ProductRow = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  compare_at_price: number | null;
  image_url: string | null;
  gallery_urls: string[] | null;
  accent: "olive" | "orange";
  rating: number;
  review_count: number;
  badge: "new" | "sale" | "bestseller" | null;
  stock: number;
  is_active: boolean;
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
};

/** Ikonë e arsyeshme kur produkti s'ka kategori/nuk përputhet me listën e njohur. */
function iconForCategoryKey(key: string | undefined): IconName {
  if (key && key in CATEGORY_META) return CATEGORY_META[key as ProductCategory].icon;
  return "cube";
}

/** Ikonë e arsyeshme kur marka s'ka ikonë të vlefshme (p.sh. emër që s'ekziston te IconName). */
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
  };
}

function mapBrandRow(row: BrandRow, index: number): Brand {
  return {
    id: row.id,
    name: row.name,
    tagline: row.tagline ?? "",
    icon: iconForBrand(row.icon),
    accent: index % 2 === 0 ? "olive" : "orange",
  };
}

/** Merr të gjitha produktet aktive, të renditura më të rejat së pari. */
export async function fetchProducts(): Promise<Product[]> {
  const { data, error } = await supabase
    .from("products")
    .select("*, brands(name), categories(key)")
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data as unknown as ProductRow[]).map(mapRow);
}

/** Merr një produkt të vetëm sipas ID, për ekranin e detajeve. */
export async function fetchProductById(id: string): Promise<Product | null> {
  const { data, error } = await supabase
    .from("products")
    .select("*, brands(name), categories(key)")
    .eq("id", id)
    .eq("is_active", true)
    .maybeSingle();

  if (error) throw error;
  return data ? mapRow(data as unknown as ProductRow) : null;
}

/** Merr të gjitha markat reale nga admin panel — përdoret te seksioni "Markat" i Shop-it. */
export async function fetchBrands(): Promise<Brand[]> {
  const { data, error } = await supabase
    .from("brands")
    .select("*")
    .order("name");

  if (error) throw error;
  return (data as unknown as BrandRow[]).map(mapBrandRow);
}