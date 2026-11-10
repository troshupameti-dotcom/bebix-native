import recipes from "@/content/recipes/sq.json";
import {
  allergyConflicts,
  bandForMonths,
  childAllergens,
  filterRecipes,
  fitsBand,
  formatAmount,
  ingredientLine,
  recipeOfTheDay,
  scaleAmount,
  seasonOf,
} from "@/lib/recipes/catalog";
import type { Recipe } from "@/lib/recipes/types";

const list = recipes as unknown as Recipe[];
const slugs = (rs: Recipe[]) => rs.map((r) => r.slug);

describe("recetat: mosha", () => {
  it("grupi sipas muajve; para 6 muajsh s'ka grup", () => {
    expect(bandForMonths(null)).toBeNull();
    expect(bandForMonths(5)).toBeNull();
    expect(bandForMonths(6)).toBe("6-8");
    expect(bandForMonths(8)).toBe("6-8");
    expect(bandForMonths(9)).toBe("9-11");
    expect(bandForMonths(12)).toBe("12-23");
    expect(bandForMonths(30)).toBe("24-60");
    expect(bandForMonths(80)).toBe("24-60");
  });

  it("një bebe 7 muajshe s'sheh receta që nisin nga 9 apo 12 muaj", () => {
    const seven = filterRecipes(list, { band: "6-8" });
    expect(seven.length).toBe(18);
    expect(seven.every((r) => r.ageMinMonths < 9)).toBe(true);
    expect(slugs(seven)).not.toContain("tave-kosi-per-bebe");
  });

  it("një fëmijë 3 vjeç s'sheh purètë e para (deri 12–24 muaj)", () => {
    const three = filterRecipes(list, { band: "24-60" });
    expect(slugs(three)).not.toContain("karote-dhe-patate-ne-avull");
    expect(slugs(three)).toContain("lakror-me-presh");
    expect(three.every((r) => fitsBand(r, "24-60"))).toBe(true);
  });
});

describe("recetat: filtrat", () => {
  it("kërkimi sipas emrit ose përbërësit, edhe pa ë/ç", () => {
    expect(slugs(filterRecipes(list, { query: "kungull" }))).toContain("kungull-i-pjekur-me-dardhe");
    const chicken = filterRecipes(list, { query: "pule" });
    expect(chicken.length).toBeGreaterThan(3);
    expect(chicken.every((r) => r.ingredients.some((i) => i.name.includes("pul")) || r.title.toLowerCase().includes("pul"))).toBe(true);
    expect(filterRecipes(list, { query: "çokollatë" })).toHaveLength(0);
  });

  it("vakti, koha, teksturë, BLW, ngrirja dhe gatimi shqiptar", () => {
    expect(filterRecipes(list, { meal: "breakfast" }).every((r) => r.mealTypes.includes("breakfast"))).toBe(true);
    expect(filterRecipes(list, { time: "15" }).every((r) => r.prepMinutes + r.cookMinutes <= 15)).toBe(true);
    const noCook = filterRecipes(list, { time: "nocook" });
    expect(noCook.length).toBeGreaterThan(0);
    expect(noCook.every((r) => r.cookMinutes === 0)).toBe(true);
    expect(filterRecipes(list, { stage: "finger" }).every((r) => r.stage === "finger")).toBe(true);
    expect(filterRecipes(list, { style: "blw" }).every((r) => r.feedingStyle.includes("blw"))).toBe(true);
    expect(filterRecipes(list, { freezer: true }).every((r) => r.freezerFriendly)).toBe(true);
    expect(filterRecipes(list, { albanian: true }).length).toBeGreaterThanOrEqual(12);
  });

  it("“Pa qumësht” heq çdo recetë me qumësht", () => {
    const free = filterRecipes(list, { without: ["milk"] });
    expect(free.length).toBeLessThan(list.length);
    expect(free.some((r) => r.allergens.includes("milk"))).toBe(false);
  });

  it("e stinës: në dimër s'del turlia e verës", () => {
    const winter = new Date(2026, 0, 15);
    expect(seasonOf(winter)).toBe("winter");
    expect(seasonOf(new Date(2026, 6, 1))).toBe("summer");
    expect(slugs(filterRecipes(list, { seasonal: true, now: winter }))).not.toContain("turli-perimesh-me-pule");
  });
});

