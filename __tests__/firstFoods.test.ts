import foodsJson from "@/content/recipes/foods.json";
import recipesJson from "@/content/recipes/sq.json";
import {
  ALLERGEN_PLAN,
  PLAN_ORDER,
  allergenInProgress,
  allergenProgress,
  alternativeRecipe,
  recipeFoodKeys,
  recipesWithFood,
  serveKeyFor,
  summarizeTries,
  triedFoodsCount,
} from "@/lib/recipes/firstFoods";
import { ALLERGENS, CHOKING_RISKS, FOOD_CATEGORIES, NUTRIENTS, type Food, type FoodTry, type Recipe } from "@/lib/recipes/types";

const FOODS = foodsJson as unknown as Food[];
const byKey = new Map(FOODS.map((f) => [f.foodKey, f]));
const BUNDLED_RECIPES = recipesJson as unknown as Recipe[];

let n = 0;
const tryOf = (foodKey: string, extra: Partial<FoodTry> = {}): FoodTry => {
  n += 1;
  const at = new Date(Date.UTC(2026, 10, 1, 8, n)).toISOString();
  return { id: `t${n}`, foodKey, triedAt: at, liking: null, reaction: false, symptoms: [], note: "", recipeSlug: null, createdAt: at, updatedAt: at, deletedAt: null, ...extra };
};

describe("ushqimet e para: përmbajtja", () => {
  it("80 ushqime, pa përsëritje, me të gjitha fushat e vlefshme", () => {
    expect(FOODS).toHaveLength(80);
    expect(new Set(FOODS.map((f) => f.foodKey)).size).toBe(80);
    for (const f of FOODS) {
      expect(f.foodKey).toMatch(/^[a-z0-9]+(_[a-z0-9]+)*$/);
      expect(FOOD_CATEGORIES).toContain(f.category);
      expect(CHOKING_RISKS).toContain(f.chokingRisk);
      expect(f.allergen === null || (ALLERGENS as readonly string[]).includes(f.allergen)).toBe(true);
      expect(f.ageFromMonths).toBeGreaterThanOrEqual(6);
      for (const k of ["6-8", "9-11", "12+"] as const) expect(f.serveByAge[k]?.trim()).toBeTruthy();
      for (const x of f.nutrients) expect(NUTRIENTS).toContain(x);
      expect(f.tip.trim()).toBeTruthy();
    }
  });

  it("çdo food_key i recetave ekziston te ushqimet", () => {
    const missing = recipesJson.flatMap((r) => r.ingredients.map((i) => i.foodKey)).filter((k): k is string => !!k && !byKey.has(k));
    expect([...new Set(missing)]).toEqual([]);
  });

  it("plani i alergjenëve fillon për çdo alergjen me një ushqim që e ka atë alergjen", () => {
    expect([...PLAN_ORDER].sort()).toEqual([...ALLERGENS].sort());
    for (const a of ALLERGENS) expect(byKey.get(ALLERGEN_PLAN[a].foodKey)?.allergen).toBe(a);
  });

  /** Fjalitë pa mohimet ("pa kripë", "asnjëherë arra të plota"), që kontrolli të kapë vetëm këshillat e gabuara. */
  const plain = (s: string) =>
    s
      .toLowerCase()
      .replace(/\b(pa|jo|asnjëherë|kurrë)\s+[^.;,]*/g, "")
      .replace(/me pak kripë/g, "");

  it("rregullat e sigurisë: pa mjaltë, kripë a sheqer para kohe; rrushi dhe qershitë në katërsh; arrat vetëm të bluara", () => {
    for (const f of FOODS) {
      const baby = [f.serveByAge["6-8"]!, f.serveByAge["9-11"]!];
      for (const s of [...baby, f.tip]) expect(plain(s)).not.toMatch(/mjaltë/);
      for (const s of baby) expect(plain(s)).not.toMatch(/\bkripë|\bsheqer/);
      for (const s of Object.values(f.serveByAge)) expect(plain(s!)).not.toMatch(/\bsheqer/);
    }
    for (const key of ["grapes", "cherries"]) for (const s of Object.values(byKey.get(key)!.serveByAge)) expect(s).toMatch(/katërsh/);
    expect(byKey.get("tomato")!.serveByAge["6-8"]).toMatch(/katërsh/);
    for (const key of ["ground_walnuts", "ground_almonds"]) for (const s of Object.values(byKey.get(key)!.serveByAge)) expect(s).toMatch(/bluara|krem/);
    expect(byKey.get("peanut_butter")!.serveByAge["6-8"]).toMatch(/holluar/);
    expect(byKey.get("milk")!.serveByAge["6-8"]).toMatch(/jo si pije para 12 muajsh/);
    expect(byKey.get("milk")!.serveByAge["9-11"]).toMatch(/jo si pije para 12 muajsh/);
  });

  it("karota dhe molla për 6–8 muaj vetëm të gatuara; vezët, mishi e peshku të gatuar plotësisht", () => {
    for (const key of ["carrot", "apple", "quince"]) expect(byKey.get(key)!.serveByAge["6-8"]).toMatch(/zier|pjekur/);
    for (const key of ["carrot", "apple"]) expect(byKey.get(key)!.serveByAge["12+"]).toMatch(/grirë/);
    for (const key of ["egg", "chicken", "beef", "salmon", "cod", "turkey", "lamb", "shrimp", "sardines", "sea_bass"]) {
      expect(byKey.get(key)!.serveByAge["6-8"]).toMatch(/plotësisht|zier fort/);
    }
  });
});

