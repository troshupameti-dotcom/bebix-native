import { useEffect, useMemo, useSyncExternalStore } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/lib/supabase/client";
import { useCurrentUserId } from "@/lib/hooks/useCurrentUserId";

/**
 * Recetat e preferuara ❤️ të çdo llogarie, si te Përrallat: ruhen fillimisht në telefon (punojnë pa rrjet) dhe
 * dërgohen te `recipe_favorites`; ndryshimet e padërguara (`dirty`) provohen sërish te hapja e radhës. Kur vjen
 * lista nga serveri, fiton ajo, përveç ndryshimeve të padërguara të këtij telefoni.
 */
type Favorite = { on: boolean; at: string; dirty?: boolean };
type Data = Record<string, Favorite>;

const key = (owner: string) => `bebix_recipe_favorites_v1:${owner}`;
const PULL_EVERY_MS = 5 * 60_000;

let owner: string | null = null;
let data: Data = {};
let ready = false;
let lastPull = 0;
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function set(next: Data) {
  data = next;
  emit();
  if (owner) void AsyncStorage.setItem(key(owner), JSON.stringify(next)).catch(() => {});
}

async function load(userId: string | null) {
  const who = userId ?? "guest";
  if (owner === who && ready) return;
  owner = who;
  ready = false;
  lastPull = 0;
  // Të preferuarat e llogarisë së mëparshme s'i sheh kjo llogari.
  data = {};
  emit();
  let saved: Data = {};
  try {
    const raw = await AsyncStorage.getItem(key(who));
    if (raw) saved = JSON.parse(raw) as Data;
  } catch {
    saved = {};
  }
  if (owner !== who) return;
  // Zemra e shtypur gjatë leximit nga telefoni s'humbet.
  const early = data;
  data = { ...saved, ...early };
  ready = true;
  emit();
}

async function push(userId: string, slug: string, fav: Favorite): Promise<boolean> {
  const { error } = fav.on
    ? await supabase.from("recipe_favorites").upsert({ user_id: userId, recipe_slug: slug, created_at: fav.at }, { onConflict: "user_id,recipe_slug" })
    : await supabase.from("recipe_favorites").delete().eq("user_id", userId).eq("recipe_slug", slug);
  return !error;
}

function markClean(slug: string, at: string) {
  const entry = data[slug];
  if (!entry || entry.at !== at || !entry.dirty) return;
  set({ ...data, [slug]: { ...entry, dirty: false } });
}

/** Dërgon ndryshimet e padërguara dhe merr gjendjen e serverit. Gabimet heshten: provohet herën tjetër. */
async function sync(userId: string) {
  if (Date.now() - lastPull < PULL_EVERY_MS) return;
  lastPull = Date.now();
  for (const [slug, fav] of Object.entries(data)) {
    if (fav.dirty && (await push(userId, slug, fav))) markClean(slug, fav.at);
  }
  const { data: rows, error } = await supabase.from("recipe_favorites").select("recipe_slug, created_at").eq("user_id", userId);
  if (owner !== userId || error || !Array.isArray(rows)) return;
  const next: Data = {};
  for (const [slug, fav] of Object.entries(data)) if (fav.dirty) next[slug] = fav;
  for (const r of rows as { recipe_slug: string; created_at: string }[]) if (!next[r.recipe_slug]) next[r.recipe_slug] = { on: true, at: r.created_at };
  set(next);
}

function ensure(userId: string | null) {
  if (!loading || owner !== (userId ?? "guest")) {
    loading = load(userId).then(() => {
      loading = null;
    });
  }
  return loading ?? Promise.resolve();
}

export function toggleRecipeFavorite(slug: string, userId: string | null): boolean {
  const on = !data[slug]?.on;
  const fav: Favorite = { on, at: new Date().toISOString(), dirty: !!userId };
  set({ ...data, [slug]: fav });
  if (userId) void push(userId, slug, fav).then((ok) => ok && markClean(slug, fav.at)).catch(() => {});
  return on;
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export type RecipeFavorites = { userId: string | null; favorites: string[]; isFavorite: (slug: string) => boolean };

export function useRecipeFavorites(): RecipeFavorites {
  const userId = useCurrentUserId();
  const snapshot = useSyncExternalStore(subscribe, () => data, () => data);

  useEffect(() => {
    void ensure(userId).then(() => (userId ? sync(userId) : undefined)).catch(() => {});
  }, [userId]);

  const favorites = useMemo(
    () =>
      Object.entries(snapshot)
        .filter(([, f]) => f.on)
        .sort((a, b) => (a[1].at < b[1].at ? 1 : -1))
        .map(([slug]) => slug),
    [snapshot]
  );

  return { userId, favorites, isFavorite: (slug) => !!snapshot[slug]?.on };
}

export function __resetRecipeFavoritesForTests() {
  owner = null;
  data = {};
  ready = false;
  lastPull = 0;
  loading = null;
}
