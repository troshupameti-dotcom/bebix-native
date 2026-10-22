import { useEffect, useMemo, useSyncExternalStore } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/lib/supabase/client";
import { useCurrentUserId } from "@/lib/hooks/useCurrentUserId";

/**
 * Të preferuarat dhe leximi i përrallave, për çdo llogari. Ruhen fillimisht në telefon (punojnë pa rrjet) dhe
 * dërgohen te `story_favorites` / `story_progress`; ndryshimet e padërguara (`dirty`) provohen sërish te hapja
 * e radhës. Kur vjen lista nga serveri, fiton ajo, përveç ndryshimeve të padërguara të këtij telefoni.
 */
type Favorite = { on: boolean; at: string; dirty?: boolean };
/**
 * Vendi i leximit sipas paragrafit (`page` = paragrafi ku nis faqja, `pages` = numri i paragrafëve): faqet e librit
 * ndryshojnë me ekranin dhe madhësinë e shkronjave, paragrafët jo.
 */
export type StoryProgress = { page: number; pages: number; finished: boolean; at: string; dirty?: boolean };
type Data = { favorites: Record<string, Favorite>; progress: Record<string, StoryProgress> };

const EMPTY: Data = { favorites: {}, progress: {} };
const key = (owner: string) => `bebix_stories_user_v1:${owner}`;
/** Sa shpesh merret gjendja nga serveri (p.sh. leximi në telefonin e prindit tjetër). */
const PULL_EVERY_MS = 5 * 60_000;

let owner: string | null = null;
let data: Data = EMPTY;
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
  // Të dhënat e llogarisë së mëparshme s'i sheh kjo llogari.
  data = EMPTY;
  emit();
  let saved: Data = EMPTY;
  try {
    const raw = await AsyncStorage.getItem(key(who));
    if (raw) saved = { ...EMPTY, ...(JSON.parse(raw) as Data) };
  } catch {
    saved = EMPTY;
  }
  if (owner !== who) return;
  // Ndryshimet e bëra gjatë leximit nga telefoni (p.sh. zemra e shtypur menjëherë) s'humbasin.
  const early = data;
  data = { favorites: { ...saved.favorites, ...early.favorites }, progress: { ...saved.progress, ...early.progress } };
  ready = true;
  emit();
  if (Object.keys(early.favorites).length || Object.keys(early.progress).length) {
    void AsyncStorage.setItem(key(who), JSON.stringify(data)).catch(() => {});
  }
}

async function pushFavorite(userId: string, slug: string, fav: Favorite): Promise<boolean> {
  const { error } = fav.on
    ? await supabase.from("story_favorites").upsert({ user_id: userId, story_slug: slug, created_at: fav.at }, { onConflict: "user_id,story_slug" })
    : await supabase.from("story_favorites").delete().eq("user_id", userId).eq("story_slug", slug);
  return !error;
}

async function pushProgress(userId: string, slug: string, p: StoryProgress): Promise<boolean> {
  const { error } = await supabase
    .from("story_progress")
    .upsert({ user_id: userId, story_slug: slug, page: p.page, pages: p.pages, finished: p.finished, updated_at: p.at }, { onConflict: "user_id,story_slug" });
  return !error;
}

function markClean(kind: "favorites" | "progress", slug: string, at: string) {
  const entry = data[kind][slug];
  if (!entry || entry.at !== at || !entry.dirty) return;
  set({ ...data, [kind]: { ...data[kind], [slug]: { ...entry, dirty: false } } });
}

