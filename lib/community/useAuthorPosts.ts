import { useCallback, useRef, useState } from "react";
import { AUTHOR_PAGE_SIZE, countPostsByAuthor, fetchPostsByAuthor, type CommunityPost } from "@/lib/communityData";

/**
 * Postimet e një autori për profilin, pa kufi: numri vjen nga serveri (jo sa janë lexuar), dhe `loadMore` lexon
 * faqen tjetër kur lista arrin në fund. `reset` nis nga e para (hapja e profilit, kthimi te ekrani).
 */
export function useAuthorPosts() {
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [total, setTotal] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const run = useRef({ author: null as string | null, page: 0, more: false, busy: false });

  const reset = useCallback(async (authorId: string | null): Promise<CommunityPost[]> => {
    const current = { author: authorId, page: 0, more: false, busy: false };
    run.current = current;
    if (!authorId) {
      setPosts([]);
      setTotal(0);
      return [];
    }
    const [list, count] = await Promise.all([fetchPostsByAuthor(authorId), countPostsByAuthor(authorId).catch(() => null)]);
    if (run.current !== current) return list;
    current.more = list.length >= AUTHOR_PAGE_SIZE;
    setPosts(list);
    setTotal(Math.max(count ?? 0, list.length));
    return list;
  }, []);

  const loadMore = useCallback(async () => {
    const current = run.current;
    if (!current.author || !current.more || current.busy) return;
    current.busy = true;
    setLoadingMore(true);
    try {
      const next = await fetchPostsByAuthor(current.author, current.page + 1);
      if (run.current !== current) return;
      current.page += 1;
      current.more = next.length >= AUTHOR_PAGE_SIZE;
      setPosts((prev) => {
        const seen = new Set(prev.map((p) => p.id));
        return [...prev, ...next.filter((p) => !seen.has(p.id))];
      });
    } catch {
      // Rrjeti ra: provohet sërish herën tjetër që lista arrin në fund.
    } finally {
      current.busy = false;
      setLoadingMore(false);
    }
  }, []);

  /** Postimi u fshi ose u fsheh: del nga lista dhe numri zbret. */
  const remove = useCallback((id: string) => {
    setPosts((prev) => prev.filter((p) => p.id !== id));
    setTotal((n) => Math.max(0, n - 1));
  }, []);

  return { posts, total, loadingMore, reset, loadMore, remove };
}

/** Për ScrollView: a është afër fundit (400 px), që të lexohet faqja tjetër. */
export function nearEnd(e: { layoutMeasurement: { height: number }; contentOffset: { y: number }; contentSize: { height: number } }): boolean {
  return e.layoutMeasurement.height + e.contentOffset.y >= e.contentSize.height - 400;
}
