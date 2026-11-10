import foodsJson from "@/content/recipes/foods.json";
import recipesJson from "@/content/recipes/sq.json";
import { summarizeTries } from "@/lib/recipes/firstFoods";
import { fitsMonths, roundAmount, scaleAmount } from "@/lib/recipes/catalog";
import {
  MAX_REPEATS,
  addDays,
  amountText,
  batchesFor,
  blockedAllergens,
  fillWeek,
  firstFreeSlot,
  freezerAssignments,
  freezerPicks,
  freezerSchedule,
  isoDay,
  mealsForMonths,
  newFoodSuggestion,
  planUses,
  plannableRecipes,
  portionsOf,
  shoppingList,
  shoppingText,
  slotKey,
  weekDays,
  weekStartOf,
  type PlanChild,
  type PlanMap,
} from "@/lib/recipes/planner";
import { pickTools, toolKindOf } from "@/lib/recipes/tools";
import { MEAL_TYPES, type Food, type FoodTry, type Recipe } from "@/lib/recipes/types";
import type { Product } from "@/lib/homeContent";

// Logjika e listës së mjeteve s'ka nevojë për rrjetin.
jest.mock("@/lib/shopData", () => ({ fetchProductsMatching: jest.fn(async () => []) }));

const FOODS = foodsJson as unknown as Food[];
const RECIPES = recipesJson as unknown as Recipe[];
const bySlug = new Map(RECIPES.map((r) => [r.slug, r]));

let n = 0;
const tryOf = (foodKey: string, extra: Partial<FoodTry> = {}): FoodTry => {
  n += 1;
  const at = new Date(Date.UTC(2026, 10, 1, 8, n)).toISOString();
  return { id: `t${n}`, foodKey, triedAt: at, liking: null, reaction: false, symptoms: [], note: "", recipeSlug: null, createdAt: at, updatedAt: at, deletedAt: null, ...extra };
};
const child = (months: number | null, extra: Partial<PlanChild> = {}): PlanChild => ({ months, allergens: [], tries: [], foods: FOODS, ...extra });
const WEEK = weekDays("2026-11-16");

function fill(c: PlanChild, plan: PlanMap = {}, seed = 7, from?: string) {
  return fillWeek({ days: WEEK, meals: mealsForMonths(c.months), plan, recipes: plannableRecipes(RECIPES, c), catalog: RECIPES, summary: summarizeTries(c.tries), foods: FOODS, seed, from });
}
const countUses = (plan: PlanMap) => {
  const m = new Map<string, number>();
  Object.values(plan).forEach((s) => s && m.set(s, (m.get(s) ?? 0) + 1));
  return m;
};

describe("plani: ditët e javës", () => {
  it("java nis të hënën, edhe kur sot është e diel; datat sipas orës së telefonit", () => {
    expect(weekStartOf(new Date(2026, 10, 22, 23, 30))).toBe("2026-11-16");
    expect(weekStartOf(new Date(2026, 10, 16, 0, 5))).toBe("2026-11-16");
    expect(isoDay(new Date(2026, 0, 1, 0, 1))).toBe("2026-01-01");
    expect(addDays("2026-11-30", 1)).toBe("2026-12-01");
    expect(WEEK).toEqual(["2026-11-16", "2026-11-17", "2026-11-18", "2026-11-19", "2026-11-20", "2026-11-21", "2026-11-22"]);
  });
});

describe("plani: filtrat e moshës dhe alergjive", () => {
  it("vetëm recetat e moshës; pa moshë, të gjitha", () => {
    for (const m of [6, 8, 10, 15, 30, 54]) {
      const list = plannableRecipes(RECIPES, child(m, { tries: FOODS.filter((f) => f.allergen).flatMap((f) => [tryOf(f.foodKey), tryOf(f.foodKey), tryOf(f.foodKey)]) }));
      expect(list.length).toBeGreaterThan(0);
      expect(list.every((r) => fitsMonths(r, m))).toBe(true);
    }
    expect(plannableRecipes(RECIPES, child(4))).toHaveLength(0);
  });

  it("alergjitë e profilit dhe reagimet s'vendosen kurrë; nën 12 muaj as alergjenët e paprezantuar", () => {
    const withEggAllergy = plannableRecipes(RECIPES, child(20, { allergens: ["egg"] }));
    expect(withEggAllergy.some((r) => r.allergens.includes("egg"))).toBe(false);
    expect(withEggAllergy.some((r) => r.allergens.includes("milk"))).toBe(true);

    const reaction = child(20, { tries: [tryOf("yogurt", { reaction: true, symptoms: ["rash"] })] });
    expect(blockedAllergens(reaction).has("milk")).toBe(true);
    expect(plannableRecipes(RECIPES, reaction).some((r) => r.allergens.includes("milk"))).toBe(false);

    const baby = child(8);
    expect(plannableRecipes(RECIPES, baby).every((r) => r.allergens.length === 0)).toBe(true);
    const introducedEgg = child(8, { tries: [tryOf("egg"), tryOf("egg"), tryOf("egg")] });
    expect(blockedAllergens(introducedEgg).has("egg")).toBe(false);
    expect(blockedAllergens(introducedEgg).has("milk")).toBe(true);
  });
});

