import { allergyConflicts, fitsMonths, seasonOf } from "@/lib/recipes/catalog";
import { recipeFoodKeys, summarizeTries } from "@/lib/recipes/firstFoods";
import type { Allergen, Food, FoodCategory, FoodTry, Recipe } from "@/lib/recipes/types";

/**
 * Sugjerimet sipas moshës dhe asaj që fëmija ka provuar, pa ekran:
 * - ushqime të reja për këtë javë: që i përshtaten moshës, të paprovuara, pa alergjenët (ata kanë planin e vet) dhe
 *   pa ato me rrezik të lartë mbytjeje (rrushi, arrat, karota e gjallë…: futen me udhëzuesin, jo si sugjerim i shpejtë);
 * - receta me ushqimet që i njeh: çdo ushqim i recetës është provuar, pa reagim;
 * - receta me një ushqim të ri: vetëm një ushqim i paprovuar, që nuk është alergjen (një ushqim i ri në një kohë).
 * Të gjitha i përshtaten moshës dhe s'kanë alergjenët e shënuar te profili. Renditja ndryshon çdo ditë (recetat) dhe
 * çdo javë (ushqimet), që prindi të shohë diçka tjetër pa humbur atë që pa sot.
 */

/** Fëmija ha ushqime të forta nga 6 muaj; para kësaj s'sugjerohet asgjë (karta "A është gati?" e mbulon). */
export const SOLIDS_FROM_MONTHS = 6;

export type OneNewFood = { recipe: Recipe; food: Food };
export type Suggestions = { newFoods: Food[]; familiar: Recipe[]; oneNew: OneNewFood[]; triedCount: number };

const EMPTY: Suggestions = { newFoods: [], familiar: [], oneNew: [], triedCount: 0 };

function seed(text: string): number {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) >>> 0;
  return h;
}

const dayKey = (at: Date) => `${at.getFullYear()}-${at.getMonth()}-${at.getDate()}`;
/** E hëna e javës: e njëjta për gjithë javën. */
const weekKey = (at: Date) => {
  const d = new Date(at.getFullYear(), at.getMonth(), at.getDate());
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return dayKey(d);
};

/** Renditje e qëndrueshme për një çelës (ditë ose javë): e njëjta gjatë asaj kohe, tjetër pas saj. */
function rotate<T>(list: T[], key: (x: T) => string, salt: string): T[] {
  return [...list].sort((a, b) => seed(salt + key(a)) - seed(salt + key(b)) || key(a).localeCompare(key(b)));
}

/** Një nga çdo grup me radhë (perime, fruta, drithëra…), që sugjerimet të mos jenë të gjitha të një lloji. */
function spreadByCategory(list: Food[]): Food[] {
  const groups = new Map<FoodCategory, Food[]>();
  for (const f of list) groups.set(f.category, [...(groups.get(f.category) ?? []), f]);
  const out: Food[] = [];
  const queues = [...groups.values()];
  while (queues.some((q) => q.length)) for (const q of queues) if (q.length) out.push(q.shift()!);
  return out;
}

export function suggestFor(input: {
  recipes: Recipe[];
  foods: Food[];
  tries: FoodTry[];
  months: number | null;
  allergens: Allergen[];
  at?: Date;
  limit?: { foods?: number; recipes?: number };
}): Suggestions {
  const { recipes, foods, tries, months, allergens } = input;
  const at = input.at ?? new Date();
  if (months == null || months < SOLIDS_FROM_MONTHS) return EMPTY;
  const foodLimit = input.limit?.foods ?? 4;
  const recipeLimit = input.limit?.recipes ?? 10;

  const summary = summarizeTries(tries);
  const tried = new Set(summary.keys());
  const reacted = new Set([...summary.values()].filter((s) => s.reaction).map((s) => s.foodKey));
  const byKey = new Map(foods.map((f) => [f.foodKey, f]));
  const season = seasonOf(at);

  // Ushqime të reja: të paprovuara, për moshën, pa alergjenë dhe pa rrezik të lartë mbytjeje. Nën 12 muaj, me hekur të parat.
  const candidates = foods.filter((f) => f.ageFromMonths <= months && !tried.has(f.foodKey) && !f.allergen && f.chokingRisk !== "high");
  const rotated = rotate(candidates, (f) => f.foodKey, `foods:${weekKey(at)}`);
  const ironFirst = months < 12 ? [...rotated.filter((f) => f.nutrients.includes("iron")), ...rotated.filter((f) => !f.nutrients.includes("iron"))] : rotated;
  const newFoods = spreadByCategory(ironFirst).slice(0, foodLimit);

  // Recetat që i përshtaten moshës dhe s'kanë alergjenët e fëmijës; ato të stinës të parat.
  const fit = recipes.filter((r) => fitsMonths(r, months) && !allergyConflicts(r, allergens).length);
  const ordered = rotate(fit, (r) => r.slug, `recipes:${dayKey(at)}`);
  const seasonal = [...ordered.filter((r) => !r.season.length || r.season.includes(season)), ...ordered.filter((r) => r.season.length && !r.season.includes(season))];

  const familiar: Recipe[] = [];
  const oneNew: OneNewFood[] = [];
  for (const r of seasonal) {
    const keys = recipeFoodKeys(r, foods);
    if (!keys.length || keys.some((k) => reacted.has(k))) continue;
    const fresh = keys.filter((k) => !tried.has(k));
    if (fresh.length === 0 && tried.size > 0) {
      if (familiar.length < recipeLimit) familiar.push(r);
    } else if (fresh.length === 1) {
      const food = byKey.get(fresh[0]);
      if (food && !food.allergen && food.ageFromMonths <= months && oneNew.length < recipeLimit) oneNew.push({ recipe: r, food });
    }
  }

  return { newFoods, familiar, oneNew, triedCount: tried.size };
}
