import { fitsMonths, formatAmount, normalize, roundAmount } from "@/lib/recipes/catalog";
import { allergenProgress, recipeFoodKeys, type FoodSummary } from "@/lib/recipes/firstFoods";
import { MEAL_TYPES, type Allergen, type Food, type FoodCategory, type FoodTry, type MealType, type Recipe, type Unit } from "@/lib/recipes/types";

/**
 * "Plani i javës" pa ekran: ditët e javës, "Plotëso javën për mua", "Provo diçka të re ✨", dita e gatimit për
 * ngrirje dhe lista e blerjeve. Gjithçka është propozim: prindi e ndërron çdo vakt me një prekje të gjatë.
 */

// ---- Ditët ----------------------------------------------------------------------

const pad = (n: number) => String(n).padStart(2, "0");

/** "2026-11-10" sipas orës së telefonit (jo UTC: pas mesnatës s'kalon te dita e djeshme). */
export function isoDay(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseDay(day: string): Date {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function addDays(day: string, n: number): string {
  const d = parseDay(day);
  d.setDate(d.getDate() + n);
  return isoDay(d);
}

/** E hëna e javës së datës. */
export function weekStartOf(at: Date): string {
  const d = new Date(at.getFullYear(), at.getMonth(), at.getDate());
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return isoDay(d);
}

export const weekDays = (start: string): string[] => Array.from({ length: 7 }, (_, i) => addDays(start, i));

export const slotKey = (day: string, meal: MealType) => `${day}:${meal}`;

/** Vakti → receta (slug); null = vakt bosh. */
export type PlanMap = Record<string, string | null>;

/** Nën 9 muaj s'ka zemër (snack): mjaftojnë vaktet kryesore. */
export function mealsForMonths(months: number | null): MealType[] {
  return months != null && months < 9 ? MEAL_TYPES.filter((m) => m !== "snack") : [...MEAL_TYPES];
}

// ---- Cilat receta mund të vendosen vetë --------------------------------------------

export type PlanChild = { months: number | null; allergens: Allergen[]; tries: FoodTry[]; foods: Food[] };

/**
 * Alergjenët që plani s'i vendos vetë: ato të profilit, ato me reagim, dhe (nën 12 muaj ose pa moshë) ato që s'janë
 * prezantuar ende: një alergjen i ri provohet një nga një, në mëngjes, në shtëpi (te "Plani i alergjenëve").
 * Prindi mund ta shtojë vetë çdo recetë, me paralajmërimin e saj.
 */
export function blockedAllergens(child: PlanChild): Set<Allergen> {
  const blocked = new Set<Allergen>(child.allergens);
  for (const p of allergenProgress(child.tries, child.foods)) {
    if (p.status === "reaction") blocked.add(p.allergen);
    else if ((child.months == null || child.months < 12) && p.status !== "introduced") blocked.add(p.allergen);
  }
  return blocked;
}

/** Recetat që plani mund t'i propozojë: të moshës dhe pa alergjenët e bllokuar. */
export function plannableRecipes(recipes: Recipe[], child: PlanChild): Recipe[] {
  const blocked = blockedAllergens(child);
  return recipes.filter((r) => (child.months == null || fitsMonths(r, child.months)) && !r.allergens.some((a) => blocked.has(a)));
}

/** Sa i pëlqejnë ushqimet e recetës: 😋 +2, 🙂 +1, 🙅 −1 (s'përjashtohet: provohet sërish në forma të tjera). */
export function likingScore(recipe: Recipe, summary: Map<string, FoodSummary>, foods: Food[]): number {
  let score = 0;
  for (const key of recipeFoodKeys(recipe, foods)) {
    const liking = summary.get(key)?.lastLiking;
    score += liking === "all" ? 2 : liking === "some" ? 1 : liking === "refused" ? -1 : 0;
  }
  return score;
}

/** Numra të rastit që përsëriten me të njëjtën farë (testet dhe "Një tjetër" janë të parashikueshme). */
export function seeded(seed: number): () => number {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seedOf(text: string): number {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) >>> 0;
  return h;
}

const hasIron = (r: Recipe | undefined) => !!r?.nutrients.includes("iron");

// ---- "Plotëso javën për mua" ---------------------------------------------------------

/** Një recetë del jo më shumë se 2 herë në javë kur e plotëson app-i. */
export const MAX_REPEATS = 2;
/** Ku shkon receta me hekur kur dita s'ka ende një. */
const IRON_ORDER: MealType[] = ["lunch", "dinner", "breakfast", "snack"];

export type FillInput = {
  days: string[];
  meals: MealType[];
  plan: PlanMap;
  /** Recetat që mund të propozohen (`plannableRecipes`). */
  recipes: Recipe[];
  /** Të gjitha recetat, për të njohur ato që prindi ka vënë vetë. */
  catalog: Recipe[];
  summary: Map<string, FoodSummary>;
  foods: Food[];
  seed: number;
  /** Ditët para kësaj s'preken (dje s'ka kuptim të planifikohet). */
  from?: string;
};

export type FillResult = { assigned: PlanMap; daysWithoutIron: string[] };

/**
 * Plotëson vetëm vaktet bosh: sipas moshës dhe alergjive (`recipes`), me ushqimet që i pëlqejnë më përpara, pa e
 * përsëritur një recetë më shumë se 2 herë në javë (duke numëruar edhe ato që ka vënë prindi) dhe me hekur të paktën
 * një herë në ditë. Hekuri vendoset i pari për gjithë javën, që recetat me hekur të mos mbarojnë te vaktet e tjera.
 */
export function fillWeek(input: FillInput): FillResult {
  const rand = seeded(input.seed);
  const lookup = new Map(input.catalog.map((r) => [r.slug, r]));
  input.recipes.forEach((r) => lookup.set(r.slug, r));
  const scores = new Map(input.recipes.map((r) => [r.slug, likingScore(r, input.summary, input.foods)]));
  const assigned: PlanMap = {};
  const uses = new Map<string, number>();
  const filled = (day: string, meal: MealType) => input.plan[slotKey(day, meal)] ?? assigned[slotKey(day, meal)] ?? null;
  for (const day of input.days) for (const meal of MEAL_TYPES) {
    const slug = input.plan[slotKey(day, meal)];
    if (slug) uses.set(slug, (uses.get(slug) ?? 0) + 1);
  }
  const days = input.days.filter((d) => !input.from || d >= input.from);
  const usedOn = (day: string) => new Set(MEAL_TYPES.map((m) => filled(day, m)).filter((s): s is string => !!s));
  const dayHasIron = (day: string) => MEAL_TYPES.some((m) => hasIron(lookup.get(filled(day, m) ?? "")));

  const best = (day: string, meal: MealType, ironOnly: boolean): Recipe | null => {
    const today = usedOn(day);
    const options = input.recipes
      .filter((r) => r.mealTypes.includes(meal) && (uses.get(r.slug) ?? 0) < MAX_REPEATS && !today.has(r.slug) && (!ironOnly || hasIron(r)))
      .map((r) => ({ r, w: (scores.get(r.slug) ?? 0) + rand() * 2.5 - (uses.get(r.slug) ?? 0) }))
      .sort((a, b) => b.w - a.w);
    return options[0]?.r ?? null;
  };
  const put = (day: string, meal: MealType, r: Recipe) => {
    assigned[slotKey(day, meal)] = r.slug;
    uses.set(r.slug, (uses.get(r.slug) ?? 0) + 1);
  };

  for (const day of days) {
    if (dayHasIron(day)) continue;
    for (const meal of IRON_ORDER.filter((m) => input.meals.includes(m) && !filled(day, m))) {
      const r = best(day, meal, true);
      if (r) {
        put(day, meal, r);
        break;
      }
    }
  }
  for (const day of days) {
    for (const meal of input.meals) {
      if (filled(day, meal)) continue;
      const r = best(day, meal, false);
      if (r) put(day, meal, r);
    }
  }
  return { assigned, daysWithoutIron: days.filter((d) => !dayHasIron(d)) };
}

/** Vakti i parë bosh nga `from`, me mëngjesin dhe drekën përpara (një ushqim i ri provohet më mirë herët). */
export function firstFreeSlot(days: string[], meals: MealType[], plan: PlanMap, from: string, prefer: MealType[] = ["lunch", "breakfast", "dinner", "snack"]): { day: string; meal: MealType } | null {
  const order = prefer.filter((m) => meals.includes(m));
  for (const day of days.filter((d) => d >= from)) {
    for (const meal of order) if (!plan[slotKey(day, meal)]) return { day, meal };
  }
  return null;
}

// ---- "Provo diçka të re ✨" -------------------------------------------------------------

/**
 * Një recetë me një ushqim që fëmija s'e ka provuar ende (jo alergjen: ata kanë planin e tyre), të moshës së tij.
 * Recetat me vetëm një ushqim të ri dalin të parat: një i ri në një kohë.
 */
export function newFoodSuggestion(recipes: Recipe[], child: PlanChild, summary: Map<string, FoodSummary>, seed: number, skip: string[] = []): { recipe: Recipe; foodKey: string } | null {
  const foodBy = new Map(child.foods.map((f) => [f.foodKey, f]));
  const options = plannableRecipes(recipes, child)
    .filter((r) => !skip.includes(r.slug))
    .map((r) => ({
      r,
      fresh: recipeFoodKeys(r, child.foods).filter((k) => {
        const f = foodBy.get(k);
        return !summary.has(k) && f && !f.allergen && (child.months == null || f.ageFromMonths <= child.months);
      }),
    }))
    .filter((o) => o.fresh.length > 0);
  if (!options.length) return null;
  const fewest = Math.min(...options.map((o) => o.fresh.length));
  const pool = options.filter((o) => o.fresh.length === fewest).sort((a, b) => a.r.slug.localeCompare(b.r.slug));
  const pick = pool[Math.floor(seeded(seed)() * pool.length)];
  return { recipe: pick.r, foodKey: pick.fresh[0] };
}

// ---- Dita e gatimit për ngrirje ------------------------------------------------------------

export const FREEZER_DAYS = 5;

/**
 * "Gatuaj të dielën, mjafton për 5 ditë": deri në 3 receta që ngrijnë mirë, për drekë ose darkë, me të paktën një me
 * hekur kur ka, ato që i pëlqejnë më përpara.
 */
export function freezerPicks(recipes: Recipe[], summary: Map<string, FoodSummary>, foods: Food[], seed: number, count = 3): Recipe[] {
  const rand = seeded(seed);
  const pool = recipes
    .filter((r) => r.freezerFriendly && (r.mealTypes.includes("lunch") || r.mealTypes.includes("dinner")))
    .map((r) => ({ r, w: likingScore(r, summary, foods) + rand() * 2.5 }))
    .sort((a, b) => b.w - a.w)
    .map((x) => x.r);
  const picks = pool.slice(0, count);
  if (picks.length && !picks.some(hasIron)) {
    const iron = pool.find(hasIron);
    if (iron) picks[picks.length - 1] = iron;
  }
  return picks;
}

/** Radha e 5 ditëve: A, B, C, A, B (asnjë më shumë se 2 herë). Me më pak receta, më pak ditë. */
export function freezerSchedule(picks: Recipe[]): Recipe[] {
  if (!picks.length) return [];
  return Array.from({ length: Math.min(FREEZER_DAYS, picks.length * MAX_REPEATS) }, (_, i) => picks[i % picks.length]);
}

/** Vendos radhën te dreka (ose darka) e ditëve, pa prekur vaktet që ka vënë prindi. */
export function freezerAssignments(days: string[], schedule: Recipe[], plan: PlanMap): PlanMap {
  const out: PlanMap = {};
  schedule.forEach((r, i) => {
    const day = days[i];
    if (!day) return;
    const meal = (["lunch", "dinner"] as MealType[]).find((m) => r.mealTypes.includes(m) && !plan[slotKey(day, m)]);
    if (meal) out[slotKey(day, meal)] = r.slug;
  });
  return out;
}

// ---- Lista e blerjeve ----------------------------------------------------------------------

export type ShoppingCategory = FoodCategory | "other";
export const SHOPPING_ORDER: ShoppingCategory[] = ["vegetable", "fruit", "protein", "dairy", "grain", "allergen", "other"];

export type ShoppingItem = {
  key: string;
  name: string;
  category: ShoppingCategory;
  amounts: { unit: Unit; amount: number }[];
  /** Vetëm kur është "sipas dëshirës" te të gjitha recetat. */
  optional: boolean;
  recipes: string[];
};

export type ShoppingGroup = { category: ShoppingCategory; items: ShoppingItem[] };

/** "4 porcione bebe" → 4; kur receta s'thotë porcione, null (një gatim për çdo herë). */
export function portionsOf(r: Pick<Recipe, "yieldNote">): number | null {
  const m = /(\d+)\s*porcion/i.exec(r.yieldNote);
  const n = m ? Number(m[1]) : NaN;
  return n > 0 ? n : null;
}

/** Sa herë gatuhet: receta me 4 porcione, e vënë 2 herë në plan, gatuhet një herë. */
export function batchesFor(r: Pick<Recipe, "yieldNote">, uses: number): number {
  const p = portionsOf(r);
  return p ? Math.ceil(uses / p) : uses;
}

/** Sa herë del çdo recetë te vaktet e dhëna. */
export function planUses(plan: PlanMap, keys: string[], lookup: (slug: string) => Recipe | null | undefined): { recipe: Recipe; count: number }[] {
  const counts = new Map<string, number>();
  for (const k of keys) {
    const slug = plan[k];
    if (slug) counts.set(slug, (counts.get(slug) ?? 0) + 1);
  }
  return [...counts].flatMap(([slug, count]) => {
    const recipe = lookup(slug);
    return recipe ? [{ recipe, count }] : [];
  });
}

/** Uji dhe qumështi i gjirit/formula s'blihen. */
const PANTRY = /^(uje|qumesht gjiri)/;

/**
 * Mbledh përbërësit: të njëjtin ushqim (sipas `food_key`, ose emrit kur s'ka) e bashkon dhe ia shton sasitë sipas njësisë
 * (2 karota + 3 karota = 5 karota), i ndan sipas kategorisë.
 */
export function shoppingList(uses: { recipe: Recipe; count: number }[], foods: Food[]): ShoppingGroup[] {
  const foodBy = new Map(foods.map((f) => [f.foodKey, f]));
  const items = new Map<string, ShoppingItem>();
  for (const { recipe, count } of uses) {
    const batches = batchesFor(recipe, count);
    if (batches <= 0) continue;
    for (const ing of recipe.ingredients) {
      const norm = normalize(ing.name);
      const food = ing.foodKey ? foodBy.get(ing.foodKey) : undefined;
      if (!food && PANTRY.test(norm)) continue;
      const key = food ? `f:${food.foodKey}` : `n:${norm}`;
      const item = items.get(key) ?? {
        key,
        name: food?.name ?? ing.name.charAt(0).toUpperCase() + ing.name.slice(1),
        category: food?.category ?? "other",
        amounts: [],
        optional: true,
        recipes: [],
      };
      const same = item.amounts.find((a) => a.unit === ing.unit);
      if (same) same.amount += ing.amount * batches;
      else item.amounts.push({ unit: ing.unit, amount: ing.amount * batches });
      item.optional = item.optional && !!ing.optional;
      if (!item.recipes.includes(recipe.title)) item.recipes.push(recipe.title);
      items.set(key, item);
    }
  }
  const all = [...items.values()].map((i) => ({ ...i, amounts: i.amounts.map((a) => ({ unit: a.unit, amount: roundAmount(a.amount, a.unit) })) }));
  return SHOPPING_ORDER.map((category) => ({
    category,
    items: all.filter((i) => i.category === category).sort((a, b) => a.name.localeCompare(b.name, "sq")),
  })).filter((g) => g.items.length);
}

/** "5 copë", "300 g + 1 copë". */
export const amountText = (item: Pick<ShoppingItem, "amounts">) => item.amounts.map((a) => `${formatAmount(a.amount)} ${a.unit}`).join(" + ");

/** Teksti i "Ndaje" (WhatsApp): titulli, pastaj çdo kategori me artikujt e saj; të blerat s'dalin. */
export function shoppingText(groups: ShoppingGroup[], title: string, label: (c: ShoppingCategory) => string, optional: string, bought: Set<string> = new Set()): string {
  const lines = [title];
  for (const g of groups) {
    const left = g.items.filter((i) => !bought.has(i.key));
    if (!left.length) continue;
    lines.push("", label(g.category));
    left.forEach((i) => lines.push(`• ${i.name}: ${amountText(i)}${i.optional ? ` (${optional})` : ""}`));
  }
  return lines.join("\n");
}
