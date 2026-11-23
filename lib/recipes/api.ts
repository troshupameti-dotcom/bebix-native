import AsyncStorage from "@react-native-async-storage/async-storage";
import { File, Paths } from "expo-file-system";
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
/** Deri në 10 000 receta: praktikisht pa kufi. Kufiri mbron vetëm nga një cikël pa fund nëse serveri gabon. */
const MAX_PAGES = 50;
/** Kopja e vjetër në AsyncStorage (lexohet ende, nëse s'ka skedar). */
const SAVED_KEY = "bebix_recipes_v1";
/**
 * Kopja pa rrjet ruhet në skedar, jo në AsyncStorage: në Android një vlerë e AsyncStorage s'lexohet dot mbi ~2 MB
 * (rreth 700 receta), dhe atëherë app-i pa rrjet binte te 100 recetat që vijnë me të.
 */
const CACHE_FILE = "recipes-v1.json";

function cacheFile(): File | null {
  try {
    return new File(Paths.document, CACHE_FILE);
  } catch {
    // Web ose test: pa sistem skedarësh.
    return null;
  }
}

/**
 * Kopja e ruajtur: recetat dhe gjendja e serverit kur u morën. `count` dhe `maxUpdatedAt` lejojnë që hapja tjetër
 * të pyesë vetëm "a ka ndryshuar diçka?" (dy kërkesa të vogla), jo ta shkarkojë gjithë listën; `slugs` janë të
 * gjitha recetat e publikuara (edhe ato që app-i i hedh si të paplota), për të dalluar kur një recetë hiqet.
 */
export type RecipeCache = { recipes: Recipe[]; count: number | null; maxUpdatedAt: string | null; slugs: string[] };

async function writeCache(cache: RecipeCache): Promise<void> {
  const json = JSON.stringify({ v: 2, ...cache });
  try {
    const file = cacheFile();
    if (!file) throw new Error("no file system");
    if (!file.exists) file.create({ intermediates: true });
    await file.write(json);
    await AsyncStorage.removeItem(SAVED_KEY).catch(() => {});
  } catch {
    await AsyncStorage.setItem(SAVED_KEY, json).catch(() => {});
  }
}

/** Kopja e ruajtur; formati i parë (vetëm lista e recetave) lexohet ende, pa të dhënat e sinkronizimit. */
export function parseCache(raw: unknown): RecipeCache | null {
  if (Array.isArray(raw)) return raw.length ? { recipes: raw as Recipe[], count: null, maxUpdatedAt: null, slugs: [] } : null;
  if (!raw || typeof raw !== "object") return null;
  const c = raw as Partial<RecipeCache>;
  if (!Array.isArray(c.recipes) || !c.recipes.length) return null;
  return {
    recipes: c.recipes,
    count: typeof c.count === "number" ? c.count : null,
    maxUpdatedAt: typeof c.maxUpdatedAt === "string" ? c.maxUpdatedAt : null,
    slugs: Array.isArray(c.slugs) ? c.slugs.filter((x): x is string => typeof x === "string") : [],
  };
}

async function readCache(): Promise<RecipeCache | null> {
  try {
    const file = cacheFile();
    if (file?.exists) return parseCache(JSON.parse(await file.text()));
  } catch {
    // Skedari i dëmtuar: provohet kopja e vjetër.
  }
  const saved = await AsyncStorage.getItem(SAVED_KEY);
  return saved ? parseCache(JSON.parse(saved)) : null;
}

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

const valid = (r: Recipe) => r.ingredients.length > 0 && r.steps.length > 0;

/** Faqe pas faqeje, me renditje të qëndrueshme; null kur një faqe dështon. */
async function fetchPages<T>(columns: string, since: string | null, pageSize: number): Promise<T[] | null> {
  const rows: T[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    let query = supabase.from("recipes").select(columns).eq("status", "published");
    if (since) query = query.gte("updated_at", since);
    const { data, error } = await query
      .order("sort_order", { ascending: true })
      .order("slug", { ascending: true })
      .range(page * pageSize, page * pageSize + pageSize - 1);
    if (error || !Array.isArray(data)) return null;
    rows.push(...(data as unknown as T[]));
    if (data.length < pageSize) break;
  }
  return rows;
}

