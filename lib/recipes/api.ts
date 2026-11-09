import AsyncStorage from "@react-native-async-storage/async-storage";
import bundled from "@/content/recipes/sq.json";
import { supabase } from "@/lib/supabase/client";
import { sortRecipes } from "@/lib/recipes/catalog";
import {
  ALLERGENS,
  DIET_TAGS,
  FEEDING_STYLES,
  MEAL_TYPES,
  NUTRIENTS,
  RECIPE_STAGES,
  SEASONS,
  UNITS,
  type Ingredient,
  type Recipe,
  type RecipeStage,
  type ServeByAge,
  type Unit,
} from "@/lib/recipes/types";

/**
 * Biblioteka e recetave, si te Përrallat: merret nga tabela `recipes` (vetëm të publikuarat) dhe ruhet në telefon.
 * Pa rrjet përdoret kopja e ruajtur, dhe kur s'ka as atë (ose migrimi s'është ekzekutuar ende), recetat që vijnë me
 * app-in (content/recipes/sq.json). Recetat janë të shkurtra, ndaj lista merret e plotë: faqja e recetës hapet
 * menjëherë, edhe pa rrjet.
 */
const COLUMNS =
  "slug, title, summary, age_min_months, age_max_months, stage, feeding_style, meal_types, prep_minutes, cook_minutes, yield_note, " +
  "family_factor, ingredients, steps, serve_by_age, allergens, diet_tags, nutrients, freezer_friendly, storage_note, freezer_note, " +
  "reheat_note, choking_note, family_tip, season, is_albanian, cover_key, cover_url, cover_svg, featured, sort_order, updated_at";
const PAGE = 200;
const MAX_PAGES = 5;
const SAVED_KEY = "bebix_recipes_v1";

type BundledRecipe = Omit<Recipe, "coverUrl" | "coverSvg" | "updatedAt">;

export const BUNDLED_RECIPES: Recipe[] = (bundled as unknown as BundledRecipe[]).map((r) => ({ ...r, coverUrl: null, coverSvg: null, updatedAt: null }));

type Row = {
  slug: string;
  title: string;
  summary: string | null;
  age_min_months: number | null;
  age_max_months: number | null;
  stage: string | null;
  feeding_style: string[] | null;
  meal_types: string[] | null;
  prep_minutes: number | null;
  cook_minutes: number | null;
  yield_note: string | null;
  family_factor: number | string | null;
  ingredients: unknown;
  steps: string[] | null;
  serve_by_age: unknown;
  allergens: string[] | null;
  diet_tags: string[] | null;
  nutrients: string[] | null;
  freezer_friendly: boolean | null;
  storage_note: string | null;
  freezer_note: string | null;
  reheat_note: string | null;
  choking_note: string | null;
  family_tip: string | null;
  season: string[] | null;
  is_albanian: boolean | null;
  cover_key: string | null;
  cover_url: string | null;
  cover_svg: string | null;
  featured: boolean | null;
  sort_order: number | null;
  updated_at: string | null;
};

/** Vetëm vlerat që app-i i njeh: një vlerë e re nga paneli s'e prish ekranin. */
const only = <T extends string>(allowed: readonly T[], list: string[] | null | undefined): T[] =>
  (list ?? []).filter((x): x is T => (allowed as readonly string[]).includes(x));

function toIngredients(raw: unknown): Ingredient[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((x) => {
    const i = x as { name?: unknown; amount?: unknown; unit?: unknown; food_key?: unknown; optional?: unknown };
    if (typeof i.name !== "string" || typeof i.amount !== "number" || !(UNITS as readonly string[]).includes(String(i.unit))) return [];
    return [{ name: i.name, amount: i.amount, unit: i.unit as Unit, foodKey: typeof i.food_key === "string" ? i.food_key : null, ...(i.optional ? { optional: true } : {}) }];
  });
}

function toServe(raw: unknown): ServeByAge {
  const out: ServeByAge = {};
  if (!raw || typeof raw !== "object") return out;
  for (const key of ["6-8", "9-11", "12+"] as const) {
    const v = (raw as Record<string, unknown>)[key];
    if (typeof v === "string" && v.trim()) out[key] = v;
  }
  return out;
}

