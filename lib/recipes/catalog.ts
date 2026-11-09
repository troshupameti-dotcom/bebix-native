import type { Allergen, MealType, Recipe, RecipeStage, FeedingStyle, Season, Unit } from "@/lib/recipes/types";

/**
 * Logjika e recetave pa ekran: mosha, kërkimi, filtrat, alergjitë e fëmijës, receta e ditës dhe shumëzimi i
 * sasive. E njëjta për listën, faqen e recetës dhe kartën "Ide për sot".
 */

/** Grupet e moshës te filtri, në muaj: [nga, deri] (deri përjashtuar). */
export const RECIPE_AGE_BANDS = {
  "6-8": [6, 9],
  "9-11": [9, 12],
  "12-23": [12, 24],
  "24-60": [24, 61],
} as const;
export type RecipeAgeBand = keyof typeof RECIPE_AGE_BANDS;

/** Recetat nisin nga 6 muaj; para kësaj s'ka grup (karta "Gati për ushqimet e para?" del në 5 muaj). */
export function bandForMonths(months: number | null | undefined): RecipeAgeBand | null {
  if (months == null || months < 6) return null;
  for (const band of Object.keys(RECIPE_AGE_BANDS) as RecipeAgeBand[]) {
    const [from, to] = RECIPE_AGE_BANDS[band];
    if (months >= from && months < to) return band;
  }
  return "24-60";
}

/** Receta i përshtatet grupit kur mosha e saj e parë s'është pas grupit dhe e fundit s'është para tij. */
export function fitsBand(r: Pick<Recipe, "ageMinMonths" | "ageMaxMonths">, band: RecipeAgeBand): boolean {
  const [from, to] = RECIPE_AGE_BANDS[band];
  return r.ageMinMonths < to && r.ageMaxMonths >= from;
}

/** Mosha e saktë e fëmijës (për kartën "Ide për sot"). */
export function fitsMonths(r: Pick<Recipe, "ageMinMonths" | "ageMaxMonths">, months: number): boolean {
  return months >= r.ageMinMonths && months <= r.ageMaxMonths;
}

/** Shkronjat e vogla, pa ë/ç dhe pa shenja: "Pulë" gjendet edhe si "pule". */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ë/g, "e")
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// ---- Alergjitë e fëmijës -----------------------------------------------------

/**
 * Fjalët që tregojnë një alergjen te teksti i lirë i alergjive (shqip dhe anglisht, pa ë/ç). Fillimi i fjalës
 * mjafton: "vezë", "veza" dhe "vezët" gjenden të gjitha nga "vez". Me "=" para, fjala duhet të jetë e plotë
 * ("kos", jo "Kosovë").
 */
const ALLERGEN_WORDS: Record<Allergen, string[]> = {
  milk: ["qumesht", "bulmet", "laktoz", "kazein", "=kos", "=kosi", "=kosin", "djath", "gjiz", "milk", "dairy", "lactose", "casein", "cow"],
  egg: ["vez", "egg"],
  wheat: ["grur", "gluten", "celiaki", "miell", "wheat", "coeliac", "celiac"],
  peanut: ["kikirik", "peanut"],
  tree_nut: ["arr", "lajthi", "bajam", "festek", "shqeme", "nut", "almond", "hazelnut", "walnut", "cashew", "pistachio", "pecan"],
  sesame: ["susam", "tahin", "sesame"],
  soy: ["soj", "soy"],
  fish: ["peshk", "salmon", "merluc", "levrek", "sardel", "fish", "cod", "tuna"],
  shellfish: ["karkalec", "midhje", "gaforr", "fruta deti", "shellfish", "shrimp", "prawn", "crab", "mussel", "lobster"],
};

/** Alergjenët që përmend teksti i alergjive te profili (p.sh. "alergji ndaj vezëve dhe qumështit"). */
export function childAllergens(text: string | null | undefined): Allergen[] {
  const words = normalize(text ?? "").split(" ").filter(Boolean);
  if (!words.length) return [];
  const joined = ` ${words.join(" ")} `;
  // "Asnjë" / "s'ka" / "none": prindi shkroi që s'ka alergji.
  if (/^ (asnje|ska|s ka|nuk ka|jo|none|no|nothing|nk) $/.test(joined)) return [];
  return (Object.keys(ALLERGEN_WORDS) as Allergen[]).filter((a) =>
    ALLERGEN_WORDS[a].some((w) =>
      w.startsWith("=") ? words.includes(w.slice(1)) : w.includes(" ") ? joined.includes(` ${w}`) : words.some((x) => x.startsWith(w))
    )
  );
}

/** Alergjenët e recetës që fëmija i ka të shënuar si alergji. */
export function allergyConflicts(r: Pick<Recipe, "allergens">, child: Allergen[]): Allergen[] {
  return r.allergens.filter((a) => child.includes(a));
}

// ---- Filtrat -------------------------------------------------------------------

export type TimeFilter = "15" | "30" | "nocook";

export type RecipeFilters = {
  query?: string;
  band?: RecipeAgeBand | null;
  meal?: MealType | null;
  time?: TimeFilter | null;
  stage?: RecipeStage | null;
  style?: FeedingStyle | null;
  /** "Pa [alergjen]": recetat me këta alergjenë hiqen. */
  without?: Allergen[];
  freezer?: boolean;
  seasonal?: boolean;
  albanian?: boolean;
  /** Vetëm këto (p.sh. të preferuarat). */
  only?: Set<string> | null;
  /** Alergjitë e fëmijës: recetat që i përmendin dalin të fundit. */
  childAllergens?: Allergen[];
  now?: Date;
};