describe("plani: \"Plotëso javën për mua\"", () => {
  it("plotëson çdo vakt, pa e përsëritur një recetë më shumë se 2 herë, me hekur çdo ditë", () => {
    const c = child(20);
    const { assigned, daysWithoutIron } = fill(c);
    expect(Object.keys(assigned)).toHaveLength(7 * MEAL_TYPES.length);
    expect(Math.max(...countUses(assigned).values())).toBeLessThanOrEqual(MAX_REPEATS);
    expect(daysWithoutIron).toEqual([]);
    for (const day of WEEK) {
      expect(MEAL_TYPES.some((m) => bySlug.get(assigned[slotKey(day, m)]!)?.nutrients.includes("iron"))).toBe(true);
      // E njëjta recetë s'del dy herë në të njëjtën ditë.
      const slugs = MEAL_TYPES.map((m) => assigned[slotKey(day, m)]);
      expect(new Set(slugs).size).toBe(slugs.length);
    }
    for (const [key, slug] of Object.entries(assigned)) expect(bySlug.get(slug!)!.mealTypes).toContain(key.split(":")[1]);
  });

  it("edhe për 6–8 muaj: vetëm recetat e moshës, pa zemër, pa alergjenë, hekur sa herë ka", () => {
    const c = child(7);
    const { assigned, daysWithoutIron } = fill(c);
    const used = Object.values(assigned).map((s) => bySlug.get(s!)!);
    expect(used.length).toBeGreaterThan(0);
    expect(used.every((r) => fitsMonths(r, 7) && r.allergens.length === 0)).toBe(true);
    expect(Object.keys(assigned).some((k) => k.endsWith(":snack"))).toBe(false);
    expect(Math.max(...countUses(assigned).values())).toBeLessThanOrEqual(MAX_REPEATS);
    // Me 2 herë në javë për recetë, ditët pa hekur janë vetëm kur s'mjaftojnë recetat me hekur të moshës.
    const ironRecipes = plannableRecipes(RECIPES, c).filter((r) => r.nutrients.includes("iron")).length;
    expect(daysWithoutIron.length).toBe(Math.max(0, 7 - ironRecipes * MAX_REPEATS));
  });

  it("mban vaktet e prindit, i numëron te kufiri dhe s'prek ditët para sot", () => {
    const c = child(20);
    const mine = RECIPES.find((r) => fitsMonths(r, 20) && r.mealTypes.includes("lunch") && !r.allergens.length)!;
    const plan: PlanMap = { [slotKey(WEEK[2], "lunch")]: mine.slug, [slotKey(WEEK[3], "lunch")]: mine.slug };
    const { assigned } = fill(c, plan, 3, WEEK[2]);
    expect(assigned[slotKey(WEEK[2], "lunch")]).toBeUndefined();
    expect(Object.values(assigned)).not.toContain(mine.slug);
    expect(Object.keys(assigned).some((k) => k.startsWith(WEEK[0]) || k.startsWith(WEEK[1]))).toBe(false);
  });

  it("ushqimet që i pëlqejnë dalin më shpesh se ato që i refuzon", () => {
    const withBanana = (liking: "all" | "refused") => {
      let total = 0;
      for (let seed = 1; seed <= 12; seed++) {
        const { assigned } = fill(child(20, { tries: [tryOf("banana", { liking })] }), {}, seed);
        total += Object.values(assigned).filter((s) => bySlug.get(s!)!.ingredients.some((i) => i.foodKey === "banana" && !i.optional)).length;
      }
      return total;
    };
    expect(withBanana("all")).toBeGreaterThan(withBanana("refused"));
  });

  it("vakti i parë bosh nga sot, me drekën dhe mëngjesin përpara", () => {
    const plan: PlanMap = { [slotKey(WEEK[1], "lunch")]: "x" };
    expect(firstFreeSlot(WEEK, ["breakfast", "lunch", "dinner"], plan, WEEK[1])).toEqual({ day: WEEK[1], meal: "breakfast" });
    expect(firstFreeSlot(WEEK, ["lunch"], plan, WEEK[1])).toEqual({ day: WEEK[2], meal: "lunch" });
  });
});

