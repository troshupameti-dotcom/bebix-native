import { translations, type Language, type TranslationKey } from "@/lib/i18n/translations";
import type { DiaperType, FeedingType } from "@/lib/state/babyTypes";

/**
 * Tekstet e widget-it. Widget-i vizatohet jashtë ekraneve të app-it (pa
 * LanguageContext), ndaj lexon direkt nga të njëjtat përkthime sq/en.
 */
export function wt(lang: Language, key: TranslationKey, params?: Record<string, string>): string {
  let str: string = translations[lang][key] ?? translations.sq[key] ?? key;
  if (params) for (const [k, v] of Object.entries(params)) str = str.replace(`{${k}}`, v);
  return str;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** "14:05" sot; "09.10 22:10" për ditë të tjera — pa varësi nga Intl (headless). */
export function clockLabel(iso: string, now: Date): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const sameDay = d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
  return sameDay ? time : `${pad(d.getDate())}.${pad(d.getMonth() + 1)} ${time}`;
}

const FEEDING_KEY: Record<FeedingType, TranslationKey> = {
  breast: "feeding_type_breast",
  bottle: "feeding_type_bottle",
  formula: "feeding_type_formula",
  solid: "feeding_type_solid",
  water: "feeding_type_water",
  medicine: "feeding_type_medicine_short",
};
export const feedingLabel = (lang: Language, type: FeedingType) => wt(lang, FEEDING_KEY[type]);

const DIAPER_KEY: Record<DiaperType, TranslationKey> = { wet: "diaper_type_wet", dirty: "diaper_type_dirty", both: "diaper_type_both" };
export const diaperLabel = (lang: Language, type: DiaperType) => wt(lang, DIAPER_KEY[type]);