export const totalMinutes = (r: Pick<Recipe, "prepMinutes" | "cookMinutes">) => r.prepMinutes + r.cookMinutes;

export function seasonOf(at: Date): Season {
  const m = at.getMonth();
  if (m === 11 || m <= 1) return "winter";
  if (m <= 4) return "spring";
  if (m <= 7) return "summer";
  return "autumn";
}

function matchesQuery(r: Recipe, q: string): boolean {
  const words = normalize(q).split(" ").filter(Boolean);
  if (!words.length) return true;
  const hay = normalize([r.title, r.summary, ...r.ingredients.map((i) => i.name)].join(" "));
  return words.every((w) => hay.includes(w));
}

/** Lista sipas filtrave. Receta me një alergjen të fëmijës s'fshihet (përveç "Pa [alergjen]"), por shkon në fund. */
export function filterRecipes(list: Recipe[], f: RecipeFilters): Recipe[] {
  const season = seasonOf(f.now ?? new Date());
  const out = list.filter((r) => {
    if (f.only && !f.only.has(r.slug)) return false;
    if (f.band && !fitsBand(r, f.band)) return false;
    if (f.meal && !r.mealTypes.includes(f.meal)) return false;
    if (f.time === "15" && totalMinutes(r) > 15) return false;
    if (f.time === "30" && totalMinutes(r) > 30) return false;
    if (f.time === "nocook" && r.cookMinutes > 0) return false;
    if (f.stage && r.stage !== f.stage) return false;
    if (f.style && !r.feedingStyle.includes(f.style)) return false;
    if (f.without?.length && r.allergens.some((a) => f.without!.includes(a))) return false;
    if (f.freezer && !r.freezerFriendly) return false;
    if (f.seasonal && r.season.length > 0 && !r.season.includes(season)) return false;
    if (f.albanian && !r.isAlbanian) return false;
    return matchesQuery(r, f.query ?? "");
  });
  const child = f.childAllergens ?? [];
  if (!child.length) return out;
  // Renditja e qëndrueshme: ato pa konflikt mbajnë radhën e tyre, ato me konflikt shkojnë pas.
  return [...out.filter((r) => !allergyConflicts(r, child).length), ...out.filter((r) => allergyConflicts(r, child).length)];
}

/** Radha e bibliotekës: të veçuarat, pastaj sipas radhës së adminit, pastaj titulli. */
export function sortRecipes(list: Recipe[]): Recipe[] {
  return [...list].sort((a, b) => Number(b.featured) - Number(a.featured) || a.sortOrder - b.sortOrder || a.title.localeCompare(b.title, "sq"));
}

/** Një numër i qëndrueshëm për datën (e njëjta recetë gjithë ditën, një tjetër nesër). */
function daySeed(at: Date): number {
  const key = `${at.getFullYear()}-${at.getMonth() + 1}-${at.getDate()}`;
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return h;
}

/**
 * "Receta e ditës" / "Ide për sot": një recetë që i përshtatet moshës dhe s'ka alergjenët e fëmijës; e stinës kur
 * ka. Pa moshë: nga të gjitha.
 */
export function recipeOfTheDay(list: Recipe[], months: number | null, child: Allergen[] = [], at = new Date()): Recipe | null {
  const season = seasonOf(at);
  const safe = list.filter((r) => (months == null || fitsMonths(r, months)) && !allergyConflicts(r, child).length);
  const seasonal = safe.filter((r) => !r.season.length || r.season.includes(season));
  const pool = seasonal.length ? seasonal : safe;
  if (!pool.length) return null;
  const sorted = [...pool].sort((a, b) => a.slug.localeCompare(b.slug));
  return sorted[daySeed(at) % sorted.length];
}

// ---- Sasitë --------------------------------------------------------------------

const STEP: Record<Unit, number> = { g: 5, ml: 5, copë: 0.5, "lugë gjelle": 0.5, "lugë çaji": 0.25, filxhan: 0.25 };

/** Sasia e shumëzuar, e rrumbullakosur si në kuzhinë (5 g, gjysmë cope, çerek filxhani). Kurrë zero. */
export function scaleAmount(amount: number, unit: Unit, factor: number): number {
  const step = STEP[unit] ?? 0.5;
  const raw = amount * factor;
  if (factor === 1) return amount;
  return Math.max(step, Math.round(raw / step) * step);
}

const FRACTIONS: Record<string, string> = { "0.25": "¼", "0.5": "½", "0.75": "¾" };

/** 1.5 → "1½", 0.25 → "¼", 150 → "150". */
export function formatAmount(amount: number): string {
  const whole = Math.floor(amount + 1e-9);
  const rest = Math.round((amount - whole) * 100) / 100;
  const frac = FRACTIONS[String(rest)];
  if (!rest) return String(whole);
  if (frac) return whole ? `${whole}${frac}` : frac;
  return String(Math.round(amount * 10) / 10).replace(".", ",");
}

/** "150 g kungull", "1½ lugë gjelle vaj ulliri". */
export function ingredientLine(i: { name: string; amount: number; unit: Unit }, factor = 1): string {
  return `${formatAmount(scaleAmount(i.amount, i.unit, factor))} ${i.unit} ${i.name}`;
}

/** Teksti i "Ndaje": titulli, përbërësit dhe hapat, si në një letër (p.sh. për WhatsApp). */
export function shareText(r: Pick<Recipe, "title" | "ingredients" | "steps">, intro: string): string {
  return [r.title, intro, "", ...r.ingredients.map((i) => `• ${ingredientLine(i)}`), "", ...r.steps.map((s, n) => `${n + 1}. ${s}`)].join("\n");
}