describe("plani: \"Provo diçka të re ✨\"", () => {
  it("një recetë me një ushqim të paprovuar (jo alergjen), të moshës", () => {
    const c = child(10, { tries: [tryOf("carrot"), tryOf("potato")] });
    const summary = summarizeTries(c.tries);
    const s = newFoodSuggestion(RECIPES, c, summary, 1)!;
    expect(s).not.toBeNull();
    expect(fitsMonths(s.recipe, 10)).toBe(true);
    expect(summary.has(s.foodKey)).toBe(false);
    expect(FOODS.find((f) => f.foodKey === s.foodKey)!.allergen).toBeNull();
    expect(newFoodSuggestion(RECIPES, c, summary, 1, [s.recipe.slug])?.recipe.slug).not.toBe(s.recipe.slug);
  });

  it("kur ka provuar gjithçka, s'propozon asgjë", () => {
    const c = child(30, { tries: FOODS.map((f) => tryOf(f.foodKey)) });
    expect(newFoodSuggestion(RECIPES, c, summarizeTries(c.tries), 1)).toBeNull();
  });
});

describe("plani: dita e gatimit për ngrirje", () => {
  it("deri në 3 receta që ngrijnë, me hekur, për 5 ditë pa asnjë më shumë se 2 herë", () => {
    const c = child(14);
    const picks = freezerPicks(plannableRecipes(RECIPES, c), new Map(), FOODS, 5);
    expect(picks).toHaveLength(3);
    expect(picks.every((r) => r.freezerFriendly && fitsMonths(r, 14))).toBe(true);
    expect(picks.some((r) => r.nutrients.includes("iron"))).toBe(true);
    const schedule = freezerSchedule(picks);
    expect(schedule.map((r) => r.slug)).toEqual([picks[0], picks[1], picks[2], picks[0], picks[1]].map((r) => r.slug));
    expect(freezerSchedule(picks.slice(0, 1))).toHaveLength(2);
  });

  it("vendoset te dreka (ose darka) dhe s'prek vaktet e zëna", () => {
    const picks = freezerPicks(plannableRecipes(RECIPES, child(14)), new Map(), FOODS, 5);
    const schedule = freezerSchedule(picks);
    const plan: PlanMap = { [slotKey(WEEK[0], "lunch")]: "e-prindit", [slotKey(WEEK[0], "dinner")]: "e-prindit-2" };
    const out = freezerAssignments(WEEK.slice(0, 5), schedule, plan);
    expect(Object.keys(out).some((k) => k.startsWith(WEEK[0]))).toBe(false);
    expect(Object.keys(out)).toHaveLength(4);
  });
});

