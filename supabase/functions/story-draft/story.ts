import { sanitizeSvg } from "./svg.ts";

/**
 * Rregullat e përrallës së javës, pa varësi (testohen me Jest): tema e javës, udhëzimet për Claude, forma e
 * përgjigjes, kontrolli i saj dhe emri në URL. Funksioni `story-draft` i përdor për ta ruajtur si draft.
 */

export const CATEGORIES = ["sleep", "nature", "adventure", "friendship", "emotions", "lessons", "classic"] as const;
export type Category = (typeof CATEGORIES)[number];

/** Skenat e vizatuara në app; Claude zgjedh një prej tyre si rezervë kur ilustrimi i tij s'kalon kontrollin. */
export const SCENES = ["moon", "bear", "fox", "snail", "boat", "umbrella", "cloud", "star", "owl", "lamb", "seed", "turtle", "mice", "house"] as const;

export const BANDS = {
  "0-1": { min: 0, max: 24, label: "babies under 2 (read aloud by a parent)" },
  "1-3": { min: 12, max: 48, label: "toddlers aged 1 to 4" },
  "3-6": { min: 36, max: 72, label: "preschool children aged 3 to 6" },
} as const;
export type Band = keyof typeof BANDS;

const CATEGORY_BRIEF: Record<Category, string> = {
  sleep: "a calm bedtime story that slows down towards the end and leaves the child sleepy and safe",
  nature: "a story about animals and nature, with something true about how animals or plants live",
  adventure: "a small, safe adventure with a little challenge that the hero solves with courage or cleverness",
  friendship: "a story about friendship: sharing, helping, making up after a small disagreement",
  emotions: "a story that helps a child name and accept a feeling (sadness, fear, anger, jealousy, shyness, joy)",
  lessons: "a story with a gentle life lesson (patience, honesty, trying again, saying thank you) shown, not preached",
  classic: "your own retelling of a public-domain classic: an Aesop fable or an Albanian folk tale, in fresh words, never copied from a published translation",
};

export type StoryRow = { title: string; categories: string[] | null; age_min_months: number | null; age_max_months: number | null; status: string };

/**
 * Tema e javës: kategoria dhe mosha që kanë më pak përralla (pa ato të arkivuara), me radhë të qëndrueshme kur janë
 * barabartë. Kështu biblioteka mbushet njëtrajtësisht.
 */
export function pickTheme(rows: StoryRow[], week: number): { category: Category; band: Band } {
  const live = rows.filter((r) => r.status !== "archived");
  const catCount = (c: Category) => live.filter((r) => (r.categories ?? []).includes(c)).length;
  const bandKeys = Object.keys(BANDS) as Band[];
  const bandCount = (b: Band) =>
    live.filter((r) => (r.age_min_months ?? 0) < BANDS[b].max && (r.age_max_months ?? 72) > BANDS[b].min).length;
  const rotate = <T,>(list: readonly T[]) => list.map((_, i) => list[(i + week) % list.length]);
  const category = rotate(CATEGORIES).reduce((best, c) => (catCount(c) < catCount(best) ? c : best));
  const band = rotate(bandKeys).reduce((best, b) => (bandCount(b) < bandCount(best) ? b : best));
  return { category, band };
}

/** Udhëzimet e qëndrueshme (pa data ose emra që ndryshojnë). */
export const SYSTEM = `You write original children's stories in Albanian for Bebix, an app for parents in Kosovo and Albania. A parent reads the story aloud to their child, often at bedtime. Every story you write is reviewed by the Bebix team before any family sees it.

Language and tone:
- Standard literary Albanian (gjuha standarde) with correct ë and ç, natural and warm. No dialect forms, no slang, no English words.
- Dialogue uses Albanian quotation marks «like this».
- Short, clear sentences a young child can follow; concrete images, gentle humour, a little rhythm or repetition.
- Names, places and food that feel familiar in Albania and Kosovo when the story has people; animals may have simple names.

Content rules:
- Completely original. Do not copy or closely imitate any published book, film, cartoon or brand, and do not use existing characters.
- Safe and kind: no violence, injury, death, illness, scary monsters, punishment or danger that is not quickly resolved; no religion or politics; no gender or family stereotypes; no screens or products.
- A clear beginning, a small problem, a kind resolution, and a warm, calm ending. A lesson, if any, is shown through what happens, never stated as a moral at the end.
- The title is short (2 to 6 words) and different from the titles already in the library.

Illustration (cover_svg):
- One small flat illustration of the story's main scene as a complete SVG: <svg viewBox="0 0 160 120"> ... </svg>.
- Start with a full background <rect x="0" y="0" width="160" height="120" .../>, then ground or sky shapes, then the main character in the centre.
- Use only these elements: g, rect, circle, ellipse, path, line, polyline, polygon, defs, linearGradient, radialGradient, stop. Attributes only for geometry and painting (fill, stroke, stroke-width, stroke-linecap, stroke-linejoin, opacity, transform, offset, stop-color, id). No text, no letters, no style attribute, no href, no images, no scripts.
- At most 60 elements. Soft rounded shapes; simple dot or curved closed eyes; friendly expressions.
- Palette (use these and close tints): deep green #1F3D38, night teal #21403F, mint #C1DDD8, moonstone #9EC4C5, sage #87B08F, meadow #B7CDB0, cream #F3ECE1, warm white #FBF8F2, butter #E8C46B, terracotta #C7714A, rose #E0A5AE, deep rose #8F4E5A, taupe #B7A99A, brown #9A7258, dark brown #5E5346. Night scenes use a dark background with pale stars; day scenes use a light background.
- fallback_scene: the closest of the app's ready-made scenes, used if your drawing cannot be shown.`;

