import type { Stage } from "@/lib/age/engine";

/**
 * Konfigurimi i fazave: çfarë shfaqet për cilën moshë. I vetmi vend që ndryshohet kur ndryshon vendimi;
 * ekranet pyesin `hasFeature(stage, "...")` dhe s'kanë rregulla moshe të tyre.
 */
export type Feature =
  /** Ushqyerja, gjumi, pelenat (shënimet, ora e ditës, ditari). */
  | "trackers"
  /** Javët e zhvillimit (`development_weeks`). */
  | "developmentWeeks"
  | "vaccines"
  | "growth"
  /** Javët e shtatzënisë dhe numërimi mbrapa deri në lindje. */
  | "pregnancyWeeks"
  /** Renditja e dyqanit sipas moshës (dyqani vetë është gjithmonë i plotë). */
  | "shopRanking"
  /** Rekomandimet e produkteve në kreu. */
  | "shopRecommendations"
  /** Feed-i i komunitetit sipas grupmoshës. */
  | "communityAgeFeed"
  | "moments"
  | "medical"
  /** Përrallat: karta "Përrallë për sonte" te kreu (biblioteka hapet edhe nga Cilësimet). */
  | "stories";

/** "none" = pa fëmijë aktiv ose pa datë: kreu neutral dhe dyqani i plotë, pa e hequr asgjë që prindi përdor sot. */
export type StageOrNone = Stage | "none";

export const STAGE_FEATURES: Record<StageOrNone, Record<Feature, boolean>> = {
  pregnancy: {
    trackers: false,
    developmentWeeks: false,
    vaccines: false,
    growth: false,
    pregnancyWeeks: true,
    shopRanking: true,
    shopRecommendations: true,
    communityAgeFeed: true,
    moments: true,
    medical: true,
    stories: false,
  },
  infant: {
    trackers: true,
    developmentWeeks: true,
    vaccines: true,
    growth: true,
    pregnancyWeeks: false,
    shopRanking: true,
    shopRecommendations: true,
    communityAgeFeed: true,
    moments: true,
    medical: true,
    stories: true,
  },
  toddler: {
    trackers: true,
    developmentWeeks: true,
    vaccines: true,
    growth: true,
    pregnancyWeeks: false,
    shopRanking: true,
    shopRecommendations: true,
    communityAgeFeed: true,
    moments: true,
    medical: true,
    stories: true,
  },
  child: {
    trackers: false,
    developmentWeeks: false,
    vaccines: true,
    growth: true,
    pregnancyWeeks: false,
    shopRanking: true,
    shopRecommendations: true,
    communityAgeFeed: true,
    moments: true,
    medical: true,
    stories: true,
  },
  archive: {
    trackers: false,
    developmentWeeks: false,
    vaccines: true,
    growth: true,
    pregnancyWeeks: false,
    shopRanking: false,
    shopRecommendations: false,
    communityAgeFeed: false,
    moments: true,
    medical: true,
    stories: false,
  },
  none: {
    trackers: true,
    developmentWeeks: false,
    vaccines: true,
    growth: true,
    pregnancyWeeks: false,
    shopRanking: false,
    shopRecommendations: false,
    communityAgeFeed: false,
    moments: true,
    medical: true,
    stories: true,
  },
};

export function hasFeature(stage: Stage | null | undefined, feature: Feature): boolean {
  return STAGE_FEATURES[stage ?? "none"][feature];
}

/**
 * Ekspertët: s'fshihen kurrë, vetëm renditen. Specialitetet e listës vijnë në krye, me këtë radhë
 * (`community_specialties.key`); të tjerët pas tyre, si sot.
 */
export const SPECIALTY_PRIORITY: Record<StageOrNone, string[]> = {
  pregnancy: ["gynecologist", "midwife", "nutritionist", "psychologist", "lactation"],
  infant: ["pediatrician", "neonatologist", "lactation", "sleep_coach", "nutritionist", "physiotherapist"],
  toddler: ["pediatrician", "nutritionist", "sleep_coach", "speech_therapist", "pediatric_dentist", "psychologist"],
  child: [
    "psychologist",
    "speech_therapist",
    "pediatrician",
    "nutritionist",
    "pediatric_dentist",
    "ophthalmologist",
    "orthopedist",
    "allergist",
  ],
  archive: [],
  none: [],
};

/** Pozicioni i specialitetit për fazën (më i vogli = më lart); jashtë listës = në fund, me radhën e sotme. */
export function specialtyRank(stage: Stage | null | undefined, specialtyKey: string | null | undefined): number {
  const list = SPECIALTY_PRIORITY[stage ?? "none"];
  const i = specialtyKey ? list.indexOf(specialtyKey) : -1;
  return i === -1 ? list.length : i;
}

/** Shtatzënia: këto kategori (`categories.key`) dalin të parat te dyqani. */
export const PREGNANCY_TOP_CATEGORIES = ["Për nënën", "Dhoma e bebit"];
