import type { IconName } from "@/components/ui/Icon";
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

/** Rreshti kryesor i një shënimi: "Biberon · 120 ml", "Gji · Majtas", "Ushqim i ngurtë". */
export function entryHeadline(e: FeedingEntry, t: Translate): string {
  return [
    typeLabel(e.type, t),
    e.side ? t(`feeding_side_${e.side}` as never) : null,
    e.amountMl ? `${e.amountMl} ml` : null,
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