export function toRecipe(r: Row): Recipe {
  return {
    slug: r.slug,
    title: r.title,
    summary: r.summary ?? "",
    ageMinMonths: r.age_min_months ?? 6,
    ageMaxMonths: r.age_max_months ?? 60,
    stage: (RECIPE_STAGES as readonly string[]).includes(r.stage ?? "") ? (r.stage as RecipeStage) : "family",
    feedingStyle: only(FEEDING_STYLES, r.feeding_style),
    mealTypes: only(MEAL_TYPES, r.meal_types),
    prepMinutes: r.prep_minutes ?? 0,
    cookMinutes: r.cook_minutes ?? 0,
    yieldNote: r.yield_note ?? "",
    familyFactor: Number(r.family_factor) || 1,
    ingredients: toIngredients(r.ingredients),
    steps: (r.steps ?? []).filter((s) => typeof s === "string" && s.trim()),
    serveByAge: toServe(r.serve_by_age),
    allergens: only(ALLERGENS, r.allergens),
    dietTags: only(DIET_TAGS, r.diet_tags),
    nutrients: only(NUTRIENTS, r.nutrients),
    freezerFriendly: !!r.freezer_friendly,
    storageNote: r.storage_note ?? "",
    freezerNote: r.freezer_note ?? "",
    reheatNote: r.reheat_note ?? "",
    chokingNote: r.choking_note ?? "",
    familyTip: r.family_tip ?? "",
    season: only(SEASONS, r.season),
    isAlbanian: !!r.is_albanian,
    cover: r.cover_key,
    coverUrl: r.cover_url,
    coverSvg: r.cover_svg,
    featured: !!r.featured,
    sortOrder: r.sort_order ?? 1000,
    updatedAt: r.updated_at,
  };
}

export type RecipeIndex = { recipes: Recipe[]; source: "server" | "saved" | "bundled" };

let memory: RecipeIndex | null = null;

/** Lista e fundit e njohur, pa pritur: për kartën "Ide për sot" dhe hapjen e menjëhershme. */
export function cachedRecipes(): RecipeIndex {
  return memory ?? { recipes: sortRecipes(BUNDLED_RECIPES), source: "bundled" };
}

/** Receta sipas slug, nga lista e njohur. */
export function findRecipe(slug: string): Recipe | null {
  return cachedRecipes().recipes.find((r) => r.slug === slug) ?? BUNDLED_RECIPES.find((r) => r.slug === slug) ?? null;
}

async function fetchServer(): Promise<Recipe[] | null> {
  const rows: Row[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const { data, error } = await supabase
      .from("recipes")
      .select(COLUMNS)
      .eq("status", "published")
      .order("sort_order", { ascending: true })
      .order("slug", { ascending: true })
      .range(page * PAGE, page * PAGE + PAGE - 1);
    if (error || !Array.isArray(data)) return null;
    rows.push(...(data as unknown as Row[]));
    if (data.length < PAGE) break;
  }
  return rows.map(toRecipe).filter((r) => r.ingredients.length && r.steps.length);
}

export async function loadRecipes(): Promise<RecipeIndex> {
  const server = await fetchServer().catch(() => null);
  if (server && server.length) {
    memory = { recipes: sortRecipes(server), source: "server" };
    await AsyncStorage.setItem(SAVED_KEY, JSON.stringify(server)).catch(() => {});
    return memory;
  }
  try {
    const saved = await AsyncStorage.getItem(SAVED_KEY);
    const list = saved ? (JSON.parse(saved) as Recipe[]) : null;
    if (Array.isArray(list) && list.length) {
      memory = { recipes: sortRecipes(list), source: "saved" };
      return memory;
    }
  } catch {
    // Kopja e ruajtur e dëmtuar: kalohet te recetat e app-it.
  }
  memory = { recipes: sortRecipes(BUNDLED_RECIPES), source: "bundled" };
  return memory;
}

export function __resetRecipesForTests() {
  memory = null;
}
