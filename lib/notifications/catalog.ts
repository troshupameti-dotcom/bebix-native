import type { IconName } from "@/components/ui/Icon";
import type { TranslationKey } from "@/lib/i18n/translations";

/**
 * Katalogu i njoftimeve — burimi i vetëm.
 *
 * Rregulli: një çelës hyn këtu VETËM nëse ka një dërgues të vërtetë.
 * Ekrani i vjetër i cilësimeve premtonte email, SMS, raporte javore dhe
 * "emergency alerts" — asnjëra nuk dërgohej kurrë. Toggle-i që nuk kontrollon
 * asgjë është gënjeshtër e vogël që përdoruesi e zbulon herët.
 *
 * Çdo çelës këtu përputhet me çelësin që përdorin triggerat dhe funksionet
 * në server (`notification_allowed(user, key)`).
 */

export type NotificationKey =
  // Çelësi kryesor
  | "push"
  // Bebi
  | "baby_feeding"
  | "baby_sleep"
  | "baby_diaper"
  | "baby_medicine"
  | "baby_vaccine"
  | "baby_growth"
  | "baby_milestone"
  | "baby_birthday"
  | "baby_weekly"
  // Dyqani
  | "shop_order"
  | "shop_review_request"
  | "shop_offers"
  // Komuniteti
  | "community_comment"
  | "community_reply"
  | "community_like"
  | "community_expert_post"
  | "community_group_post";

export type NotificationGroup = "baby" | "shop" | "community";

export type NotificationEntry = {
  key: Exclude<NotificationKey, "push">;
  group: NotificationGroup;
  icon: IconName;
  labelKey: TranslationKey;
  hintKey: TranslationKey;
  /** Parazgjedhja. Marketingu nis i fikur — pëlqimi jepet, nuk merret. */
  default: boolean;
};

export const NOTIFICATION_CATALOG: NotificationEntry[] = [
  // --- Bebi -----------------------------------------------------------
  { key: "baby_feeding",   group: "baby", icon: "spoon",   labelKey: "notif_baby_feeding",   hintKey: "notif_baby_feeding_hint",   default: true },
  { key: "baby_sleep",     group: "baby", icon: "moon",    labelKey: "notif_baby_sleep",     hintKey: "notif_baby_sleep_hint",     default: true },
  { key: "baby_diaper",    group: "baby", icon: "diaper",  labelKey: "notif_baby_diaper",    hintKey: "notif_baby_diaper_hint",    default: true },
  { key: "baby_medicine",  group: "baby", icon: "pill",    labelKey: "notif_baby_medicine",  hintKey: "notif_baby_medicine_hint",  default: true },
  { key: "baby_vaccine",   group: "baby", icon: "syringe", labelKey: "notif_baby_vaccine",   hintKey: "notif_baby_vaccine_hint",   default: true },
  { key: "baby_growth",    group: "baby", icon: "chart",   labelKey: "notif_baby_growth",    hintKey: "notif_baby_growth_hint",    default: true },
  { key: "baby_milestone", group: "baby", icon: "sparkle", labelKey: "notif_baby_milestone", hintKey: "notif_baby_milestone_hint", default: true },
  { key: "baby_birthday",  group: "baby", icon: "flame",   labelKey: "notif_baby_birthday",  hintKey: "notif_baby_birthday_hint",  default: true },
  // Dërguesi është vetë telefoni (njoftim lokal i së hënës, lib/notifications.ts), jo serveri.
  { key: "baby_weekly",    group: "baby", icon: "star",    labelKey: "notif_baby_weekly",    hintKey: "notif_baby_weekly_hint",    default: true },

  // --- Dyqani ---------------------------------------------------------
  { key: "shop_order",          group: "shop", icon: "cube",  labelKey: "notif_shop_order",   hintKey: "notif_shop_order_hint",   default: true },
  { key: "shop_review_request", group: "shop", icon: "star",  labelKey: "notif_shop_review",  hintKey: "notif_shop_review_hint",  default: true },
  { key: "shop_offers",         group: "shop", icon: "flash", labelKey: "notif_shop_offers",  hintKey: "notif_shop_offers_hint",  default: false },

  // --- Komuniteti -----------------------------------------------------
  { key: "community_comment",     group: "community", icon: "comment",  labelKey: "notif_community_comment", hintKey: "notif_community_comment_hint", default: true },
  { key: "community_reply",       group: "community", icon: "repeat",   labelKey: "notif_community_reply",   hintKey: "notif_community_reply_hint",   default: true },
  { key: "community_like",        group: "community", icon: "heart",    labelKey: "notif_community_like",    hintKey: "notif_community_like_hint",    default: true },
  { key: "community_expert_post", group: "community", icon: "shield",   labelKey: "notif_community_expert",  hintKey: "notif_community_expert_hint",  default: true },
  { key: "community_group_post",  group: "community", icon: "family",   labelKey: "notif_community_group",   hintKey: "notif_community_group_hint",   default: true },
];

