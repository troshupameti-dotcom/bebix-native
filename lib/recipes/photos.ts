import { RECIPE_PHOTOS, FOOD_PHOTOS, PHOTO_CREDITS } from "@/content/recipes/photos";

/** Një foto e paketuar me app-in (`require(...)`). */
export type LocalPhoto = number;

/**
 * Fotot reale të recetave dhe ushqimeve, që vijnë me app-in (punojnë edhe pa rrjet). Burimi dhe licenca e secilës
 * (CC0, domen publik, CC BY ose CC BY-SA) janë te `content/recipes/photos.ts` dhe dalin poshtë fotos.
 * Kur një recetë s'ka foto këtu (p.sh. një recetë e re nga paneli), përdoret `cover_url` ose vizatimi.
 */
export type PhotoCredit = { author: string; license: string; source: string };

export function recipePhoto(slug: string | null | undefined): LocalPhoto | null {
  return (slug && RECIPE_PHOTOS[slug]) || null;
}

export function foodPhoto(key: string | null | undefined): LocalPhoto | null {
  return (key && FOOD_PHOTOS[key]) || null;
}

export function photoCredit(kind: "recipe" | "food", id: string): PhotoCredit | null {
  return PHOTO_CREDITS[`${kind}:${id}`] ?? null;
}
