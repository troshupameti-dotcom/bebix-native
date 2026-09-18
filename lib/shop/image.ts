/**
 * Miniaturat e produkteve.
 *
 * Në një grid 2-kolonash kartela është ~180px e gjerë, por foto e ngarkuar
 * nga paneli mund të jetë 2000px. Pa transformim, telefoni shkarkon dhe
 * dekodon foton e plotë për çdo kartelë — me 5000 produkte kjo është
 * ndryshimi mes një dyqani të përdorshëm dhe një app-i që ngrin.
 *
 * Supabase e bën transformimin te `/render/image/`, POR kjo kërkon plan me
 * pagesë. Prandaj është e fikur si parazgjedhje: pa `EXPO_PUBLIC_SUPABASE_
 * IMAGE_TRANSFORM=1` kthehet URL-ja origjinale dhe asgjë nuk prishet.
 */

const TRANSFORM_ENABLED = process.env.EXPO_PUBLIC_SUPABASE_IMAGE_TRANSFORM === "1";

/** Gjerësitë e lejuara — pak variante, që cache-i i CDN-së të ketë kuptim. */
export type ThumbWidth = 200 | 400 | 800;

export function productImage(url: string | null | undefined, width: ThumbWidth = 400): string | null {
  if (!url) return null;
  if (!TRANSFORM_ENABLED) return url;
  if (!url.includes("/storage/v1/object/public/")) return url;

  const rendered = url.replace("/storage/v1/object/public/", "/storage/v1/render/image/public/");
  const separator = rendered.includes("?") ? "&" : "?";
  return `${rendered}${separator}width=${width}&resize=contain&quality=70`;
}

export const imageTransformEnabled = TRANSFORM_ENABLED;
