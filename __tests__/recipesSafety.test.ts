import recipes from "@/content/recipes/sq.json";
import foods from "@/content/recipes/foods.json";
import { ALLERGENS, DIET_TAGS, MEAL_TYPES, NUTRIENTS, RECIPE_STAGES, SEASONS, UNITS, type Recipe } from "@/lib/recipes/types";
import { normalize } from "@/lib/recipes/catalog";

/**
 * Siguria e përmbajtjes së recetave: asnjë recetë s'i shkel rregullat e Bebix-it. Ekzekutohet mbi kopjen e app-it
 * (content/recipes/sq.json), që testi SQL e krahason me bazën. Çdo grup i ri recetash kalon këtu para se të
 * bëhet migrim.
 */
const list = recipes as unknown as Recipe[];
const FOOD = new Map(foods.map((f) => [f.foodKey, f]));
const text = (r: Recipe) => normalize([r.title, r.summary, ...r.steps, ...r.ingredients.map((i) => i.name)].join(" "));
/** Mohimet ("pa kripë", "mos shto sheqer", "me sa më pak kripë") s'janë kripë apo sheqer i shtuar. */
const withoutNegations = (s: string) =>
  normalize(s)
    .replace(/\bpa (sheqer|kripe)( e pa (sheqer|kripe))?\b/g, " ")
    .replace(/\bmos (shto|hidh|vendos) (sheqer|kripe)\b/g, " ")
    .replace(/\b(sa )?me pak kripe\b/g, " ");
const ingredientsText = (r: Recipe) => withoutNegations(r.ingredients.map((i) => i.name).join(" ; "));
const stepsText = (r: Recipe) => withoutNegations(r.steps.join(" ; "));
const has = (r: Recipe, key: string) => r.ingredients.some((i) => i.foodKey === key);

