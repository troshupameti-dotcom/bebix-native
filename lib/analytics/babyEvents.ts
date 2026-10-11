import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import { track, type AnalyticsEvent } from "@/lib/analytics/posthog";
import { isNotificationEnabled, NOTIFICATION_CATALOG, type NotificationPrefs } from "@/lib/notifications/catalog";

/**
 * Ngjarjet e faqes së bebit për PostHog: sa vazhdojnë prindërit të regjistrojnë
 * dhe a e përdorin widget-in. Rregulla e posthog.ts vlen edhe këtu: asnjë emër
 * bebi/prindi, datëlindje, shënim, sasi, foto, email apo telefon — vetëm
 * llojet dhe numrat. `safeProps` i heq çelësat e ndaluar edhe nëse dikush i
 * shton gabimisht.
 *
 * Gjithçka është fire-and-forget: s'pret dhe s'hedh gabim, që regjistrimi me
 * një prekje të mos vonohet kurrë.
 */

export type RecordKind = "feeding" | "diaper" | "sleep";
/**
 * quick_button = shënimet me një prekje brenda app-it (pllakat, "Ushqeva tani",
 * butoni i gjumit, modaliteti i natës); app = forma e plotë; widget / deep_link
 * = nga radha e widget-it ose lidhjet bebix:// (Siri, shortcuts).
 */
export type RecordSource = "app" | "quick_button" | "widget" | "deep_link";

type Props = Record<string, string | number | boolean | null>;

/** Çelësat që s'dalin kurrë nga telefoni drejt analitikës. */
export const FORBIDDEN_KEYS = ["name", "dob", "birth", "note", "email", "phone", "address", "ml", "amount", "photo", "text", "body"];

/** Heq çdo çelës që ngjan me të dhëna personale (emër, datëlindje, shënim…). */
export function safeProps(props: Props): Props {
  const out: Props = {};
  for (const [k, v] of Object.entries(props)) {
    const lower = k.toLowerCase();
    if (FORBIDDEN_KEYS.some((f) => lower.includes(f))) continue;
    out[k] = v;
  }
  return out;
}

function send(event: AnalyticsEvent, props: Props = {}) {
  try {
    track(event, safeProps(props));
  } catch {
    // Analitika s'ka të drejtë të prishë asgjë.
  }
}

/** Ora lokale 0–23 e çastit të regjistrimit. */
export function localHour(at: Date | string): number {
  const d = typeof at === "string" ? new Date(at) : at;
  const h = d.getHours();
  return Number.isNaN(h) ? new Date().getHours() : h;
}

/** Ditë të plota (sipas mesnatës lokale) që nga hapja e parë. */
export function daysSince(firstIso: string, now: Date = new Date()): number {
  const f = new Date(firstIso);
  if (Number.isNaN(f.getTime())) return 0;
  const a = new Date(f.getFullYear(), f.getMonth(), f.getDate()).getTime();
  const b = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.max(0, Math.round((b - a) / 86_400_000));
}

/** Sa minuta vonë hyri në app një shënim i bërë nga widget-i (≥ 0). */
export function delayMinutes(tappedAt: string, now: Date = new Date()): number {
  const t = new Date(tappedAt).getTime();
  return Number.isNaN(t) ? 0 : Math.max(0, Math.round((now.getTime() - t) / 60_000));
}

/** Burimi i një veprimi nga radha (veprimet e vjetra pa burim = widget). */
export function queueSource(source: string | undefined): RecordSource {
  return source === "deep_link" ? "deep_link" : "widget";
}

/**
 * Një regjistrim i ri, i krijuar NË KËTË TELEFON nga ky përdorues (jo nga
 * sync-u). `at` = ora e regjistrimit; `queuedAt` vetëm për widget/deep link.
 */
export function trackRecordLogged(input: { kind: RecordKind; source: RecordSource; at?: string | Date; queuedAt?: string }): void {
  const props: Props = { kind: input.kind, source: input.source, hour: localHour(input.at ?? new Date()) };
  if (input.queuedAt) props.delay_minutes = delayMinutes(input.queuedAt);
  void NetInfo.fetch()
    .then((s) => send("record_logged", { ...props, offline: s.isConnected === false }))
    .catch(() => send("record_logged", { ...props, offline: false }));
}

export function trackRecordUndone(kind: RecordKind, action: "edit" | "delete"): void {
  send("record_undone", { kind, action });
}

// --- Seanca -----------------------------------------------------------------

const FIRST_OPEN_KEY = "bebix.analytics.firstOpen";
/** Kthimi pas kësaj kohe në sfond llogaritet seancë e re (si te PostHog). */
export const SESSION_GAP_MS = 30 * 60_000;
let lastActiveAt = 0;

/** A fillon seancë e re (hapja e parë, ose kthim pas ≥ 30 min). */
export function isNewSession(lastActive: number, now: number): boolean {
  return lastActive === 0 || now - lastActive >= SESSION_GAP_MS;
}

/** Thirret në hapje dhe sa herë app-i vjen në plan të parë; dërgon vetëm një herë për seancë. */
export function trackAppOpened(now: Date = new Date()): void {
  const fresh = isNewSession(lastActiveAt, now.getTime());
  lastActiveAt = now.getTime();
  if (!fresh) return;
  void (async () => {
    let first: string | null = null;
    try {
      first = await AsyncStorage.getItem(FIRST_OPEN_KEY);
      if (!first) {
        first = now.toISOString();
        await AsyncStorage.setItem(FIRST_OPEN_KEY, first);
      }
    } catch {
      first = now.toISOString();
    }
    send("app_opened", { days_since_first_open: daysSince(first, now) });
  })();
}

/** Thirret kur app-i shkon në sfond: koha e fundit aktive (për 30 minutat). */
export function markAppBackground(now: Date = new Date()): void {
  lastActiveAt = now.getTime();
}

// --- Familja dhe njoftimet ---------------------------------------------------

export function trackHouseholdInvite(role: "parent" | "viewer"): void {
  send("household_invite_created", { role });
}

export function trackHouseholdJoined(): void {
  send("household_joined");
}

/** Sa lloje njoftimesh janë fikur (jo cilat). */
export function disabledNotificationCount(prefs: NotificationPrefs): number {
  return NOTIFICATION_CATALOG.filter((e) => !isNotificationEnabled(prefs, e.key)).length;
}

export function trackNotificationPrefs(prefs: NotificationPrefs): void {
  send("notification_prefs_changed", { disabled_count: disabledNotificationCount(prefs), total: NOTIFICATION_CATALOG.length });
}
