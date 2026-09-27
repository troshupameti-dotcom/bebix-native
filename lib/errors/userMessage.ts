import type { TranslationKey } from "@/lib/i18n/translations";

type T = (key: TranslationKey, params?: Record<string, string | number>) => string;

/**
 * Gabimet që i shfaqen prindit.
 *
 * Supabase dhe rrjeti kthejnë tekst teknik në anglisht ("Invalid login
 * credentials", "Network request failed", "new row violates row-level security
 * policy"). Më parë ai tekst dilte drejtpërdrejt në ekran. Këtu njihen rastet e
 * shpeshta dhe kthehen në një fjali të përkthyer që i thotë çfarë të bëjë.
 *
 * Mesazhet që i shkruajmë vetë në bazë (funksionet RPC, p.sh. "Kodi nuk u
 * gjet.") janë tashmë për njerëz: kalojnë siç janë.
 */

/** Teksti i gabimit, cilado qoftë forma (Error, objekt i Supabase-it, tekst). */
export function errorText(e: unknown): string {
  if (typeof e === "string") return e;
  if (e && typeof e === "object") {
    const message = (e as { message?: unknown }).message;
    if (typeof message === "string") return message;
    const description = (e as { error_description?: unknown }).error_description;
    if (typeof description === "string") return description;
  }
  return "";
}

/** Çelësi i përkthimit për një gabim të njohur, ose null. */
export function friendlyErrorKey(message: string): TranslationKey | null {
  const m = message.toLowerCase();
  if (!m) return null;
  if (/network request failed|failed to fetch|networkerror|fetch failed|timed? ?out|network error|internet/.test(m)) return "err_network";
  if (m.includes("invalid login credentials") || m.includes("invalid_credentials")) return "err_invalid_login";
  if (m.includes("email not confirmed")) return "err_email_not_confirmed";
  if (m.includes("already registered") || m.includes("already been registered") || m.includes("user_already_exists")) {
    return "err_already_registered";
  }
  if (m.includes("password") && (m.includes("at least") || m.includes("weak") || m.includes("leaked") || m.includes("known"))) {
    return "err_weak_password";
  }
  if (m.includes("rate limit") || m.includes("too many requests") || m.includes("only request this after") || m.includes("over_email_send_rate_limit")) {
    return "err_rate_limit";
  }
  if (m.includes("jwt") || m.includes("refresh token") || m.includes("auth session missing") || m.includes("session_not_found")) {
    return "err_session";
  }
  if (m.includes("row-level security") || m.includes("permission denied") || m.includes("not authorized")) return "err_forbidden";
  if (m.includes("duplicate key")) return "err_duplicate";
  return null;
}

/**
 * Mesazhet shqip të bazës njihen nga shkronjat ë/ç ose nga fjalët që i
 * përdorim në to — teksti teknik në anglisht s'i ka.
 */
const ALBANIAN = /[ëçËÇ]|\b(nuk|duhet|kodi|llogari|porosi|stok|familj|jesh|mund|shenja|gjet)/i;
function isOurMessage(message: string): boolean {
  return ALBANIAN.test(message) && message.length < 300;
}

export function friendlyError(e: unknown, t: T, fallback: TranslationKey): string {
  const message = errorText(e);
  const key = friendlyErrorKey(message);
  if (key) return t(key);
  if (isOurMessage(message)) return message;
  return t(fallback);
}
