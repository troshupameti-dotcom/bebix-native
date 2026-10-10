import type { Moment } from "@/lib/state/babyTypes";
import type { TranslationKey } from "@/lib/i18n/translations";

/**
 * Kartat për t'u ndarë (Instagram, WhatsApp): dita e 100-të, muajt,
 * ditëlindja, arritjet dhe momentet — me foton e bebit dhe logon e vogël
 * Bebix. Funksione të pastra: përmbajtja, foto e parazgjedhur, shabllonet.
 */

export type CardKind = "day100" | "month" | "half" | "year" | "milestone" | "moment";
export type CardTemplate = "cream" | "photo" | "pastel" | "night";
export type CardAspect = "square" | "story";

export const CARD_KINDS: CardKind[] = ["day100", "month", "half", "year", "milestone", "moment"];

/** Madhësia e imazhit që ndahet (piksela): katror për postim, 9:16 për story. */
export const CARD_SIZE: Record<CardAspect, { width: number; height: number }> = {
  square: { width: 1080, height: 1080 },
  story: { width: 1080, height: 1920 },
};

export type CardParams = { kind: CardKind; n: number | null; momentId: string | null };

/** Parametrat e lidhjes (?kind=month&n=3&momentId=…) → të vlefshëm, ose null. */
export function parseCardParams(p: { kind?: string; n?: string; momentId?: string }): CardParams | null {
  const kind = CARD_KINDS.find((k) => k === p.kind);
  if (!kind) return null;
  const n = p.n != null && /^\d{1,3}$/.test(p.n) ? Number(p.n) : null;
  if ((kind === "month" || kind === "year") && (n == null || n < 1)) return null;
  return { kind, n, momentId: p.momentId && /^[\w-]{1,80}$/.test(p.momentId) ? p.momentId : null };
}

type T = (key: TranslationKey, params?: Record<string, string | number>) => string;

export type CardContent = {
  /** Numri i madh ("100", "3"), ose null për arritjet dhe momentet. */
  big: string | null;
  unit: string | null;
  emoji: string;
  title: string;
  subtitle: string;
};

export function buildCardContent(input: {
  kind: CardKind;
  n: number | null;
  babyName: string;
  moment: Moment | null;
  dateLabel: string;
  t: T;
}): CardContent {
  const { kind, n, babyName: name, moment, dateLabel, t } = input;
  switch (kind) {
    case "day100":
      return { big: "100", unit: t("card_unit_days"), emoji: "💯", title: t("card_title_day100", { name }), subtitle: dateLabel };
    case "month":
      return {
        big: String(n),
        unit: t(n === 1 ? "card_unit_month" : "card_unit_months"),
        emoji: "🎂",
        title: t(n === 1 ? "card_title_month_one" : "card_title_month", { name, n: n ?? 0 }),
        subtitle: dateLabel,
      };
    case "half":
      return { big: "6", unit: t("card_unit_months"), emoji: "🎉", title: t("card_title_half", { name }), subtitle: dateLabel };
    case "year":
      return {
        big: String(n),
        unit: t(n === 1 ? "card_unit_year" : "card_unit_years"),
        emoji: "🎂",
        title: t("card_title_year", { name, n: n ?? 0 }),
        subtitle: dateLabel,
      };
    case "milestone":
      return { big: null, unit: null, emoji: "⭐", title: moment?.title.trim() || t("card_milestone"), subtitle: `${name} · ${dateLabel}` };
    default:
      return { big: null, unit: null, emoji: "💛", title: moment?.title.trim() || name, subtitle: `${name} · ${dateLabel}` };
  }
}

const isPhoto = (m: Moment) => m.type === "photo" && !m.deletedAt && !m.archivedAt && !!(m.uri || m.storagePath);

/**
 * Fotoja e parazgjedhur: ajo e momentit (kur karta vjen nga një moment me
 * foto), përndryshe e preferuara më e re, përndryshe më e reja.
 */
export function pickDefaultPhoto(moments: Moment[], momentId: string | null): Moment | null {
  const own = momentId ? moments.find((m) => m.id === momentId) : null;
  if (own && (own.uri || own.storagePath) && !own.deletedAt) return own;
  const photos = moments.filter(isPhoto).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  return photos.find((m) => m.favorite) ?? photos[0] ?? null;
}

/** Fotot që mund të zgjidhen për kartën (më të rejat para, deri në 20). */
export function selectablePhotos(moments: Moment[]): Moment[] {
  return moments
    .filter(isPhoto)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 20);
}

export type TemplateInfo = { key: CardTemplate; labelKey: TranslationKey; needsPhoto: boolean; dark: boolean };

export const TEMPLATES: TemplateInfo[] = [
  { key: "cream", labelKey: "card_tpl_cream", needsPhoto: false, dark: false },
  { key: "photo", labelKey: "card_tpl_photo", needsPhoto: true, dark: true },
  { key: "pastel", labelKey: "card_tpl_pastel", needsPhoto: false, dark: false },
  { key: "night", labelKey: "card_tpl_night", needsPhoto: false, dark: true },
];

/** Shabllonet që kanë kuptim: "Foto" vetëm kur ka foto. */
export function availableTemplates(hasPhoto: boolean): TemplateInfo[] {
  return TEMPLATES.filter((tpl) => hasPhoto || !tpl.needsPhoto);
}

/** Shablloni fillestar: me foto, karta me foto të plotë; pa foto, ajo krem. */
export function defaultTemplate(hasPhoto: boolean): CardTemplate {
  return hasPhoto ? "photo" : "cream";
}