/** Dërgon ndryshimet e padërguara dhe merr gjendjen e serverit. Gabimet heshten: provohet herën tjetër. */
async function sync(userId: string, force = false) {
  if (!force && Date.now() - lastPull < PULL_EVERY_MS) return;
  lastPull = Date.now();
  const who = userId;

  for (const [slug, fav] of Object.entries(data.favorites)) {
    if (fav.dirty && (await pushFavorite(who, slug, fav))) markClean("favorites", slug, fav.at);
  }
  for (const [slug, p] of Object.entries(data.progress)) {
    if (p.dirty && (await pushProgress(who, slug, p))) markClean("progress", slug, p.at);
  }

  const [favs, prog] = await Promise.all([
    supabase.from("story_favorites").select("story_slug, created_at").eq("user_id", who),
    supabase.from("story_progress").select("story_slug, page, pages, finished, updated_at").eq("user_id", who).order("updated_at", { ascending: false }).limit(200),
  ]);
  if (owner !== who) return;
  let next = data;
  if (!favs.error && Array.isArray(favs.data)) {
    const server = new Map((favs.data as { story_slug: string; created_at: string }[]).map((r) => [r.story_slug, r.created_at]));
    const favorites: Record<string, Favorite> = {};
    for (const [slug, fav] of Object.entries(next.favorites)) if (fav.dirty) favorites[slug] = fav;
    for (const [slug, at] of server) if (!favorites[slug]) favorites[slug] = { on: true, at };
    next = { ...next, favorites };
  }
  if (!prog.error && Array.isArray(prog.data)) {
    const progress: Record<string, StoryProgress> = { ...next.progress };
    for (const r of prog.data as { story_slug: string; page: number; pages: number; finished: boolean; updated_at: string }[]) {
      const mine = progress[r.story_slug];
      if (mine?.dirty || (mine && mine.at >= r.updated_at)) continue;
      progress[r.story_slug] = { page: r.page, pages: r.pages, finished: r.finished, at: r.updated_at };
    }
    next = { ...next, progress };
  }
  if (next !== data) set(next);
}

function ensure(userId: string | null) {
  if (!loading || owner !== (userId ?? "guest")) {
    loading = load(userId).then(() => {
      loading = null;
    });
  }
  return loading ?? Promise.resolve();
}

export function toggleFavorite(slug: string, userId: string | null) {
  const on = !data.favorites[slug]?.on;
  const fav: Favorite = { on, at: new Date().toISOString(), dirty: !!userId };
  set({ ...data, favorites: { ...data.favorites, [slug]: fav } });
  if (userId) void pushFavorite(userId, slug, fav).then((ok) => ok && markClean("favorites", slug, fav.at)).catch(() => {});
  return on;
}

/** Paragrafi ku mbeti prindi (nga 0). Kur arrin te "Fund", përralla shënohet e lexuar dhe mbetet e tillë. */
export function saveProgress(slug: string, page: number, pages: number, userId: string | null, reachedEnd = false) {
  const prev = data.progress[slug];
  const finished = reachedEnd || !!prev?.finished;
  if (prev && prev.page === page && prev.pages === pages && prev.finished === finished) return;
  const p: StoryProgress = { page, pages, finished, at: new Date().toISOString(), dirty: !!userId };
  set({ ...data, progress: { ...data.progress, [slug]: p } });
  if (userId) void pushProgress(userId, slug, p).then((ok) => ok && markClean("progress", slug, p.at)).catch(() => {});
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export type StoryUserData = {
  ready: boolean;
  userId: string | null;
  favorites: string[];
  isFavorite: (slug: string) => boolean;
  progressOf: (slug: string) => StoryProgress | null;
  /** Përrallat e hapura, nga e fundit. */
  recent: string[];
};

export function useStoryUserData(): StoryUserData {
  const userId = useCurrentUserId();
  const snapshot = useSyncExternalStore(subscribe, () => data, () => data);
  const isReady = useSyncExternalStore(subscribe, () => ready && owner === (userId ?? "guest"), () => ready);

  useEffect(() => {
    void ensure(userId).then(() => (userId ? sync(userId) : undefined)).catch(() => {});
  }, [userId]);

  const favorites = useMemo(
    () =>
      Object.entries(snapshot.favorites)
        .filter(([, f]) => f.on)
        .sort((a, b) => (a[1].at < b[1].at ? 1 : -1))
        .map(([slug]) => slug),
    [snapshot.favorites]
  );
  const recent = useMemo(
    () =>
      Object.entries(snapshot.progress)
        .sort((a, b) => (a[1].at < b[1].at ? 1 : -1))
        .map(([slug]) => slug),
    [snapshot.progress]
  );

  return {
    ready: isReady,
    userId,
    favorites,
    isFavorite: (slug) => !!snapshot.favorites[slug]?.on,
    progressOf: (slug) => snapshot.progress[slug] ?? null,
    recent,
  };
}

export function __resetStoryUserDataForTests() {
  owner = null;
  data = EMPTY;
  ready = false;
  lastPull = 0;
  loading = null;
}
