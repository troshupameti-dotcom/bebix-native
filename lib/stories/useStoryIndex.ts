import { useCallback, useEffect, useState } from "react";
import { cachedIndex, loadStoryIndex, type StoryIndex } from "@/lib/stories/api";

let loadedOnce = false;
let pending: Promise<StoryIndex> | null = null;

/** Një kërkesë e vetme edhe kur lista hapet njëkohësisht nga disa vende (kreu, biblioteka). */
function fetchIndex(): Promise<StoryIndex> {
  pending ??= loadStoryIndex()
    .catch(() => cachedIndex())
    .finally(() => {
      loadedOnce = true;
      pending = null;
    });
  return pending;
}

/** Lista e përrallave: menjëherë ajo e njohur, pastaj e freskët nga baza (një herë për hapje të app-it). */
export function useStoryIndex(): StoryIndex & { loading: boolean; refreshing: boolean; refresh: () => Promise<void> } {
  const [index, setIndex] = useState<StoryIndex>(cachedIndex);
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

  /** Tërheqja poshtë te biblioteka: merr listën sërish nga baza. */
  const refresh = useCallback(async () => {
    setRefreshing(true);
    const next = await fetchIndex();
    setIndex(next);
    setRefreshing(false);
  }, []);

  return { ...index, loading, refreshing, refresh };
}

export function __resetStoryIndexForTests() {
  loadedOnce = false;
  pending = null;
}
