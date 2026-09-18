/**
 * Interpreton URL-në me të cilën Supabase e kthen përdoruesin në app pas
 * OAuth-it (Google/Apple). Funksion i pastër — pa varësi nga React Native —
 * që të mund të testohet veç.
 *
 * Supabase kthen njërën nga këto:
 *   PKCE flow:     bebix://auth/callback?code=...
 *   Implicit flow: bebix://auth/callback#access_token=...&refresh_token=...
 *                  (default i supabase-js kur `flowType` s'caktohet)
 *   Gabim:         ?error=...&error_description=...  (ose në fragment)
 *   Rivendosje:    #access_token=...&type=recovery  (linku nga email-i)
 */
export type OAuthRedirectResult =
  | { type: "code"; code: string }
  /** `recovery` = linku i rivendosjes se fjalekalimit, jo kycje normale. */
  | { type: "tokens"; accessToken: string; refreshToken: string; recovery: boolean }
  | { type: "error"; message: string }
  | { type: "none" };

function parseParams(paramsString: string): Record<string, string> {
  const params: Record<string, string> = {};
  paramsString.split("&").forEach((pair) => {
    if (!pair) return;
    const eqIndex = pair.indexOf("=");
    const rawKey = eqIndex === -1 ? pair : pair.substring(0, eqIndex);
    const rawValue = eqIndex === -1 ? "" : pair.substring(eqIndex + 1);
    // Form-encoding përdor "+" për hapësirë; decodeURIComponent s'e kthen vetë.
    const decode = (s: string) => decodeURIComponent(s.replace(/\+/g, " "));
    try {
      params[decode(rawKey)] = decode(rawValue);
    } catch {
      // Encoding i prishur — injoro vetëm këtë çift.
    }
  });
  return params;
}

export function parseOAuthRedirect(url: string): OAuthRedirectResult {
  const hashIndex = url.indexOf("#");
  const beforeHash = hashIndex === -1 ? url : url.substring(0, hashIndex);
  const queryIndex = beforeHash.indexOf("?");

  const query = queryIndex === -1 ? {} : parseParams(beforeHash.substring(queryIndex + 1));
  const fragment = hashIndex === -1 ? {} : parseParams(url.substring(hashIndex + 1));
  const params = { ...query, ...fragment };

  if (params.error || params.error_description) {
    return { type: "error", message: params.error_description || params.error };
  }

  if (query.code) {
    return { type: "code", code: query.code };
  }

  if (params.access_token && params.refresh_token) {
    return {
      type: "tokens",
      accessToken: params.access_token,
      refreshToken: params.refresh_token,
      recovery: params.type === "recovery",
    };
  }

  return { type: "none" };
}
