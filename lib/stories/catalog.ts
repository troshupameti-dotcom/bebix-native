import bundled from "@/content/stories/sq.json";
import { fold } from "@/lib/settings/search";
import { AGE_BANDS, STORY_CATEGORIES, type AgeBand, type Story, type StoryCategory, type StoryMeta } from "@/lib/stories/types";

/**
 * Përrallat që vijnë me app-in (content/stories/sq.json). Janë të njëjtat që shton migrimi te tabela `stories`;
 * këtu shërbejnë kur baza s'arrihet (pa rrjet, ose para se të ekzekutohet migrimi). Përrallat e reja shtohen
 * te baza dhe dalin pa përditësim të app-it.
 */
type BundledStory = {
  slug: string;
  title: string;
  summary: string;
  categories: string[];
  ageMinMonths: number;
  ageMaxMonths: number;
  cover: string;
  featured: boolean;
  sortOrder: number;
  paragraphs: string[];
};

/** Leximi me zë të ulët për një fëmijë, me pushime: rreth 80 fjalë në minutë. */
export function readingMinutes(paragraphs: string[]): number {
  const words = paragraphs.join(" ").split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 80));
}

export function cleanCategories(values: readonly string[] | null | undefined): StoryCategory[] {
  return (values ?? []).filter((c): c is StoryCategory => (STORY_CATEGORIES as readonly string[]).includes(c));
}

export const BUNDLED_STORIES: Story[] = (bundled as BundledStory[]).map((s) => ({
  slug: s.slug,
  title: s.title,
  summary: s.summary,
  categories: cleanCategories(s.categories),
  ageMinMonths: s.ageMinMonths,
  ageMaxMonths: s.ageMaxMonths,
  readingMinutes: readingMinutes(s.paragraphs),
  cover: s.cover,
  coverUrl: null,
  coverSvg: null,
  featured: s.featured,
  sortOrder: s.sortOrder,
  updatedAt: null,
  paragraphs: s.paragraphs,
}));

export function bundledStory(slug: string): Story | null {
  return BUNDLED_STORIES.find((s) => s.slug === slug) ?? null;
}

export function sortStories<T extends StoryMeta>(list: T[]): T[] {
  return [...list].sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title, "sq"));
}

/** Grupi i moshës për fëmijën aktiv; mbi 6 vjeç ose pa moshë: pa filtër. */
export function bandForMonths(months: number | null | undefined): AgeBand | null {
  if (months == null || months < 0) return null;
  const hit = (Object.keys(AGE_BANDS) as AgeBand[]).find((b) => months >= AGE_BANDS[b][0] && months < AGE_BANDS[b][1]);
  return hit ?? null;
}

/** Përralla i përshtatet grupit kur intervalet e moshës mbivendosen. */
export function fitsBand(story: StoryMeta, band: AgeBand): boolean {
  const [from, to] = AGE_BANDS[band];
  return story.ageMinMonths < to && story.ageMaxMonths > from;
}

export type StoryFilter = { query?: string; category?: StoryCategory | null; band?: AgeBand | null; only?: Set<string> | null };

/** Kërkimi pa "ë" dhe "ç" ("hena" gjen "Hëna"), te titulli dhe përshkrimi; filtrat bashkohen. */
export function filterStories<T extends StoryMeta>(list: T[], { query, category, band, only }: StoryFilter): T[] {
  const words = fold(query ?? "").split(/\s+/).filter(Boolean);
  return list.filter((s) => {
    if (only && !only.has(s.slug)) return false;
    if (category && !s.categories.includes(category)) return false;
    if (band && !fitsBand(s, band)) return false;
    if (!words.length) return true;
    const haystack = fold(`${s.title} ${s.summary}`);
    return words.every((w) => haystack.includes(w));
  });
}

/** Mosha si tekst: "0–1", "1–6" vjeç; nën një vit në muaj. */
export function ageRangeYears(story: StoryMeta): { from: number; to: number } {
  return { from: Math.floor(story.ageMinMonths / 12), to: Math.max(1, Math.ceil(story.ageMaxMonths / 12)) };
}

/**
 * Përralla e mbrëmjes te kreu: ndryshon çdo ditë, nga ato që i përshtaten moshës (të gjumit kanë përparësi).
 * E njëjta ditë jep të njëjtën përrallë, që të mos ndryshojë sa herë hapet faqja.
 */
export function storyOfTheDay<T extends StoryMeta>(list: T[], months: number | null | undefined, day: Date = new Date()): T | null {
  return tonightPool(list, months, day)[0] ?? null;
}

/**
 * Radha e përrallave për sonte: e para është përralla e ditës, pastaj të tjerat e së njëjtës zgjedhje (për "Një
 * tjetër"), dhe në fund çdo përrallë tjetër që i përshtatet moshës.
 */
export function tonightPool<T extends StoryMeta>(list: T[], months: number | null | undefined, day: Date = new Date()): T[] {
  if (!list.length) return [];
  const band = bandForMonths(months);
  const forAge = band ? list.filter((s) => fitsBand(s, band)) : list;
  const sleep = forAge.filter((s) => s.categories.includes("sleep"));
  const choice = sortStories(sleep.length ? sleep : forAge.length ? forAge : list);
  const dayNumber = Math.floor(new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime() / 86_400_000);
  const start = ((dayNumber % choice.length) + choice.length) % choice.length;
  const rotated = [...choice.slice(start), ...choice.slice(0, start)];
  const rest = sortStories(forAge.length ? forAge : list).filter((s) => !rotated.includes(s));
  return [...rotated, ...rest];
}

/** Mbrëmja dhe nata (17:00–04:59): kartela e kreut merr qiellin e natës. */
export function isEvening(hour: number): boolean {
  return hour >= 17 || hour < 5;
}