describe("recetat: struktura", () => {
  it("60 receta (40 fillestare + 20 të dimrit) me numrat e kërkuar sipas moshës", () => {
    const at = (from: number, to: number) => list.filter((r) => r.ageMinMonths >= from && r.ageMinMonths < to).length;
    expect(list).toHaveLength(60);
    expect([at(6, 9), at(9, 12), at(12, 24), at(24, 61)]).toEqual([18, 18, 15, 9]);
    expect(list.filter((r) => r.isAlbanian).length).toBeGreaterThanOrEqual(12);
    expect(list.filter((r) => r.nutrients.includes("iron")).length).toBeGreaterThanOrEqual(10);
    expect(list.filter((r) => r.freezerFriendly).length).toBeGreaterThanOrEqual(8);
  });

  it("slug-e unike dhe vlera vetëm nga listat e lejuara", () => {
    expect(new Set(list.map((r) => r.slug)).size).toBe(list.length);
    for (const r of list) {
      expect(r.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(RECIPE_STAGES).toContain(r.stage);
      expect(r.ageMaxMonths).toBeGreaterThanOrEqual(r.ageMinMonths);
      expect(r.ageMinMonths).toBeGreaterThanOrEqual(6);
      for (const m of r.mealTypes) expect(MEAL_TYPES).toContain(m);
      for (const a of r.allergens) expect(ALLERGENS).toContain(a);
      for (const d of r.dietTags) expect(DIET_TAGS).toContain(d);
      for (const n of r.nutrients) expect(NUTRIENTS).toContain(n);
      for (const s of r.season) expect(SEASONS).toContain(s);
    }
  });

  it("njësitë vetëm g, ml, copë, lugë gjelle, lugë çaji, filxhan; sasi reale", () => {
    for (const r of list) {
      for (const i of r.ingredients) {
        expect({ slug: r.slug, unit: (UNITS as readonly string[]).includes(i.unit) }).toEqual({ slug: r.slug, unit: true });
        expect(i.amount).toBeGreaterThan(0);
        if (i.unit === "g" || i.unit === "ml") expect(i.amount).toBeLessThanOrEqual(1500);
        else expect(i.amount).toBeLessThanOrEqual(12);
      }
    }
  });

  it("çdo ushqim i recetës është te lista e ushqimeve, dhe alergjenët e recetës dalin prej tyre", () => {
    for (const r of list) {
      const fromFoods = new Set<string>();
      for (const i of r.ingredients) {
        if (!i.foodKey) continue;
        expect({ slug: r.slug, food: FOOD.has(i.foodKey) ? "ok" : i.foodKey }).toEqual({ slug: r.slug, food: "ok" });
        const a = FOOD.get(i.foodKey)?.allergen;
        if (a) fromFoods.add(a);
      }
      expect({ slug: r.slug, allergens: [...r.allergens].sort() }).toEqual({ slug: r.slug, allergens: [...fromFoods].sort() });
    }
  });

  it("çdo recetë ka mënyrën e servirjes për moshat e veta, kujdesin ndaj mbytjes, ruajtjen dhe këshillën për familjen", () => {
    for (const r of list) {
      if (r.ageMinMonths < 9) expect(r.serveByAge["6-8"]).toBeTruthy();
      if (r.ageMinMonths < 12) expect(r.serveByAge["9-11"]).toBeTruthy();
      expect(r.serveByAge["12+"]).toBeTruthy();
      for (const field of [r.chokingNote, r.storageNote, r.freezerNote, r.reheatNote, r.familyTip, r.summary, r.yieldNote]) {
        expect(field.trim().length).toBeGreaterThan(5);
      }
      expect(r.steps.length).toBeGreaterThanOrEqual(2);
    }
  });
});

describe("recetat: rregullat e sigurisë", () => {
  it("pa mjaltë askund", () => {
    for (const r of list) expect({ slug: r.slug, honey: /\b(mjalt|honey)/.test(text(r)) }).toEqual({ slug: r.slug, honey: false });
  });

  it("pa kripë e pa sheqer te përbërësit; para 12 muajsh as te hapat", () => {
    for (const r of list) {
      expect({ slug: r.slug, salt: /\bkrip/.test(ingredientsText(r)) }).toEqual({ slug: r.slug, salt: false });
      expect({ slug: r.slug, sugar: /\bsheqer/.test(ingredientsText(r)) }).toEqual({ slug: r.slug, sugar: false });
      if (r.ageMinMonths < 12) {
        expect({ slug: r.slug, saltStep: /\bkrip/.test(stepsText(r)) }).toEqual({ slug: r.slug, saltStep: false });
        expect({ slug: r.slug, sugarStep: /\bsheqer/.test(stepsText(r)) }).toEqual({ slug: r.slug, sugarStep: false });
      }
    }
  });

  it("vezët, mishi dhe peshku gatuhen plotësisht", () => {
    const needs = ["egg", "chicken", "beef", "lamb", "salmon", "sea_bass", "hake"];
    for (const r of list) {
      if (!r.ingredients.some((i) => i.foodKey && needs.includes(i.foodKey))) continue;
      expect({ slug: r.slug, cooked: /plotesisht/.test(normalize(r.steps.join(" "))) }).toEqual({ slug: r.slug, cooked: true });
      expect(r.cookMinutes).toBeGreaterThan(0);
    }
  });

  it("pa peshk me shumë merkur", () => {
    for (const r of list) {
      expect({ slug: r.slug, mercury: /\b(shpat|peshkaqen|marlin|ton\b|tuna)/.test(normalize(r.ingredients.map((i) => i.name).join(" "))) }).toEqual({
        slug: r.slug,
        mercury: false,
      });
    }
  });

  it("qumështi i lopës para 12 muajsh vetëm i gatuar, jo si pije", () => {
    for (const r of list) if (r.ageMinMonths < 12 && has(r, "milk")) expect(r.cookMinutes).toBeGreaterThan(0);
  });

  it("kundër mbytjes: pa arra të plota e kokoshka; rrushi në katërsh; kikiriku vetëm si gjalpë i holluar", () => {
    for (const r of list) {
      const names = normalize(r.ingredients.map((i) => i.name).join(" ; "));
      expect({ slug: r.slug, popcorn: /kokoshk/.test(names) }).toEqual({ slug: r.slug, popcorn: false });
      for (const i of r.ingredients) {
        const n = normalize(i.name);
        if (/\b(arr|lajthi|bajam|kikirik|festek|shqeme)/.test(n)) expect({ slug: r.slug, nut: /gjalpe|bluar/.test(n) }).toEqual({ slug: r.slug, nut: true });
      }
      if (has(r, "grapes") || /qershi/.test(names)) {
        expect({ slug: r.slug, quartered: /katersh/.test(normalize([...r.steps, r.chokingNote].join(" "))) }).toEqual({ slug: r.slug, quartered: true });
      }
      if (has(r, "peanut_butter")) expect(normalize(r.chokingNote)).toMatch(/hollu|perzier/);
    }
  });

  it("para 12 muajsh: molla dhe karota e fortë gatuhen, kurrë të papjekura", () => {
    for (const r of list) {
      if (r.ageMinMonths >= 12 || !(has(r, "apple") || has(r, "carrot") || has(r, "quince"))) continue;
      expect({ slug: r.slug, cooked: r.cookMinutes > 0 }).toEqual({ slug: r.slug, cooked: true });
    }
  });

  it("pa premtime mjekësore", () => {
    for (const r of list) {
      const all = normalize([text(r), r.chokingNote, r.familyTip, ...Object.values(r.serveByAge)].join(" "));
      expect({ slug: r.slug, claim: /\b(sheron|kuron|imunitet|parandalon|mjekon|detoks)/.test(all) }).toEqual({ slug: r.slug, claim: false });
    }
  });
});
