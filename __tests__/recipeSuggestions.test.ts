import { BUNDLED_RECIPES } from "@/lib/recipes/api";
import { BUNDLED_FOODS } from "@/lib/recipes/foods";
import { recipeFoodKeys } from "@/lib/recipes/firstFoods";
import { suggestFor } from "@/lib/recipes/suggestions";
import type { FoodTry } from "@/lib/recipes/types";

// eslint-disable-next-line @typescript-eslint/no-require-imports
jest.mock("@react-native-async-storage/async-storage", () => require("@react-native-async-storage/async-storage/jest/async-storage-mock"));
jest.mock("@/lib/supabase/client", () => ({ supabase: {} }));

const MONDAY = new Date(2026, 10, 23, 9, 0);
const tryOf = (foodKey: string, reaction = false): FoodTry => ({
  id: `t-${foodKey}`, foodKey, triedAt: "2026-11-01T10:00:00Z", liking: "all", reaction, symptoms: [], note: "", recipeSlug: null,
  createdAt: "2026-11-01T10:00:00Z", updatedAt: "2026-11-01T10:00:00Z", deletedAt: null,
});
const base = { recipes: BUNDLED_RECIPES, foods: BUNDLED_FOODS, allergens: [], at: MONDAY };
const byKey = new Map(BUNDLED_FOODS.map((f) => [f.foodKey, f]));

describe("sugjerimet sipas moshës dhe provave", () => {
  it("para 6 muajsh dhe pa moshë: asnjë sugjerim", () => {
    expect(suggestFor({ ...base, tries: [], months: 5 }).newFoods).toEqual([]);
    expect(suggestFor({ ...base, tries: [], months: null }).oneNew).toEqual([]);
  });

  it("7 muaj pa prova: ushqime për moshën, pa alergjenë, me hekur të parat; receta me një ushqim të vetëm", () => {
    const s = suggestFor({ ...base, tries: [], months: 7 });
    expect(s.newFoods).toHaveLength(4);
    for (const f of s.newFoods) {
      expect(f.ageFromMonths).toBeLessThanOrEqual(7);
      expect(f.allergen).toBeNull();
      expect(f.chokingRisk).not.toBe("high");
    }
    expect(s.newFoods[0].nutrients).toContain("iron");
    expect(s.familiar).toEqual([]);
    for (const { recipe, food } of s.oneNew) {
      expect(recipe.ageMinMonths).toBeLessThanOrEqual(7);
      expect(recipeFoodKeys(recipe, BUNDLED_FOODS)).toEqual([food.foodKey]);
      expect(food.allergen).toBeNull();
    }
  });

  it("me ushqimet e provuara: receta që i njeh, dhe receta me saktësisht një ushqim të ri", () => {
    const recipe = BUNDLED_RECIPES.find((r) => r.ageMinMonths <= 9 && recipeFoodKeys(r, BUNDLED_FOODS).length >= 2 && !r.allergens.length)!;
    const keys = recipeFoodKeys(recipe, BUNDLED_FOODS);
    const s = suggestFor({ ...base, tries: keys.map((k) => tryOf(k)), months: 9, limit: { recipes: 200 } });
    expect(s.familiar.map((r) => r.slug)).toContain(recipe.slug);
    expect(s.triedCount).toBe(keys.length);
    for (const { recipe: r, food } of s.oneNew) {
      const fresh = recipeFoodKeys(r, BUNDLED_FOODS).filter((k) => !keys.includes(k));
      expect(fresh).toEqual([food.foodKey]);
    }
    // Ushqimet e provuara s'sugjerohen më si të reja.
    for (const f of s.newFoods) expect(keys).not.toContain(f.foodKey);
  });

  it("një reagim heq çdo recetë me atë ushqim; alergjitë e profilit respektohen", () => {
    const egg = BUNDLED_FOODS.find((f) => f.allergen === "egg")!;
    const s = suggestFor({ ...base, tries: [tryOf(egg.foodKey, true), tryOf("banana")], months: 12, limit: { recipes: 200 } });
    for (const r of [...s.familiar, ...s.oneNew.map((x) => x.recipe)]) expect(recipeFoodKeys(r, BUNDLED_FOODS)).not.toContain(egg.foodKey);
    const noMilk = suggestFor({ ...base, tries: [tryOf("banana")], months: 12, allergens: ["milk"], limit: { recipes: 200 } });
    for (const r of [...noMilk.familiar, ...noMilk.oneNew.map((x) => x.recipe)]) expect(r.allergens).not.toContain("milk");
  });

  it("ushqimet e javës s'ndryshojnë gjatë javës; ndryshojnë grupet (jo të gjitha perime)", () => {
    const mon = suggestFor({ ...base, tries: [], months: 10 }).newFoods.map((f) => f.foodKey);
    const thu = suggestFor({ ...base, tries: [], months: 10, at: new Date(2026, 10, 26, 20, 0) }).newFoods.map((f) => f.foodKey);
    expect(thu).toEqual(mon);
    expect(new Set(mon.map((k) => byKey.get(k)!.category)).size).toBeGreaterThan(1);
  });
});