describe("ushqimet e para: llogaritjet", () => {
  it("numëruesi numëron ushqime të ndryshme, jo prova", () => {
    const tries = [tryOf("banana"), tryOf("banana"), tryOf("egg")];
    expect(triedFoodsCount(tries)).toBe(2);
    const s = summarizeTries(tries).get("banana")!;
    expect(s.count).toBe(2);
  });

  it("pëlqimi i fundit i njohur: një provë pa përgjigje s'e fshin", () => {
    const s = summarizeTries([tryOf("pear", { liking: "refused" }), tryOf("pear")]).get("pear")!;
    expect(s.lastLiking).toBe("refused");
    expect(summarizeTries([tryOf("pear", { liking: "refused" }), tryOf("pear", { liking: "all" })]).get("pear")!.lastLiking).toBe("all");
  });

  it("plani: 3 prova pa reagim → i prezantuar; çdo ushqim me të njëjtin alergjen vlen", () => {
    const one = allergenProgress([tryOf("egg")], FOODS).find((p) => p.allergen === "egg")!;
    expect(one).toMatchObject({ status: "in_progress", tries: 1, nextStep: 1 });
    const milk = allergenProgress([tryOf("yogurt"), tryOf("cheese"), tryOf("gjize")], FOODS).find((p) => p.allergen === "milk")!;
    expect(milk).toMatchObject({ status: "introduced", tries: 3, nextStep: null });
    expect(allergenProgress([], FOODS).every((p) => p.status === "not_started" && p.nextStep === 0)).toBe(true);
  });

  it("plani: një reagim e ndal planin te ai alergjen", () => {
    const p = allergenProgress([tryOf("peanut_butter"), tryOf("peanut_butter", { reaction: true, symptoms: ["rash"] })], FOODS).find((x) => x.allergen === "peanut")!;
    expect(p.status).toBe("reaction");
    expect(p.nextStep).toBeNull();
    expect(p.reactionAt).toBeTruthy();
  });

  it("një alergjen i ri në herë: tregohet ai që është në mes", () => {
    expect(allergenInProgress(allergenProgress([tryOf("tahini")], FOODS))).toBe("sesame");
    expect(allergenInProgress(allergenProgress([tryOf("egg"), tryOf("egg"), tryOf("egg")], FOODS))).toBeNull();
  });

  it("alternativa pas refuzimit: me të njëjtin ushqim, për moshën, jo receta e refuzuar", () => {
    const withCarrot = recipesWithFood(BUNDLED_RECIPES, "carrot", 7);
    expect(withCarrot.length).toBeGreaterThan(1);
    const refused = withCarrot[0].slug;
    for (let d = 0; d < 10; d++) {
      const alt = alternativeRecipe(BUNDLED_RECIPES, "carrot", 7, refused, new Date(Date.UTC(2026, 10, 1 + d)))!;
      expect(alt.slug).not.toBe(refused);
      expect(alt.ingredients.some((i) => i.foodKey === "carrot")).toBe(true);
      expect(alt.ageMinMonths).toBeLessThanOrEqual(7);
    }
  });

  it("ushqimet e recetës: pa përsëritje dhe pa ato sipas dëshirës", () => {
    const r = { ingredients: [
      { name: "a", amount: 1, unit: "g" as const, foodKey: "egg" },
      { name: "b", amount: 1, unit: "g" as const, foodKey: "egg" },
      { name: "c", amount: 1, unit: "g" as const, foodKey: "banana", optional: true },
      { name: "d", amount: 1, unit: "g" as const, foodKey: null },
    ] };
    expect(recipeFoodKeys(r, FOODS)).toEqual(["egg"]);
  });

  it("grupi i servirjes sipas moshës", () => {
    expect([5, 6, 8, 9, 11, 12, 30].map(serveKeyFor)).toEqual([null, "6-8", "6-8", "9-11", "9-11", "12+", "12+"]);
  });
});