/** "A ka ndryshuar diçka?": numri i recetave të publikuara dhe ndryshimi i fundit, pa shkarkuar receta. */
async function fetchSummary(): Promise<{ count: number; maxUpdatedAt: string | null } | null> {
  const [counted, newest] = await Promise.all([
    supabase.from("recipes").select("slug", { count: "exact", head: true }).eq("status", "published"),
    supabase.from("recipes").select("updated_at").eq("status", "published").order("updated_at", { ascending: false }).limit(1),
  ]);
  if (counted.error || newest.error || typeof counted.count !== "number") return null;
  const top = (newest.data as { updated_at: string | null }[] | null)?.[0];
  return { count: counted.count, maxUpdatedAt: top?.updated_at ?? null };
}

/**
 * Bashkon ndryshimet me kopjen: recetat e ndryshuara zëvendësojnë të vjetrat (sipas slug), të rejat shtohen, dhe kur
 * jepet lista e plotë e slug-eve, hiqen ato që s'janë më të publikuara.
 */
export function mergeRecipes(cached: Recipe[], changed: Recipe[], keep: Set<string> | null): Recipe[] {
  const bySlug = new Map(cached.map((r) => [r.slug, r]));
  for (const r of changed) {
    if (valid(r)) bySlug.set(r.slug, r);
    else bySlug.delete(r.slug);
  }
  return [...bySlug.values()].filter((r) => !keep || keep.has(r.slug));
}

/**
 * Hapja e parë (ose pa kopje): të gjitha recetat. Më pas: dy kërkesa të vogla; kur s'ka ndryshuar asgjë, s'shkarkohet
 * asnjë recetë. Kur ka ndryshime, merren vetëm recetat e ndryshuara që nga hera e fundit; kur numri s'përputhet
 * (është hequr ose fshehur një recetë), merren vetëm slug-et për të hequr ato që s'janë më.
 * Kështu 10 000 receta s'shkarkohen sa herë hapet app-i (rreth 26 MB), por vetëm një herë.
 */
async function syncServer(cache: RecipeCache | null): Promise<RecipeCache | null> {
  const summary = await fetchSummary();
  if (!summary) return null;
  if (cache && cache.count === summary.count && cache.maxUpdatedAt === summary.maxUpdatedAt && cache.maxUpdatedAt) return cache;

  if (!cache || !cache.maxUpdatedAt || cache.count == null) {
    const rows = await fetchPages<Row>(COLUMNS, null, PAGE);
    if (!rows) return null;
    return { recipes: rows.map(toRecipe).filter(valid), count: summary.count, maxUpdatedAt: summary.maxUpdatedAt, slugs: rows.map((r) => r.slug) };
  }

  const changedRows = await fetchPages<Row>(COLUMNS, cache.maxUpdatedAt, PAGE);
  if (!changedRows) return null;
  const known = new Set([...cache.slugs, ...changedRows.map((r) => r.slug)]);
  let slugs = [...known];
  let keep: Set<string> | null = null;
  if (known.size !== summary.count) {
    const list = await fetchPages<{ slug: string }>("slug", null, 1000);
    if (!list) return null;
    slugs = list.map((r) => r.slug);
    keep = new Set(slugs);
  }
  return {
    recipes: mergeRecipes(cache.recipes, changedRows.map(toRecipe), keep),
    count: summary.count,
    maxUpdatedAt: summary.maxUpdatedAt,
    slugs,
  };
}

export async function loadRecipes(): Promise<RecipeIndex> {
  const cache = await readCache().catch(() => null);
  const synced = await syncServer(cache).catch(() => null);
  if (synced && synced.recipes.length) {
    memory = { recipes: sortRecipes(synced.recipes), source: "server" };
    if (synced !== cache) await writeCache(synced);
    return memory;
  }
  if (cache && cache.recipes.length) {
    memory = { recipes: sortRecipes(cache.recipes), source: "saved" };
    return memory;
  }
  memory = { recipes: sortRecipes(BUNDLED_RECIPES), source: "bundled" };
  return memory;
}

export function __resetRecipesForTests() {
  memory = null;
}
