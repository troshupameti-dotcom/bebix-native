import { renderScreen, setParams, visibleText } from "./helpers/screen";
import FoodDetail from "@/app/(main)/recipes/food/[key]";
import { NutritionTable, formatAmount } from "@/components/recipes/FoodNutrition";
import { __resetFoodsForTests } from "@/lib/recipes/foods";
import { foodGroup, nutritionFor, portionFor, scaleNutrition, typicalGrams } from "@/lib/recipes/nutrition";
import FOODS from "@/content/recipes/foods.json";
import type { Food } from "@/lib/recipes/types";

const list = FOODS as unknown as Food[];
const food = (key: string) => list.find((f) => f.foodKey === key)!;
const text = (r: Awaited<ReturnType<typeof renderScreen>>) => visibleText(r.root).join(" | ");

beforeEach(() => __resetFoodsForTests());

describe("vlerat ushqyese të ushqimeve", () => {
  it("çdo ushqim ka vlerat e USDA, të arsyeshme për 100 g", () => {
    expect(list).toHaveLength(129);
    for (const f of list) {
      const n = nutritionFor(f.foodKey);
      expect([f.foodKey, n ? "ok" : "mungon"]).toEqual([f.foodKey, "ok"]);
      const v = n!.per100g;
      // Energjia përputhet afërsisht me proteinat, karbohidratet dhe yndyrnat (4/4/9 kcal për gram).
      const fromMacros = v.protein * 4 + v.carbs * 4 + v.fat * 9;
      expect([f.foodKey, Math.abs(fromMacros - v.kcal) <= Math.max(20, v.kcal * 0.2)]).toEqual([f.foodKey, true]);
      for (const x of [v.protein, v.carbs, v.fat, v.iron, v.calcium]) expect(x).toBeGreaterThanOrEqual(0);
      expect(v.protein + v.carbs + v.fat).toBeLessThanOrEqual(101);
      expect(n!.fdcId).toBeGreaterThan(100000);
    }
  });

  it("vlera të njohura: banania, veza, spinaqi", () => {
    expect(nutritionFor("banana")!.per100g).toMatchObject({ kcal: 89, vitC: 8.7 });
    expect(nutritionFor("egg")!.per100g.protein).toBeCloseTo(12.6, 1);
    expect(nutritionFor("spinach")!.per100g.iron).toBeCloseTo(3.57, 2);
    expect(nutritionFor("spinach")!.form).toBe("cooked");
  });
});

describe("gramët për vakt sipas moshës", () => {
  it("rriten me moshën dhe ndjekin grupin e ushqimit", () => {
    expect(portionFor(food("banana"), "6-8")).toEqual({ min: 15, max: 45, unit: "g" });
    expect(portionFor(food("banana"), "12+")).toEqual({ min: 40, max: 80, unit: "g" });
    expect(portionFor(food("trout"), "9-11")).toEqual({ min: 20, max: 30, unit: "g" });
    expect(portionFor(food("egg"), "12+")).toEqual({ min: 50, max: 50, unit: "g" });
    expect(foodGroup(food("kidney_beans"))).toBe("legume");
    expect(foodGroup(food("ground_hazelnuts"))).toBe("nut");
    // Farat jepen me lugë çaji si arrat; mëlçia më pak se mishi; majdanozi pa gramë (erëz).
    expect(foodGroup(food("chia_seeds"))).toBe("nut");
    expect(portionFor(food("chia_seeds"), "6-8")).toEqual({ min: 2, max: 3, unit: "g" });
    expect(portionFor(food("chicken_liver"), "12+")).toEqual({ min: 20, max: 30, unit: "g" });
    expect(portionFor(food("parsley"), "12+")).toBeNull();
    expect(portionFor(food("olives"), "9-11")).toBeNull();
    expect(portionFor(food("olives"), "12+")).toEqual({ min: 5, max: 15, unit: "g" });
  });

  it("qumështi si pije vetëm pas 12 muajsh (në ml); erëzat, mielli dhe peta pa gramë", () => {
    expect(portionFor(food("milk"), "6-8")).toBeNull();
    expect(portionFor(food("milk"), "12+")).toEqual({ min: 100, max: 200, unit: "ml" });
    expect(portionFor(food("lemon"), "12+")).toBeNull();
    expect(portionFor(food("wheat_flour"), "9-11")).toBeNull();
    // Peta nis në 12 muaj: para kësaj s'ka sasi.
    expect(portionFor(food("filo"), "6-8")).toBeNull();
  });

  it("vlerat për një vakt: mesi i racionit, i shumëzuar nga 100 g", () => {
    const p = portionFor(food("banana"), "6-8")!;
    expect(typicalGrams(p)).toBe(30);
    expect(scaleNutrition(nutritionFor("banana")!.per100g, 30).kcal).toBeCloseTo(26.7, 1);
    expect(formatAmount(0.26, "sq")).toBe("0,3");
    expect(formatAmount(0.26, "en")).toBe("0.3");
    expect(formatAmount(0.02, "sq")).toBe("<0,1");
    expect(formatAmount(26.7, "sq", 0)).toBe("27");
    expect(formatAmount(null, "sq")).toBe("–");
  });
});

