/**
 * Recetat dhe ushqimet e para (6 muaj–5 vjeç). Të njëjtat vlera lejojnë edhe kontrollet te tabela `recipes`
 * (migrimi 20261110090000_recipes.sql).
 */

/** Teksturat sipas moshës: purè (6–7 m), e shtypur (7–9 m), copa të buta (9–12 m), si e familjes (12 m+). */
export const RECIPE_STAGES = ["pure", "mashed", "finger", "family"] as const;
export type RecipeStage = (typeof RECIPE_STAGES)[number];

/** Purè me lugë, ose BLW (bebja ha vetë copat). Një recetë mund t'i ketë të dyja. */
export const FEEDING_STYLES = ["puree", "blw"] as const;
export type FeedingStyle = (typeof FEEDING_STYLES)[number];

export const MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack"] as const;
export type MealType = (typeof MEAL_TYPES)[number];

/** Alergjenët kryesorë. Të njëjtët çelësa kontrollohen kundër alergjive të shënuara te profili i fëmijës. */
export const ALLERGENS = ["milk", "egg", "wheat", "peanut", "tree_nut", "sesame", "soy", "fish", "shellfish"] as const;
export type Allergen = (typeof ALLERGENS)[number];

export const DIET_TAGS = ["vegetarian", "dairy_free", "gluten_free", "egg_free", "nut_free"] as const;
export type DietTag = (typeof DIET_TAGS)[number];

export const NUTRIENTS = ["iron", "protein", "calcium", "vitamin_c", "fiber", "omega3"] as const;
export type Nutrient = (typeof NUTRIENTS)[number];

export const SEASONS = ["spring", "summer", "autumn", "winter"] as const;
export type Season = (typeof SEASONS)[number];

/** Njësitë e vetme të lejuara, të njëjtat kudo. */
export const UNITS = ["g", "ml", "copë", "lugë gjelle", "lugë çaji", "filxhan"] as const;
export type Unit = (typeof UNITS)[number];

export type Ingredient = {
  name: string;
  amount: number;
  unit: Unit;
  /** Ushqimi te lista e ushqimeve të para (`foods.food_key`), që provat dhe alergjenët të lidhen me recetën. */
  foodKey: string | null;
  optional?: boolean;
};

/** "Si ta servirësh sipas moshës": forma, madhësia dhe teksturë për secilin grup. */
export type ServeByAge = Partial<Record<"6-8" | "9-11" | "12+", string>>;

export type Recipe = {
  slug: string;
  title: string;
  summary: string;
  ageMinMonths: number;
  ageMaxMonths: number;
  stage: RecipeStage;
  feedingStyle: FeedingStyle[];
  mealTypes: MealType[];
  prepMinutes: number;
  cookMinutes: number;
  yieldNote: string;
  /** Sa herë shumëzohen sasitë për "Me gjithë familjen". 1 = receta është tashmë për familjen. */
  familyFactor: number;
  ingredients: Ingredient[];
  steps: string[];
  serveByAge: ServeByAge;
  allergens: Allergen[];
  dietTags: DietTag[];
  nutrients: Nutrient[];
  freezerFriendly: boolean;
  storageNote: string;
  freezerNote: string;
  reheatNote: string;
  chokingNote: string;
  familyTip: string;
  season: Season[];
  isAlbanian: boolean;
  /** Ilustrimi i vizatuar në app (`RecipeCover`), kur s'ka foto. */
  cover: string | null;
  coverUrl: string | null;
  coverSvg: string | null;
  featured: boolean;
  sortOrder: number;
  updatedAt: string | null;
};

// ---- Faza B: ushqimet e para dhe provat ---------------------------------------------------------------

/** Kategoritë e ushqimeve të para (tabela `foods`, migrimi 20261111090000_foods.sql). */
export const FOOD_CATEGORIES = ["fruit", "vegetable", "grain", "protein", "dairy", "allergen"] as const;
export type FoodCategory = (typeof FOOD_CATEGORIES)[number];

export const CHOKING_RISKS = ["low", "medium", "high"] as const;
export type ChokingRisk = (typeof CHOKING_RISKS)[number];

export type Food = {
  foodKey: string;
  name: string;
  category: FoodCategory;
  ageFromMonths: number;
  chokingRisk: ChokingRisk;
  allergen: Allergen | null;
  serveByAge: ServeByAge;
  nutrients: Nutrient[];
  tip: string;
  /** Vetëm te kopja e app-it: një shenjë e vogël për rrjetën (pa të, del germa e parë). */
  emoji?: string;
};

/** 😋 E hëngri të gjithë · 🙂 Pak · 🙅 E refuzoi. */
export const FOOD_LIKINGS = ["all", "some", "refused"] as const;
export type FoodLiking = (typeof FOOD_LIKINGS)[number];

/** Shenjat e një reagimi që prindi mund të shënojë. */
export const REACTION_SYMPTOMS = ["rash", "vomit", "swelling", "other"] as const;
export type ReactionSymptom = (typeof REACTION_SYMPTOMS)[number];

/** Një provë e një ushqimi nga fëmija (tabela `food_tries`). */
export type FoodTry = {
  id: string;
  foodKey: string;
  triedAt: string;
  liking: FoodLiking | null;
  reaction: boolean;
  symptoms: ReactionSymptom[];
  note: string;
  recipeSlug: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};
