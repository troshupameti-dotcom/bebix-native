import { IconName } from "@/components/ui/Icon";

/**
 * Tipet e dyqanit (produkti, marka). Të dhënat vijnë nga Supabase
 * (lib/shopData.ts). Katalogët shembull që rrinin këtu — me vlerësime të
 * sajuara si "Elira B." — s'përdoreshin më dhe u hoqën.
 */

export type ProductCategory = "feeding" | "diapering" | "sleep" | "bath" | "toys" | "health";

export type Product = {
  id: string;
  name: string;
  brand: string;
  price: number;
  compareAtPrice: number | null;
  /**
   * Celesi i kategorise ashtu si rri te baza. NUK eshte union i fiksuar:
   * kategorite i menaxhon paneli dhe mund te shtohen pa prekur kodin.
   */
  category: string;
  icon: IconName;
  /** Emoji i kategorise, kur paneli ka vendosur nje te tille. */
  emoji?: string | null;
  accent: "olive" | "orange";
  rating: number; // 0-5
  badge: "new" | "sale" | "bestseller" | null;
  reviewCount?: number;
  imageUrl?: string | null; // foto reale nga Supabase Storage (produktet e admin panelit)
  description?: string | null;
  // Opsionale: nëse s'jepen, ekrani i detajeve i llogarit vetë (produkte
  // të kategorisë së njëjtë) si rezervë.
  relatedIds?: string[];
  boughtWithIds?: string[];
  freeDelivery?: boolean;
  merchant?: string | null;
  stock?: number;
  galleryUrls?: string[];
};

export type Brand = {
  id: string;
  name: string;
  tagline: string;
  icon: IconName;
  accent: "olive" | "orange";
  logoUrl?: string | null;
};

