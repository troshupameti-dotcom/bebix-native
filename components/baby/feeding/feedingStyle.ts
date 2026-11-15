import type { IconName } from "@/components/ui/Icon";
import { isSolidUnit, solidAmountText, volumeText, type VolumeUnit } from "@/lib/baby/feedUnits";
import type { Translate } from "@/lib/baby/dayStats";
import { TONES, type Tone } from "@/lib/theme/tone";
import type { FeedingEntry, FeedingType } from "@/lib/state/types";

/** Ngjyra e çdo lloji: gjiri rozë, biberoni kaltër, formula vjollcë, ushqimi jeshil. */
export const TYPE_TONE: Record<FeedingType, Tone> = {
  breast: TONES.pink,
  bottle: TONES.blue,
  formula: TONES.purple,
  solid: TONES.green,
  water: TONES.blue,
  medicine: TONES.amber,
};

export const TYPE_ICON: Record<FeedingType, IconName> = {
  breast: "droplet",
  bottle: "bottle",
  formula: "bottle",
  solid: "spoon",
  water: "droplet",
  medicine: "pill",
};

export function typeLabel(type: FeedingType, t: Translate): string {
  return t(`feeding_type_${type === "medicine" ? "medicine_short" : type}` as never);
}

/**
 * Rreshti kryesor i një shënimi: "Biberon · 120 ml" (ose "4 oz"), "Gji · Majtas", "Ushqim i ngurtë · 40 g".
 * Pa `units`, shishja del në ml.
 */
export function entryHeadline(e: FeedingEntry, t: Translate, units?: { volume: VolumeUnit; lang: string }): string {
  const lang = units?.lang ?? "sq";
  return [
    typeLabel(e.type, t),
    e.side ? t(`feeding_side_${e.side}` as never) : null,
    e.amountMl ? volumeText(e.amountMl, units?.volume ?? "ml", lang) : null,
    e.type === "solid" && e.solidAmount && isSolidUnit(e.solidUnit) ? solidAmountText(e.solidAmount, e.solidUnit, lang, t as never) : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

/** Kohëzgjatje e ngjeshur për pllakat e ngushta: "45m", "2h 10m". */
export function compactDuration(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}
