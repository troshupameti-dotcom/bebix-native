import { FOOD_NUTRITION, type FoodNutrition, type Per100g } from "@/content/recipes/nutrition";
import type { Food, ServeByAge } from "@/lib/recipes/types";

/**
 * Vlerat ushqyese, gramët për vakt dhe sa shpesh, për çdo ushqim të vetëm.
 * - Vlerat për 100 g vijnë nga USDA (`content/recipes/nutrition.ts`); një ushqim i shtuar nga paneli s'i ka, dhe
 *   atëherë pjesa s'del.
 * - Gramët janë orientues për një vakt, sipas grupit të ushqimit dhe moshës: bebi vendos sa ha, dhe oreksi ndryshon
 *   nga dita në ditë. Asnjë "duhet të hajë".
 */

export type ServeKey = keyof ServeByAge;
export type Portion = { min: number; max: number; unit: "g" | "ml" };

export type FoodGroup = "fruit" | "vegetable" | "grain" | "legume" | "meat" | "fish" | "egg" | "dairy" | "milk" | "fat" | "nut" | "seasoning" | "ingredient";

/** Grupi i ushqimeve që s'dalin vetë nga kategoria. */
const GROUP_OF: Record<string, FoodGroup> = {
  red_lentils: "legume",
  lentils: "legume",
  white_beans: "legume",
  chickpeas: "legume",
  kidney_beans: "legume",
  black_beans: "legume",
  tofu: "legume",
  chicken: "meat",
  beef: "meat",
  turkey: "meat",
  lamb: "meat",
  egg: "egg",
  salmon: "fish",
  sea_bass: "fish",
  cod: "fish",
  sardines: "fish",
  trout: "fish",
  shrimp: "fish",
  mackerel: "fish",
  tuna: "fish",
  milk: "milk",
  butter: "fat",
  // Farat jepen me lugë çaji, si arrat e bluara.
  chia_seeds: "nut",
  ground_flaxseed: "nut",
  pumpkin_seeds: "nut",
  lemon: "seasoning",
  garlic: "seasoning",
  parsley: "seasoning",
  dill: "seasoning",
  wheat_flour: "ingredient",
  filo: "ingredient",
};

const BY_CATEGORY: Record<Food["category"], FoodGroup> = {
  grain: "grain",
  fruit: "fruit",
  vegetable: "vegetable",
  protein: "meat",
  dairy: "dairy",
  allergen: "nut",
};

export function foodGroup(food: Pick<Food, "foodKey" | "category">): FoodGroup {
  return GROUP_OF[food.foodKey] ?? BY_CATEGORY[food.category] ?? "ingredient";
}

type Range = [number, number] | null;
type Ranges = Record<ServeKey, Range>;

/**
 * Gramët për një vakt sipas grupit: 6–8 muaj nis me pak lugë dhe rritet, 9–11 muaj rreth dyfishi, 1–5 vjeç sa
 * një racion i vogël fëmije. Orientuese, të përafruara në lugë: 1 lugë gjelle ≈ 15 g.
 */
const BY_GROUP: Record<FoodGroup, Ranges> = {
  fruit: { "6-8": [15, 45], "9-11": [30, 60], "12+": [40, 80] },
  vegetable: { "6-8": [15, 45], "9-11": [30, 60], "12+": [40, 80] },
  grain: { "6-8": [20, 40], "9-11": [30, 60], "12+": [50, 90] },
  legume: { "6-8": [15, 30], "9-11": [30, 45], "12+": [40, 60] },
  meat: { "6-8": [10, 25], "9-11": [20, 30], "12+": [25, 40] },
  fish: { "6-8": [10, 25], "9-11": [20, 30], "12+": [25, 40] },
  // ¼–½ veze, ½–1 vezë, një vezë.
  egg: { "6-8": [12, 25], "9-11": [25, 50], "12+": [50, 50] },
  dairy: { "6-8": [30, 60], "9-11": [60, 100], "12+": [100, 150] },
  // Si pije vetëm pas 12 muajsh; para kësaj vetëm në gatim (shih tekstin "si ta servirësh").
  milk: { "6-8": null, "9-11": null, "12+": [100, 200] },
  fat: { "6-8": [2, 5], "9-11": [3, 5], "12+": [5, 8] },
  nut: { "6-8": [2, 5], "9-11": [5, 10], "12+": [10, 15] },
  seasoning: { "6-8": null, "9-11": null, "12+": null },
  ingredient: { "6-8": null, "9-11": null, "12+": null },
};

