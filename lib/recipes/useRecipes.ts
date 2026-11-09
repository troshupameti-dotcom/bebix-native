import { useCallback, useEffect, useState } from "react";
import { cachedRecipes, loadRecipes, type RecipeIndex } from "@/lib/recipes/api";

let loadedOnce = false;
let pending: Promise<RecipeIndex> | null = null;

/** Një kërkesë e vetme edhe kur lista hapet njëkohësisht nga disa vende (faqja e bebit, lista, receta). */
function fetchIndex(): Promise<RecipeIndex> {
  pending ??= loadRecipes()
    .catch(() => cachedRecipes())
    .finally(() => {
      loadedOnce = true;
      pending = null;
    });
  return pending;
}

/** Recetat: menjëherë ato të njohura (edhe ato të app-it), pastaj të freskëtat nga baza (një herë për hapje). */
export function useRecipes(): RecipeIndex & { loading: boolean; refreshing: boolean; refresh: () => Promise<void> } {
  const [index, setIndex] = useState<RecipeIndex>(cachedRecipes);
  const [loading, setLoading] = useState(!loadedOnce);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (loadedOnce) return;
    let alive = true;
    void fetchIndex().then((next) => {
      if (!alive) return;
      setIndex(next);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, []);

  /** Tërheqja poshtë te lista: merr recetat sërish nga baza. */
  const refresh = useCallback(async () => {
    setRefreshing(true);
    const next = await fetchIndex();
    setIndex(next);
    setRefreshing(false);
  }, []);

  return { ...index, loading, refreshing, refresh };
}

export function __resetRecipeIndexForTests() {
  loadedOnce = false;
  pending = null;
}
