import { useEffect, useState } from "react";
import { fetchProductsMatching } from "@/lib/shopData";
import { normalize } from "@/lib/recipes/catalog";
import type { Product } from "@/lib/homeContent";
import type { Recipe, RecipeStage } from "@/lib/recipes/types";

/**
 * "Mjetet që të ndihmojnë" te receta: deri në 2 produkte nga Dyqani (blender, tasa, lugë silikoni, përparëse), vetëm
 * kur ekzistojnë, janë në stok dhe i përshtaten moshës. S'ka njoftime nga dyqani: kjo shfaqet vetëm te faqja e recetës.
 */
export type ToolKind = "blender" | "bowl" | "spoon" | "bib";

/** Te baza (PostgreSQL, me ë): "Biberon" s'është "bib", "tastierë" s'është "tas". */
export const TOOL_NAME_REGEX =
  "(\\mlug[eëa]t?\\M|\\mtas[aeit]?\\M|\\mtasat\\M|\\mblend|\\mp[eë]rpar[eë]s|\\mpjat|\\mmikser|\\mbibs?\\M|\\mbowls?\\M|\\mspoons?\\M|\\mplates?\\M)";

/** E njëjta gjë te app-i, mbi emrin pa ë/ç. */
const KIND_WORDS: Record<ToolKind, RegExp> = {
  blender: /\b(blend\w*|mikser\w*)/,
  bowl: /\b(tas|tasa|tase|tasi|tasat|pjat\w*|bowls?|plates?)\b/,
  spoon: /\b(luge|luga|luget|spoons?)\b/,
  bib: /\b(perpares\w*|bibs?)\b/,
};

export function toolKindOf(name: string): ToolKind | null {
  const n = normalize(name);
  return (Object.keys(KIND_WORDS) as ToolKind[]).find((k) => KIND_WORDS[k].test(n)) ?? null;
}

/** Çfarë i duhet më shumë kësaj recete: purè → blender e lugë; copa → përparëse e tas. */
const ORDER: Record<RecipeStage, ToolKind[]> = {
  pure: ["blender", "spoon", "bowl", "bib"],
  mashed: ["spoon", "bowl", "blender", "bib"],
  finger: ["bib", "bowl"],
  family: ["bowl", "bib"],
};

/** Mosha për të cilën kërkohen produktet: e fëmijës kur dihet, përndryshe ajo e recetës. */
export function toolAge(recipe: Pick<Recipe, "ageMinMonths" | "ageMaxMonths">, months: number | null): { from: number; to: number } {
  return months != null ? { from: months, to: months } : { from: recipe.ageMinMonths, to: recipe.ageMaxMonths };
}

const fitsAge = (p: Product, age: { from: number; to: number }) => (p.minAgeMonths == null || p.minAgeMonths <= age.to) && (p.maxAgeMonths == null || p.maxAgeMonths >= age.from);

/** Deri në 2 produkte, një për lloj, sipas asaj që i duhet recetës. */
export function pickTools(products: Product[], recipe: Pick<Recipe, "stage" | "ageMinMonths" | "ageMaxMonths">, months: number | null): Product[] {
  const age = toolAge(recipe, months);
  const usable = products.filter((p) => (p.stock ?? 0) > 0 && fitsAge(p, age));
  const out: Product[] = [];
  for (const kind of ORDER[recipe.stage] ?? ORDER.family) {
    const p = usable.find((x) => toolKindOf(x.name) === kind && !out.includes(x));
    if (p) out.push(p);
    if (out.length === 2) break;
  }
  return out;
}

const cache = new Map<string, Promise<Product[]>>();

export function useRecipeTools(recipe: Recipe | null, months: number | null): Product[] {
  const [tools, setTools] = useState<Product[]>([]);

  useEffect(() => {
    if (!recipe) return;
    const age = toolAge(recipe, months);
    const key = `${age.from}-${age.to}`;
    let alive = true;
    let request = cache.get(key);
    if (!request) {
      request = fetchProductsMatching(TOOL_NAME_REGEX, age).catch(() => {
        cache.delete(key);
        return [] as Product[];
      });
      cache.set(key, request);
    }
    void request.then((list) => {
      if (alive) setTools(pickTools(list, recipe, months));
    });
    return () => {
      alive = false;
    };
  }, [recipe, months]);

  return tools;
}

export function __resetRecipeToolsForTests() {
  cache.clear();
}
