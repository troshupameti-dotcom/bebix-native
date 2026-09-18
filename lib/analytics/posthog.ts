import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import Constants from "expo-constants";

/**
 * Analitikë sjelljeje me PostHog, përmes API-t HTTP.
 *
 * Qëllimisht PA paketën `posthog-react-native`: ajo sjell module native
 * dhe do të kërkonte build të ri për çdo pajisje. Gjashtë ngjarje nuk e
 * meritojnë atë çmim — një `fetch` mjafton dhe punon edhe në Expo Go.
 *
 * Rregulla: këtu NUK dërgohen të dhëna personale. Asnjë emër, telefon,
 * adresë apo email. Vetëm id-ja e përdoruesit, numra dhe id produktesh.
 *
 * Pa çelës te .env, gjithçka është no-op — app-i punon njësoj.
 */

const KEY = process.env.EXPO_PUBLIC_POSTHOG_KEY ?? "";
const HOST = (process.env.EXPO_PUBLIC_POSTHOG_HOST ?? "https://eu.i.posthog.com").replace(/\/$/, "");
const ANON_ID_STORAGE_KEY = "bebix.analytics.anonId";

/** Emrat e ngjarjeve — të fiksuar, që gypi të mos prishet nga gabime shtypi. */
export type AnalyticsEvent =
  | "shop_opened"
  | "product_viewed"
  | "added_to_cart"
  | "checkout_started"
  | "order_placed"
  | "order_failed"
  // Jo pjese e gypit: gabimet e app-it, qe te mos mesohen nga recensionet.
  | "app_error";

type Props = Record<string, string | number | boolean | null>;

let anonId: string | null = null;
let userId: string | null = null;

function randomId(): string {
  return `anon_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

async function getAnonId(): Promise<string> {
  if (anonId) return anonId;
  try {
    const stored = await AsyncStorage.getItem(ANON_ID_STORAGE_KEY);
    if (stored) {
      anonId = stored;
      return stored;
    }
  } catch {
    // Storage i padisponueshëm — id e përkohshme për këtë session.
  }
  const fresh = randomId();
  anonId = fresh;
  AsyncStorage.setItem(ANON_ID_STORAGE_KEY, fresh).catch(() => {});
  return fresh;
}

/** Thirret kur përdoruesi kyçet/del, që ngjarjet të lidhen me llogarinë. */
export function setAnalyticsUser(id: string | null): void {
  userId = id;
}

/**
 * Dërgon një ngjarje. Nuk pret përgjigje dhe nuk hedh kurrë gabim:
 * analitika s'ka të drejtë ta prishë një blerje.
 */
export function track(event: AnalyticsEvent, props: Props = {}): void {
  if (!KEY) return;

  void (async () => {
    try {
      const distinctId = userId ?? (await getAnonId());
      await fetch(`${HOST}/capture/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: KEY,
          event,
          distinct_id: distinctId,
          properties: {
            ...props,
            $lib: "bebix-native",
            platform: Platform.OS,
            app_version: Constants.expoConfig?.version ?? null,
            is_signed_in: userId !== null,
          },
          timestamp: new Date().toISOString(),
        }),
      });
    } catch {
      // Pa rrjet ose PostHog i paarritshëm: ngjarja humbet, app-i vazhdon.
    }
  })();
}

/** A është e konfiguruar fare — për ekranin e zhvillimit dhe testet. */
export const analyticsEnabled = KEY.length > 0;
