/**
 * Ku kthehet përdoruesi pas hyrjes (`?redirect=` te login/regjistrimi).
 *
 * Parametri vjen nga adresa, pra mund ta shkruajë cilido në një link. Pranohet
 * vetëm një rrugë e brendshme e app-it ("/..."), jo adresë e jashtme.
 */
export function safeRedirect(value: unknown, fallback = "/(main)/baby"): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//") || trimmed.includes("://") || trimmed.includes("\\")) {
    return fallback;
  }
  return trimmed;
}
