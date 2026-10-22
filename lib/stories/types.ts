/** Kategoritë e përrallave; të njëjtat vlera lejon edhe kontrolli te tabela `stories`. */
export const STORY_CATEGORIES = ["sleep", "nature", "adventure", "friendship", "emotions", "lessons", "classic"] as const;
export type StoryCategory = (typeof STORY_CATEGORIES)[number];

/** Grupet e moshës te filtrat, në muaj: [nga, deri] (deri përjashtuar). */
export const AGE_BANDS = {
  "0-1": [0, 12],
  "1-3": [12, 36],
  "3-6": [36, 72],
} as const;
export type AgeBand = keyof typeof AGE_BANDS;

/** Të dhënat e listës, pa tekstin: aq sa duhen për kartat, kërkimin dhe filtrat. */
export type StoryMeta = {
  slug: string;
  title: string;
  summary: string;
  categories: StoryCategory[];
  ageMinMonths: number;
  ageMaxMonths: number;
  readingMinutes: number;
  /** Ilustrimi i vizatuar në app (`StoryCover`); përdoret kur s'ka `coverUrl`. */
  cover: string | null;
  /** Foto nga bucket-i publik `story-covers`, për përrallat që shtohen më vonë nga baza. */
  coverUrl: string | null;
  /** Ilustrimi që vizatoi Claude për përrallën e javës (SVG i pastruar); null te përrallat e tjera. */
  coverSvg: string | null;
  featured: boolean;
  sortOrder: number;
  /** Versioni i tekstit: kur ndryshon, teksti i ruajtur në telefon merret sërish. */
  updatedAt: string | null;
};

export type Story = StoryMeta & { paragraphs: string[] };