describe("recetat: alergjitë e fëmijës", () => {
  it("lexon alergjitë nga teksti i lirë, shqip dhe anglisht", () => {
    expect(childAllergens("Alergji ndaj vezëve dhe qumështit të lopës").sort()).toEqual(["egg", "milk"]);
    expect(childAllergens("peanut, sesame")).toEqual(["peanut", "sesame"]);
    expect(childAllergens("i bën keq kosi")).toEqual(["milk"]);
    expect(childAllergens("arra dhe lajthi")).toEqual(["tree_nut"]);
    expect(childAllergens("peshk")).toEqual(["fish"]);
  });

  it("s'gabon me fjalë që s'janë alergji", () => {
    expect(childAllergens("")).toEqual([]);
    expect(childAllergens(null)).toEqual([]);
    expect(childAllergens("Asnjë")).toEqual([]);
    expect(childAllergens("Jetojmë në Kosovë, s'ka alergji të njohura")).toEqual([]);
  });

  it("paralajmërimi: receta me qumësht për fëmijën alergjik ndaj qumështit", () => {
    const kos = list.find((r) => r.slug === "kos-me-fruta-te-stines")!;
    expect(allergyConflicts(kos, ["milk"])).toEqual(["milk"]);
    expect(allergyConflicts(kos, ["egg"])).toEqual([]);
  });

  it("në listë, recetat me alergjenin e fëmijës dalin të fundit, pa u fshirë", () => {
    const sorted = filterRecipes(list, { band: "6-8", childAllergens: ["egg"] });
    expect(sorted).toHaveLength(18);
    expect(sorted[sorted.length - 1].slug).toBe("omelete-e-bute-me-spinaq");
    expect(sorted.slice(0, -1).some((r) => r.allergens.includes("egg"))).toBe(false);
  });
});

describe("recetat: receta e ditës", () => {
  it("e njëjta gjithë ditën, e përshtatshme për moshën, pa alergjenët e fëmijës", () => {
    const day = new Date(2026, 10, 9, 8);
    const a = recipeOfTheDay(list, 7, ["milk"], day)!;
    const b = recipeOfTheDay(list, 7, ["milk"], new Date(2026, 10, 9, 20))!;
    expect(a.slug).toBe(b.slug);
    expect(a.ageMinMonths).toBeLessThanOrEqual(7);
    expect(a.ageMaxMonths).toBeGreaterThanOrEqual(7);
    expect(a.allergens).not.toContain("milk");
    const week = new Set([...Array(7)].map((_, d) => recipeOfTheDay(list, 7, [], new Date(2026, 10, 9 + d))!.slug));
    expect(week.size).toBeGreaterThan(1);
  });

  it("pa receta të përshtatshme: asgjë", () => {
    expect(recipeOfTheDay(list, 3, [])).toBeNull();
    expect(recipeOfTheDay([], 7, [])).toBeNull();
  });
});

describe("recetat: porcionet", () => {
  it("shumëzimi rrumbullakoset si në kuzhinë dhe kurrë s'bëhet zero", () => {
    expect(scaleAmount(150, "g", 3)).toBe(450);
    expect(scaleAmount(30, "g", 1)).toBe(30);
    expect(scaleAmount(0.5, "copë", 3)).toBe(1.5);
    expect(scaleAmount(0.25, "lugë çaji", 3)).toBe(0.75);
    expect(scaleAmount(1, "lugë çaji", 2)).toBe(2);
    expect(scaleAmount(0.25, "filxhan", 0.5)).toBe(0.25);
    expect(scaleAmount(2, "g", 1.2)).toBe(5);
  });

  it("sasitë shkruhen me thyesa të lexueshme", () => {
    expect(formatAmount(1.5)).toBe("1½");
    expect(formatAmount(0.25)).toBe("¼");
    expect(formatAmount(0.75)).toBe("¾");
    expect(formatAmount(450)).toBe("450");
    expect(ingredientLine({ name: "kungull i verdhë", amount: 400, unit: "g" }, 3)).toBe("1200 g kungull i verdhë");
    expect(ingredientLine({ name: "qepë", amount: 0.5, unit: "copë" })).toBe("½ copë qepë");
  });
});