describe("faqja e ushqimit", () => {
  it("tabela: 100 g dhe një vakt i moshës", async () => {
    const r = await renderScreen(<NutritionTable food={food("banana")} band="6-8" />);
    const t = text(r);
    expect(t).toMatch(/Për 100 g, pa gatim \| 100 g \| Një vakt\n~30 g/);
    // Lexuesi i ekranit e lexon rreshtin të plotë, me njësitë.
    const labels = r.root.findAll((n) => typeof n.props.accessibilityLabel === "string" && n.props.accessible === true).map((n) => n.props.accessibilityLabel);
    expect(labels).toEqual(expect.arrayContaining(["Energjia, 100 g: 89 kcal, 27 kcal", "Hekuri, 100 g: 0,3 mg, 0,1 mg"]));
    expect(t).toMatch(/Energjia \| 89 +\| 27/);
    expect(t).toMatch(/Burimi: USDA FoodData Central/);
  });

  it("gramët te çdo moshë, sa shpesh dhe vlerat ushqyese", async () => {
    setParams({ key: "spinach" });
    const r = await renderScreen(<FoodDetail />);
    const t = text(r);
    expect(t).toMatch(/≈ 15–45 g për vakt/);
    expect(t).toMatch(/≈ 40–80 g për vakt/);
    expect(t).toMatch(/Sasitë janë orientuese: bebi vendos sa ha/);
    expect(t).toMatch(/Sa shpesh \| Çdo ditë; ngjyrat e ndryshme/);
    expect(t).toMatch(/Vlerat ushqyese \| Për 100 g, pas gatimit/);
  });

  it("një ushqim i ri (troftë) ka gjithçka: si servohet, gramët, peshku 1–2 herë në javë", async () => {
    setParams({ key: "trout" });
    const r = await renderScreen(<FoodDetail />);
    const t = text(r);
    expect(t).toMatch(/Troftë/);
    expect(t).toMatch(/≈ 10–25 g për vakt/);
    expect(t).toMatch(/1–2 herë në javë/);
    expect(t).toMatch(/Omega-3|Proteinë/);
  });

  it("mëlçia dhe toni: “sa shpesh” e tyre, jo ai i grupit; fotoja mbush krejt gjerësinë e kartës", async () => {
    setParams({ key: "chicken_liver" });
    const r = await renderScreen(<FoodDetail />);
    expect(text(r)).toMatch(/Sa shpesh \| Një herë në javë, në sasi të vogël/);
    expect(text(r)).not.toMatch(/Mund të jepet çdo ditë/);
    const photo = r.root.findAll((n) => n.props.contentFit === "cover" && n.props.style?.width === "100%");
    expect(photo.length).toBeGreaterThan(0);

    setParams({ key: "tuna" });
    const tuna = await renderScreen(<FoodDetail />);
    expect(text(tuna)).toMatch(/Jo më shumë se një herë në javë, për shkak të merkurit/);
  });
});