/** Ushqimet që hahen në sasi tjetër nga grupi i tyre. */
const BY_FOOD: Record<string, Ranges> = {
  bread: { "6-8": [10, 15], "9-11": [15, 25], "12+": [20, 35] },
  avocado: { "6-8": [15, 30], "9-11": [25, 45], "12+": [30, 60] },
  onion: { "6-8": [5, 15], "9-11": [10, 20], "12+": [15, 30] },
  celery: { "6-8": [5, 15], "9-11": [10, 20], "12+": [15, 30] },
  prunes: { "6-8": [5, 10], "9-11": [10, 15], "12+": [15, 25] },
  raisins: { "6-8": [5, 10], "9-11": [10, 15], "12+": [15, 25] },
  dates: { "6-8": [5, 10], "9-11": [10, 15], "12+": [15, 25] },
  dried_apricots: { "6-8": [5, 10], "9-11": [10, 15], "12+": [15, 25] },
  olives: { "6-8": null, "9-11": null, "12+": [5, 15] },
  lettuce: { "6-8": [5, 10], "9-11": [10, 20], "12+": [15, 30] },
  rice_cakes: { "6-8": [3, 5], "9-11": [5, 10], "12+": [10, 20] },
  // Mëlçia: pak, për shkak të vitaminës A.
  chicken_liver: { "6-8": [10, 15], "9-11": [15, 20], "12+": [20, 30] },
  chia_seeds: { "6-8": [2, 3], "9-11": [3, 5], "12+": [5, 10] },
  ground_flaxseed: { "6-8": [2, 3], "9-11": [3, 5], "12+": [5, 10] },
  cheese: { "6-8": [5, 15], "9-11": [10, 20], "12+": [15, 25] },
  mozzarella: { "6-8": [5, 15], "9-11": [10, 20], "12+": [15, 25] },
  cream_cheese: { "6-8": [5, 15], "9-11": [10, 20], "12+": [15, 25] },
  goat_cheese: { "6-8": [5, 15], "9-11": [10, 20], "12+": [15, 25] },
  gjize: { "6-8": [15, 30], "9-11": [30, 45], "12+": [40, 60] },
  ricotta: { "6-8": [15, 30], "9-11": [30, 45], "12+": [40, 60] },
};

const BAND_START: Record<ServeKey, number> = { "6-8": 6, "9-11": 9, "12+": 12 };

/** Sa për një vakt në këtë moshë; null kur s'jepet më vete (përbërës, erëza) ose kur s'është mosha ende. */
export function portionFor(food: Pick<Food, "foodKey" | "category" | "ageFromMonths">, band: ServeKey): Portion | null {
  if (food.ageFromMonths > BAND_START[band]) return null;
  const range = (BY_FOOD[food.foodKey] ?? BY_GROUP[foodGroup(food)])[band];
  if (!range) return null;
  return { min: range[0], max: range[1], unit: foodGroup(food) === "milk" ? "ml" : "g" };
}

export function nutritionFor(foodKey: string): FoodNutrition | null {
  return FOOD_NUTRITION[foodKey] ?? null;
}

/** Vlerat për një sasi (p.sh. racioni i moshës); `null` mbetet `null`. */
export function scaleNutrition(per100g: Per100g, grams: number): Per100g {
  const f = grams / 100;
  const s = (v: number | null) => (v == null ? null : v * f);
  return {
    kcal: per100g.kcal * f,
    protein: per100g.protein * f,
    carbs: per100g.carbs * f,
    fat: per100g.fat * f,
    fiber: s(per100g.fiber),
    iron: per100g.iron * f,
    calcium: per100g.calcium * f,
    vitC: s(per100g.vitC),
  };
}

/** Mesi i racionit, i rrumbullakuar në 5 g: sasia për të cilën tregohen vlerat "në një vakt". */
export function typicalGrams(portion: Portion): number {
  return Math.max(5, Math.round((portion.min + portion.max) / 2 / 5) * 5);
}
