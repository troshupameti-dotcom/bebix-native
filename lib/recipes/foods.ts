import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import bundled from "@/content/recipes/foods.json";
import { supabase } from "@/lib/supabase/client";
import { ALLERGENS, CHOKING_RISKS, FOOD_CATEGORIES, NUTRIENTS, type Allergen, type ChokingRisk, type Food, type FoodCategory, type ServeByAge } from "@/lib/recipes/types";

/**
 * Ushqimet e para, si recetat: merren nga tabela `foods` dhe ruhen në telefon; pa rrjet (ose para migrimit) përdoret
 * kopja e ruajtur, pastaj ajo që vjen me app-in (content/recipes/foods.json). Shenja e vogël (`emoji`) vjen vetëm nga
 * kopja e app-it.
 */
const COLUMNS = "food_key, name, category, age_from_months, choking_risk, allergen, serve_by_age, nutrients, tip, sort_order";
const SAVED_KEY = "bebix_foods_v1";

export const BUNDLED_FOODS: Food[] = bundled as unknown as Food[];
const EMOJI = new Map(BUNDLED_FOODS.map((f) => [f.foodKey, f.emoji]));

type Row = {
  food_key: string;
  name: string;
  category: string | null;
  age_from_months: number | null;
  choking_risk: string | null;
  allergen: string | null;
  serve_by_age: unknown;
  nutrients: string[] | null;
  tip: string | null;
};

const isOne = <T extends string>(allowed: readonly T[], v: string | null | undefined): v is T => (allowed as readonly string[]).includes(v ?? "");

export function toFood(r: Row): Food | null {
  if (!r.food_key || !r.name || !isOne(FOOD_CATEGORIES, r.category)) return null;
  const serve: ServeByAge = {};
  if (r.serve_by_age && typeof r.serve_by_age === "object") {
    for (const key of ["6-8", "9-11", "12+"] as const) {
      const v = (r.serve_by_age as Record<string, unknown>)[key];
      if (typeof v === "string" && v.trim()) serve[key] = v;
    }
  }
  const emoji = EMOJI.get(r.food_key);
  return {
    foodKey: r.food_key,
    name: r.name,
    category: r.category as FoodCategory,
    ageFromMonths: r.age_from_months ?? 6,
    chokingRisk: isOne(CHOKING_RISKS, r.choking_risk) ? (r.choking_risk as ChokingRisk) : "medium",
    allergen: isOne(ALLERGENS, r.allergen) ? (r.allergen as Allergen) : null,
    serveByAge: serve,
    nutrients: (r.nutrients ?? []).filter((n): n is Food["nutrients"][number] => isOne(NUTRIENTS, n)),
    tip: r.tip ?? "",
    ...(emoji ? { emoji } : {}),
  };
}

let memory: Food[] | null = null;
let loadedOnce = false;
let pending: Promise<Food[]> | null = null;

/** Lista e fundit e njohur, pa pritur. */
export function cachedFoods(): Food[] {
  return memory ?? BUNDLED_FOODS;
}

/** Ushqimi sipas çelësit, nga lista e njohur (ose nga ajo e app-it). */
export function findFood(foodKey: string | null | undefined): Food | null {
  if (!foodKey) return null;
  return cachedFoods().find((f) => f.foodKey === foodKey) ?? BUNDLED_FOODS.find((f) => f.foodKey === foodKey) ?? null;
}

export async function loadFoods(): Promise<Food[]> {
  try {
    const { data, error } = await supabase.from("foods").select(COLUMNS).order("sort_order", { ascending: true }).order("food_key", { ascending: true }).range(0, 499);
    const list = !error && Array.isArray(data) ? (data as unknown as Row[]).map(toFood).filter((f): f is Food => !!f) : [];
    if (list.length) {
      memory = list;
      await AsyncStorage.setItem(SAVED_KEY, JSON.stringify(list)).catch(() => {});
      return list;
    }
  } catch {
    // Pa rrjet: kalohet te kopja e ruajtur.
  }
  try {
    const saved = await AsyncStorage.getItem(SAVED_KEY);
    const list = saved ? (JSON.parse(saved) as Food[]) : null;
    if (Array.isArray(list) && list.length) {
      memory = list;
      return list;
    }
  } catch {
    // Kopja e ruajtur e dëmtuar: ushqimet e app-it.
  }
  memory = BUNDLED_FOODS;
  return memory;
}

/** Ushqimet: menjëherë ato të njohura, pastaj të freskëtat nga baza (një herë për hapje të app-it). */
export function useFoods(): Food[] {
  const [foods, setFoods] = useState<Food[]>(cachedFoods);
  useEffect(() => {
    if (loadedOnce) return;
    let alive = true;
    pending ??= loadFoods().finally(() => {
      loadedOnce = true;
      pending = null;
    });
    void pending.then((next) => alive && setFoods(next)).catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  return foods;
}

export function __resetFoodsForTests() {
  memory = null;
  loadedOnce = false;
  pending = null;
}