describe("plani: lista e blerjeve", () => {
  const base = RECIPES[0];
  const recipe = (slug: string, ingredients: Recipe["ingredients"], yieldNote = "1 tavë"): Recipe => ({ ...base, slug, title: slug, yieldNote, ingredients });

  it("bashkon të njëjtat: 2 karota + 3 karota = 5 karota, sipas kategorisë; uji s'blihet", () => {
    const a = recipe("a", [
      { name: "karotë", amount: 2, unit: "copë", foodKey: "carrot" },
      { name: "ujë", amount: 200, unit: "ml", foodKey: null },
      { name: "vaj ulliri", amount: 1, unit: "lugë çaji", foodKey: null },
    ]);
    const b = recipe("b", [
      { name: "karota të grira", amount: 3, unit: "copë", foodKey: "carrot" },
      { name: "kungull", amount: 150, unit: "g", foodKey: "pumpkin" },
      { name: "karotë", amount: 50, unit: "g", foodKey: "carrot" },
      { name: "kanellë", amount: 0.25, unit: "lugë çaji", foodKey: null, optional: true },
    ]);
    const groups = shoppingList([{ recipe: a, count: 1 }, { recipe: b, count: 1 }], FOODS);
    const carrot = groups.flatMap((g) => g.items).find((i) => i.key === "f:carrot")!;
    expect(carrot.amounts).toEqual([{ unit: "copë", amount: 5 }, { unit: "g", amount: 50 }]);
    expect(amountText(carrot)).toBe("5 copë + 50 g");
    expect(carrot.recipes).toEqual(["a", "b"]);
    expect(groups[0].category).toBe("vegetable");
    expect(groups[groups.length - 1].category).toBe("other");
    const all = groups.flatMap((g) => g.items);
    expect(all.some((i) => /ujë/i.test(i.name))).toBe(false);
    expect(all.find((i) => i.name === "Kanellë")?.optional).toBe(true);
    expect(all.find((i) => i.name === "Vaj ulliri")?.optional).toBe(false);
  });

  it("receta me 4 porcione, e vënë 2 herë, gatuhet një herë; 5 herë → dy herë", () => {
    const r = recipe("pure", [{ name: "karotë", amount: 2, unit: "copë", foodKey: "carrot" }], "4 porcione bebe");
    expect(portionsOf(r)).toBe(4);
    expect(portionsOf({ yieldNote: "12 qofte" })).toBeNull();
    expect(batchesFor(r, 2)).toBe(1);
    expect(batchesFor(r, 5)).toBe(2);
    expect(batchesFor({ yieldNote: "12 qofte" }, 2)).toBe(2);
    const plan: PlanMap = { [slotKey(WEEK[0], "lunch")]: "pure", [slotKey(WEEK[1], "lunch")]: "pure", [slotKey(WEEK[2], "lunch")]: "zhdukur" };
    const uses = planUses(plan, Object.keys(plan), (s) => (s === "pure" ? r : null));
    expect(uses).toEqual([{ recipe: r, count: 2 }]);
    expect(shoppingList(uses, FOODS)[0].items[0].amounts).toEqual([{ unit: "copë", amount: 2 }]);
  });

  it("\"Ndaje\": sipas kategorive, pa ato që janë blerë", () => {
    const groups = shoppingList(
      [{ recipe: recipe("a", [{ name: "karotë", amount: 2, unit: "copë", foodKey: "carrot" }, { name: "dardhë", amount: 1, unit: "copë", foodKey: "pear" }]), count: 1 }],
      FOODS
    );
    const text = shoppingText(groups, "🛒 Lista", (c) => c.toUpperCase(), "sipas dëshirës", new Set(["f:pear"]));
    expect(text).toContain("VEGETABLE");
    expect(text).toContain("• Karotë: 2 copë");
    expect(text).not.toContain("Dardhë");
  });

  it("shumëzimi i porcioneve dhe rrumbullakimi s'japin kurrë zero", () => {
    expect(scaleAmount(150, "g", 3)).toBe(450);
    expect(scaleAmount(1, "lugë çaji", 0.1)).toBe(0.25);
    expect(roundAmount(0.6, "copë")).toBe(0.5);
    expect(roundAmount(0.01, "g")).toBe(5);
  });
});

describe("mjetet nga dyqani", () => {
  const product = (id: string, name: string, extra: Partial<Product> = {}): Product => ({
    id, name, brand: "B", price: 10, compareAtPrice: null, category: "ushqyerja", icon: "cube", accent: "olive", rating: 5, badge: null, stock: 3, minAgeMonths: null, maxAgeMonths: null, ...extra,
  });
  it("njeh blenderin, tasin, lugën dhe përparësen; \"Biberon\" s'është përparëse", () => {
    expect(toolKindOf("Blender me avull 4 në 1")).toBe("blender");
    expect(toolKindOf("Tas me thithëse")).toBe("bowl");
    expect(toolKindOf("Lugë silikoni, 2 copë")).toBe("spoon");
    expect(toolKindOf("Përparëse silikoni")).toBe("bib");
    expect(toolKindOf("Biberon qetësues nate")).toBeNull();
    expect(toolKindOf("Tastierë muzikore")).toBeNull();
  });

  it("deri në 2, vetëm në stok dhe të moshës, sipas asaj që i duhet recetës", () => {
    const pure = RECIPES.find((r) => r.stage === "pure")!;
    const list = [
      product("1", "Përparëse silikoni"),
      product("2", "Lugë silikoni", { minAgeMonths: 24 }),
      product("3", "Blender me avull", { stock: 0 }),
      product("4", "Tas me thithëse", { minAgeMonths: 4, maxAgeMonths: 36 }),
      product("5", "Lugë të buta", { minAgeMonths: 4, maxAgeMonths: 24 }),
      product("6", "Biberon qetësues"),
    ];
    expect(pickTools(list, pure, 6).map((p) => p.id)).toEqual(["5", "4"]);
    expect(pickTools(list, { ...pure, stage: "finger" }, 10).map((p) => p.id)).toEqual(["1", "4"]);
    expect(pickTools([product("6", "Biberon qetësues")], pure, 6)).toEqual([]);
  });
});
