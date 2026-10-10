import type { Href } from "expo-router";
import type { IconName } from "@/components/ui/Icon";
import type { TranslationKey } from "@/lib/i18n/translations";

/**
 * "Çfarë ka të re": del një herë pas përditësimit, për prindërit që e kanë
 * përdorur app-in më parë. Kur shtohen veçori të reja, ndrysho
 * WHATS_NEW_VERSION dhe listën — del sërish një herë.
 */
export const WHATS_NEW_VERSION = "2026-10-features";
export const WHATS_NEW_KEY = "bebix_whats_new_seen_v1";

export type WhatsNewItem = {
  key: string;
  icon: IconName;
  titleKey: TranslationKey;
  bodyKey: TranslationKey;
  route?: Href;
  /** Vetëm në këtë platformë (p.sh. shortcuts e Android-it). */
  platform?: "android" | "ios";
};

export const WHATS_NEW_ITEMS: WhatsNewItem[] = [
  { key: "today", icon: "sparkle", titleKey: "wn_today_title", bodyKey: "wn_today_body" },
  { key: "night", icon: "moon", titleKey: "wn_night_title", bodyKey: "wn_night_body", route: "/more/appearance" },
  { key: "care", icon: "heart", titleKey: "wn_care_title", bodyKey: "wn_care_body", route: "/(main)/baby/parent-care" },
  { key: "team", icon: "family", titleKey: "wn_team_title", bodyKey: "wn_team_body", route: "/more/family" },
  { key: "celebrate", icon: "star", titleKey: "wn_celebrate_title", bodyKey: "wn_celebrate_body", route: "/(main)/baby/moments" },
  { key: "memories", icon: "play", titleKey: "wn_memories_title", bodyKey: "wn_memories_body", route: "/(main)/baby/time-capsule" },
  { key: "shop", icon: "diaper", titleKey: "wn_shop_title", bodyKey: "wn_shop_body", route: "/(main)/baby/diaper" },
  { key: "shortcuts", icon: "flash", titleKey: "wn_shortcuts_title", bodyKey: "wn_shortcuts_body", platform: "android" },
];

export function itemsFor(platform: string): WhatsNewItem[] {
  return WHATS_NEW_ITEMS.filter((i) => !i.platform || i.platform === platform);
}

/**
 * A del ekrani? Vetëm kur s'është parë kjo version, dhe vetëm për dikë që e
 * ka përdorur app-in më parë (ka emër bebi ose shënime). Përdoruesi i ri s'ka
 * çfarë "të re" — për të shënohet si i parë pa u shfaqur.
 */
export function whatsNewDecision(seenVersion: string | null, hasHistory: boolean): "show" | "mark-seen" | "none" {
  if (seenVersion === WHATS_NEW_VERSION) return "none";
  return hasHistory ? "show" : "mark-seen";
}
