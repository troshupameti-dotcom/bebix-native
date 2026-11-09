import { fitsMonths, sortRecipes } from "@/lib/recipes/catalog";
import { ALLERGENS, type Allergen, type Food, type FoodLiking, type FoodTry, type Recipe, type ServeByAge } from "@/lib/recipes/types";

/**
 * Ushqimet e para dhe plani i alergjenëve, pa ekran: sa herë është provuar secili ushqim, cili është prezantuar dhe
 * cila recetë i jepet si alternativë kur e refuzon. Pa seri ditësh dhe pa krahasime: numëruesi vetëm rritet.
 */

export type FoodSummary = {
  foodKey: string;
  /** Sa herë është provuar ("E provoi 5 herë"). */
  count: number;
  lastAt: string;
  lastLiking: FoodLiking | null;
  /** A ka pasur ndonjëherë reagim. */
  reaction: boolean;
};

/** Përmbledhja për çdo ushqim të provuar. `tries` pa të fshirat, në çfarëdo radhe. */
export function summarizeTries(tries: FoodTry[]): Map<string, FoodSummary> {
  const out = new Map<string, FoodSummary>();
  const ordered = [...tries].sort((a, b) => (a.triedAt < b.triedAt ? -1 : 1));
  for (const t of ordered) {
    const prev = out.get(t.foodKey);
    out.set(t.foodKey, {
      foodKey: t.foodKey,
      count: (prev?.count ?? 0) + 1,
      lastAt: t.triedAt,
      // Pëlqimi i fundit i njohur: një provë pa përgjigje s'e fshin atë të mëparshmen.
      lastLiking: t.liking ?? prev?.lastLiking ?? null,
      reaction: (prev?.reaction ?? false) || t.reaction,
    });
  }
  return out;
}

/** "32 ushqime të provuara": ushqime të ndryshme, jo prova. */
export function triedFoodsCount(tries: FoodTry[]): number {
  return new Set(tries.map((t) => t.foodKey)).size;
}

/** Grupi i servirjes për moshën e fëmijës. */
export function serveKeyFor(months: number | null | undefined): keyof ServeByAge | null {
  if (months == null || months < 6) return null;
  if (months < 9) return "6-8";
  if (months < 12) return "9-11";
  return "12+";
}

/** Ushqimet që përdor receta (pa përsëritje, pa ato sipas dëshirës). */
export function recipeFoodKeys(recipe: Pick<Recipe, "ingredients">, foods: Food[]): string[] {
  const known = new Set(foods.map((f) => f.foodKey));
  const keys = recipe.ingredients.filter((i) => !i.optional && i.foodKey && known.has(i.foodKey)).map((i) => i.foodKey as string);
  return [...new Set(keys)];
}

/** Recetat me këtë ushqim, ato që i përshtaten moshës të parat. */
export function recipesWithFood(recipes: Recipe[], foodKey: string, months: number | null): Recipe[] {
  const list = sortRecipes(recipes.filter((r) => r.ingredients.some((i) => i.foodKey === foodKey)));
  if (months == null) return list;
  return [...list.filter((r) => fitsMonths(r, months)), ...list.filter((r) => !fitsMonths(r, months))];
}

/**
 * "Provoje sërish, në formë tjetër": një recetë me të njëjtin ushqim që i përshtatet moshës, jo ajo që u refuzua.
 * E njëjta gjatë ditës, që të mos ndryshojë sa herë hapet faqja.
 */
export function alternativeRecipe(recipes: Recipe[], foodKey: string, months: number | null, refusedSlug: string | null, at = new Date()): Recipe | null {
  const fits = recipesWithFood(recipes, foodKey, months).filter((r) => r.slug !== refusedSlug && (months == null || fitsMonths(r, months)));
  if (!fits.length) return null;
  const day = Math.floor(at.getTime() / 86_400_000);
  return fits[day % fits.length];
}

// ---- Plani i alergjenëve ---------------------------------------------------------------------------------

/** Tri prova me sasi të vogla që rriten. */
export const PLAN_TRIES = 3;

/**
 * Për çdo alergjen kryesor: me çfarë fillon (ushqimi i parë) dhe shkalla e sasive. "tiny" = ¼ → ½ → 1 lugë çaji
 * (kikirik, arra, susam: të holluara ose të bluara); "small" = 1 → 2 lugë çaji → 1 lugë gjelle.
 */
export const ALLERGEN_PLAN: Record<Allergen, { foodKey: string; scale: "tiny" | "small" }> = {
  egg: { foodKey: "egg", scale: "small" },
  peanut: { foodKey: "peanut_butter", scale: "tiny" },
  milk: { foodKey: "yogurt", scale: "small" },
  wheat: { foodKey: "semolina", scale: "small" },
  sesame: { foodKey: "tahini", scale: "tiny" },
  fish: { foodKey: "sea_bass", scale: "small" },
  tree_nut: { foodKey: "ground_walnuts", scale: "tiny" },
  soy: { foodKey: "tofu", scale: "small" },
  shellfish: { foodKey: "shrimp", scale: "small" },
};

/** Radha e planit: të zakonshmit dhe ata që këshillohen herët të parët. */
export const PLAN_ORDER: Allergen[] = ["egg", "peanut", "milk", "wheat", "sesame", "fish", "tree_nut", "soy", "shellfish"];

export type AllergenStatus = "not_started" | "in_progress" | "introduced" | "reaction";

export type AllergenProgress = {
  allergen: Allergen;
  status: AllergenStatus;
  /** Provat pa reagim deri tani. */
  tries: number;
  /** Prova e radhës (0, 1, 2), ose null kur është prezantuar ose pati reagim. */
  nextStep: number | null;
  lastAt: string | null;
  reactionAt: string | null;
};

/** Gjendja e çdo alergjeni nga provat e ushqimeve që e përmbajnë (çdo ushqim me atë alergjen vlen). */
export function allergenProgress(tries: FoodTry[], foods: Food[]): AllergenProgress[] {
  const allergenOf = new Map(foods.map((f) => [f.foodKey, f.allergen]));
  return PLAN_ORDER.filter((a) => (ALLERGENS as readonly string[]).includes(a)).map((allergen) => {
    const mine = tries.filter((t) => allergenOf.get(t.foodKey) === allergen).sort((a, b) => (a.triedAt < b.triedAt ? -1 : 1));
    const reactions = mine.filter((t) => t.reaction);
    const lastAt = mine.length ? mine[mine.length - 1].triedAt : null;
    if (reactions.length) {
      return { allergen, status: "reaction", tries: mine.length - reactions.length, nextStep: null, lastAt, reactionAt: reactions[reactions.length - 1].triedAt };
    }
    const count = mine.length;
    const status: AllergenStatus = count >= PLAN_TRIES ? "introduced" : count > 0 ? "in_progress" : "not_started";
    return { allergen, status, tries: count, nextStep: count >= PLAN_TRIES ? null : count, lastAt, reactionAt: null };
  });
}

/** Alergjeni që po prezantohet tani (një i ri në herë): i pari me prova të filluara e të pambaruara. */
export function allergenInProgress(progress: AllergenProgress[]): Allergen | null {
  return progress.find((p) => p.status === "in_progress")?.allergen ?? null;
}