export function userPrompt(input: { category: Category; band: Band; titles: string[]; idea: string | null }): string {
  const band = BANDS[input.band];
  const lines = [
    `Write this week's story: ${CATEGORY_BRIEF[input.category]}.`,
    `Audience: ${band.label}. Set age_min_months and age_max_months to fit (for example ${band.min} and ${band.max}).`,
    input.band === "0-1"
      ? "Length: 5 to 7 paragraphs of one or two very short sentences, with a gentle repeated phrase."
      : "Length: 6 to 9 paragraphs, each 1 to 3 sentences (at most 300 characters per paragraph).",
    `categories: "${input.category}" first, plus at most one other that truly fits.`,
    `summary: one sentence (at most 160 characters) that makes a parent want to read it, without giving away the ending.`,
  ];
  if (input.idea) lines.push(`The Bebix team suggested this idea; use it if it fits the rules: ${input.idea}`);
  if (input.titles.length) lines.push(`Titles already in the library (do not reuse or closely echo them): ${input.titles.join("; ")}.`);
  return lines.join("\n");
}

export const OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    summary: { type: "string" },
    paragraphs: { type: "array", items: { type: "string" } },
    categories: { type: "array", items: { type: "string", enum: [...CATEGORIES] } },
    age_min_months: { type: "integer", enum: [0, 12, 24, 36] },
    age_max_months: { type: "integer", enum: [24, 36, 48, 72] },
    cover_svg: { type: "string" },
    fallback_scene: { type: "string", enum: [...SCENES] },
  },
  required: ["title", "summary", "paragraphs", "categories", "age_min_months", "age_max_months", "cover_svg", "fallback_scene"],
  additionalProperties: false,
} as const;

export type Draft = {
  title: string;
  summary: string;
  paragraphs: string[];
  categories: Category[];
  age_min_months: number;
  age_max_months: number;
  cover_svg: string | null;
  cover_key: string;
  reading_minutes: number;
};

/** Përgjigja e Claude-it → draft i vlefshëm, ose arsyeja pse s'u pranua. Ilustrimi i dobët s'e rrëzon përrallën. */
export function validateDraft(raw: unknown): { draft: Draft } | { error: string } {
  const r = (raw ?? {}) as Record<string, unknown>;
  const title = typeof r.title === "string" ? r.title.trim() : "";
  const summary = typeof r.summary === "string" ? r.summary.trim() : "";
  const paragraphs = Array.isArray(r.paragraphs) ? r.paragraphs.filter((p): p is string => typeof p === "string").map((p) => p.trim()).filter(Boolean) : [];
  const categories = [...new Set(Array.isArray(r.categories) ? r.categories : [])].filter((c): c is Category => (CATEGORIES as readonly unknown[]).includes(c)).slice(0, 3);
  const min = Number(r.age_min_months);
  const max = Number(r.age_max_months);
  if (title.length < 3 || title.length > 80) return { error: "title" };
  if (!summary || summary.length > 220) return { error: "summary" };
  if (paragraphs.length < 4 || paragraphs.length > 14) return { error: "paragraphs" };
  if (paragraphs.some((p) => p.length > 500)) return { error: "paragraph_length" };
  if (!categories.length) return { error: "categories" };
  if (!Number.isInteger(min) || !Number.isInteger(max) || min < 0 || max > 216 || max <= min) return { error: "ages" };
  const scene = typeof r.fallback_scene === "string" && (SCENES as readonly string[]).includes(r.fallback_scene) ? r.fallback_scene : "star";
  return {
    draft: {
      title,
      summary,
      paragraphs,
      categories,
      age_min_months: min,
      age_max_months: max,
      cover_svg: sanitizeSvg(r.cover_svg),
      cover_key: scene,
      reading_minutes: readingMinutes(paragraphs),
    },
  };
}

/** Si te app-i: rreth 80 fjalë në minutë kur lexohet me zë për një fëmijë. */
export function readingMinutes(paragraphs: string[]): number {
  const words = paragraphs.join(" ").split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 80));
}

/** "Hëna që s'donte të flinte" → "hena-qe-sdonte-te-flinte"; i lirë nga emrat ekzistues. */
export function slugify(title: string, taken: Set<string>): string {
  const base =
    title
      .toLowerCase()
      .replace(/ë/g, "e")
      .replace(/ç/g, "c")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/['’]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60)
      .replace(/-+$/g, "") || "perralla";
  let slug = base;
  for (let n = 2; taken.has(slug); n++) slug = `${base}-${n}`;
  return slug;
}

/** Java e vitit (për radhën e temave kur kategoritë janë barabartë). */
export function weekNumber(d: Date): number {
  return Math.floor(d.getTime() / (7 * 86_400_000));
}
