import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/lib/supabase/client";
import { BUNDLED_STORIES, bundledStory, cleanCategories, readingMinutes, sortStories } from "@/lib/stories/catalog";
import type { Story, StoryMeta } from "@/lib/stories/types";

/**
 * Biblioteka e përrallave. Lista (pa tekst) merret nga tabela `stories` dhe ruhet në telefon; teksti merret vetëm
 * kur hapet një përrallë dhe ruhet sipas versionit (`updated_at`). Pa rrjet përdoret lista e ruajtur, dhe kur
 * s'ka as atë (ose migrimi s'është ekzekutuar ende), përrallat që vijnë me app-in.
 */
const META_COLUMNS = "slug, title, summary, categories, age_min_months, age_max_months, reading_minutes, cover_key, cover_url, featured, sort_order, updated_at";
/** Kolona e ilustrimit të Claude-it vjen me migrimin 20261025090000; para tij pyetja përsëritet pa të. */
let hasSvgColumn = true;
const metaColumns = (): string => (hasSvgColumn ? `${META_COLUMNS}, cover_svg` : META_COLUMNS);
function svgColumnMissing(error: { code?: string; message?: string } | null): boolean {
  if (!error || !hasSvgColumn || (error.code !== "42703" && !/cover_svg/.test(error.message ?? ""))) return false;
  hasSvgColumn = false;
  return true;
}
const PAGE = 200;
const MAX_PAGES = 5;
const INDEX_KEY = "bebix_stories_index_v1";
const storyKey = (slug: string) => `bebix_story_v1:${slug}`;

type Row = {
  slug: string;
  title: string;
  summary: string | null;
  categories: string[] | null;
  age_min_months: number | null;
  age_max_months: number | null;
  reading_minutes: number | null;
  cover_key: string | null;
  cover_url: string | null;
  cover_svg?: string | null;
  featured: boolean | null;
  sort_order: number | null;
  updated_at: string | null;
  paragraphs?: string[] | null;
};

function toMeta(r: Row): StoryMeta {
  return {
    slug: r.slug,
    title: r.title,
    summary: r.summary ?? "",
    categories: cleanCategories(r.categories),
    ageMinMonths: r.age_min_months ?? 0,
    ageMaxMonths: r.age_max_months ?? 72,
    readingMinutes: r.reading_minutes ?? (r.paragraphs ? readingMinutes(r.paragraphs) : 3),
    cover: r.cover_key,
    coverUrl: r.cover_url,
    coverSvg: r.cover_svg ?? null,
    featured: !!r.featured,
    sortOrder: r.sort_order ?? 1000,
    updatedAt: r.updated_at,
  };
}

export type StoryIndex = { stories: StoryMeta[]; source: "server" | "saved" | "bundled" };

let memoryIndex: StoryIndex | null = null;
const memoryStories = new Map<string, Story>();

/** Lista e fundit e njohur, pa pritur: për kreun dhe hapjen e menjëhershme. */
export function cachedIndex(): StoryIndex {
  return memoryIndex ?? { stories: sortStories(BUNDLED_STORIES), source: "bundled" };
}

async function fetchServerIndex(): Promise<StoryMeta[] | null> {
  const rows: Row[] = [];
  const fetchPage = (page: number) =>
    supabase
      .from("stories")
      .select(metaColumns())
      .eq("status", "published")
      .order("sort_order", { ascending: true })
      .order("slug", { ascending: true })
      .range(page * PAGE, page * PAGE + PAGE - 1);
  for (let page = 0; page < MAX_PAGES; page++) {
    let { data, error } = await fetchPage(page);
    if (svgColumnMissing(error)) ({ data, error } = await fetchPage(page));
    if (error || !Array.isArray(data)) return null;
    rows.push(...(data as unknown as Row[]));
    if (data.length < PAGE) break;
  }
  return rows.map(toMeta);
}

export async function loadStoryIndex(): Promise<StoryIndex> {
  const server = await fetchServerIndex().catch(() => null);
  if (server && server.length) {
    memoryIndex = { stories: sortStories(server), source: "server" };
    await AsyncStorage.setItem(INDEX_KEY, JSON.stringify(server)).catch(() => {});
    return memoryIndex;
  }
  try {
    const saved = await AsyncStorage.getItem(INDEX_KEY);
    const list = saved ? (JSON.parse(saved) as StoryMeta[]) : null;
    if (Array.isArray(list) && list.length) {
      memoryIndex = { stories: sortStories(list), source: "saved" };
      return memoryIndex;
    }
  } catch {
    // Lista e ruajtur e dëmtuar: kalohet te përrallat e app-it.
  }
  memoryIndex = { stories: sortStories(BUNDLED_STORIES), source: "bundled" };
  return memoryIndex;
}

/** Një përrallë e plotë. null kur s'gjendet; hedh gabim kur s'arrihet dhe s'ka kopje në telefon. */
export async function loadStory(slug: string): Promise<Story | null> {
  const meta = cachedIndex().stories.find((s) => s.slug === slug) ?? null;
  const fresh = (s: Story | null | undefined) => !!s && (!meta || s.updatedAt === meta.updatedAt);

  const inMemory = memoryStories.get(slug);
  if (fresh(inMemory)) return inMemory!;

  let saved: Story | null = null;
  try {
    const raw = await AsyncStorage.getItem(storyKey(slug));
    saved = raw ? (JSON.parse(raw) as Story) : null;
  } catch {
    saved = null;
  }
  if (fresh(saved) && saved!.paragraphs?.length) {
    memoryStories.set(slug, saved!);
    return saved;
  }
  // Përralla e app-it, kur lista vjen po nga app-i: s'ka nevojë për rrjet.
  const local = bundledStory(slug);
  if (local && (!meta || meta.updatedAt == null)) return local;

  const fetchOne = () => supabase.from("stories").select(`${metaColumns()}, paragraphs` as string).eq("slug", slug).eq("status", "published").maybeSingle();
  let { data, error } = await fetchOne();
  if (svgColumnMissing(error)) ({ data, error } = await fetchOne());
  if (!error && data) {
    const row = data as unknown as Row;
    const story: Story = { ...toMeta(row), paragraphs: (row.paragraphs ?? []).filter((p) => typeof p === "string" && p.trim()) };
    if (story.paragraphs.length) {
      memoryStories.set(slug, story);
      await AsyncStorage.setItem(storyKey(slug), JSON.stringify(story)).catch(() => {});
      return story;
    }
  }
  if (!error && !data && !local) return null;
  // Pa rrjet: kopja e vjetër e ruajtur, ose ajo e app-it.
  if (saved?.paragraphs?.length) return saved;
  if (local) return local;
  throw new Error(error?.message ?? "story_unavailable");
}

export function __resetStoriesCacheForTests() {
  memoryIndex = null;
  hasSvgColumn = true;
  memoryStories.clear();
}