export const NOTIFICATION_GROUPS: { group: NotificationGroup; titleKey: TranslationKey }[] = [
  { group: "baby", titleKey: "notif_group_baby" },
  { group: "shop", titleKey: "notif_group_shop" },
  { group: "community", titleKey: "notif_group_community" },
];

export type NotificationPrefs = {
  /** Çelësat e katalogut; mungesa do të thotë parazgjedhja. */
  keys: Partial<Record<NotificationKey, boolean>>;
  /** Orët e qeta, 0–23. E njëjta orë për të dyja = pa orë të qeta. */
  quietFrom: number;
  quietTo: number;
  /** Pas sa orësh pa ushqyerje / pa ndërruar pelenë vjen kujtesa (1–12). */
  feedingGapH: number;
  diaperGapH: number;
};

export const REMINDER_GAP_MIN = 1;
export const REMINDER_GAP_MAX = 12;
const DEFAULT_GAP_H = 4;

export const initialNotificationPrefs: NotificationPrefs = {
  keys: {},
  quietFrom: 22,
  quietTo: 7,
  feedingGapH: DEFAULT_GAP_H,
  diaperGapH: DEFAULT_GAP_H,
};

/** Vlerë e ruajtur -> orë e vlefshme; çdo gjë tjetër = 4 orë. */
export function clampGap(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return DEFAULT_GAP_H;
  return Math.min(REMINDER_GAP_MAX, Math.max(REMINDER_GAP_MIN, Math.round(value)));
}

export function isNotificationEnabled(prefs: NotificationPrefs, key: NotificationKey): boolean {
  if (key !== "push" && prefs.keys.push === false) return false;
  const stored = prefs.keys[key];
  if (typeof stored === "boolean") return stored;
  if (key === "push") return true;
  return NOTIFICATION_CATALOG.find((e) => e.key === key)?.default ?? true;
}

/**
 * Cilësimet e vjetra -> të rejat. Instalimet ekzistuese kanë çelësa si
 * `feedingReminders`; pa këtë hartë, zgjedhjet e tyre do të zhdukeshin pa
 * zhurmë dhe gjithçka do të rifillonte e ndezur.
 *
 * `marketing` dhe `shoppingNotifications` NUK barten: pëlqimi për ofertat
 * duhet dhënë me vetëdije te ekrani i ri, jo i trashëguar nga një fushë që
 * s'dërgonte asgjë.
 */
const LEGACY_MAP: Record<string, NotificationKey[]> = {
  pushEnabled: ["push"],
  feedingReminders: ["baby_feeding"],
  sleepReminders: ["baby_sleep"],
  medicineReminders: ["baby_medicine"],
  vaccinationReminders: ["baby_vaccine"],
  deliveryUpdates: ["shop_order"],
  communityNotifications: [
    "community_comment",
    "community_reply",
    "community_like",
    "community_expert_post",
    "community_group_post",
  ],
};

export function migrateNotificationPrefs(stored: unknown): NotificationPrefs {
  if (!stored || typeof stored !== "object") return initialNotificationPrefs;

  const raw = stored as Record<string, unknown>;

  // Forma e re ka `keys`; asgjë për të migruar.
  if (raw.keys && typeof raw.keys === "object") {
    return {
      keys: raw.keys as Partial<Record<NotificationKey, boolean>>,
      quietFrom: typeof raw.quietFrom === "number" ? raw.quietFrom : 22,
      quietTo: typeof raw.quietTo === "number" ? raw.quietTo : 7,
      feedingGapH: clampGap(raw.feedingGapH),
      diaperGapH: clampGap(raw.diaperGapH),
    };
  }

  const keys: Partial<Record<NotificationKey, boolean>> = {};
  for (const [legacyKey, targets] of Object.entries(LEGACY_MAP)) {
    const value = raw[legacyKey];
    if (typeof value !== "boolean") continue;
    for (const target of targets) keys[target] = value;
  }

  return { keys, quietFrom: 22, quietTo: 7, feedingGapH: DEFAULT_GAP_H, diaperGapH: DEFAULT_GAP_H };
}
