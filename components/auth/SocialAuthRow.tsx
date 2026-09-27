import { Pressable, View, Alert, Platform } from "react-native";
import { MotiView } from "moti";
import { useEffect, useRef, useState } from "react";
import * as WebBrowser from "expo-web-browser";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Linking from "expo-linking";
import Svg, { Path } from "react-native-svg";
import { supabase } from "@/lib/supabase/client";
import { parseOAuthRedirect } from "@/lib/auth/oauthRedirect";
import { useThemeColors } from "@/lib/theme/useThemeColors";
import { useTranslation } from "@/lib/i18n/LanguageContext";

// Nevojitet vetëm në web (mbyll popup-in e OAuth-it); në native s'bën asgjë.
WebBrowser.maybeCompleteAuthSession();

type SocialAuthRowProps = {
  /** Thirret pasi sesioni u krijua me sukses — ekrani vendos ku të navigojë. */
  onSignedIn?: (userId: string) => void | Promise<void>;
  /** Kontroll para hapjes së OAuth-it (p.sh. pranimi i Kushteve) — `false` e ndalon. */
  beforeStart?: () => boolean;
};

const buttonClass =
  "h-14 flex-1 items-center justify-center rounded-2xl border border-ink/10 bg-cream";

/**
 * Hyrja me Apple dhe Google.
 *
 * - Google: fluksi OAuth i Supabase-it në shfletuesin e brendshëm, që kthehet
 *   në app me skemën `bebix://`.
 * - Apple: në iPhone me hyrjen NATIVE (`expo-apple-authentication` +
 *   `signInWithIdToken`), siç e kërkon App Store (udhëzimi 4.8) kur ofrohet
 *   Google. Në Android butoni fshihet: Apple aty kërkon një "Services ID" të
 *   konfiguruar, dhe pa të butoni vetëm do të jepte gabim.
 *
 * Butoni i tretë "Email" u hoq: s'ishte i lidhur me asgjë (formulari i
 * email-it është vetë ekrani).
 */
export function SocialAuthRow({ onSignedIn, beforeStart }: SocialAuthRowProps) {
  const { t } = useTranslation();
  const [pressedKey, setPressedKey] = useState<string | null>(null);
  // Ref (jo state) që dy shtypje të shpejta të mos hapin dy sesione OAuth.
  const inFlight = useRef(false);
  const [appleAvailable, setAppleAvailable] = useState(false);

  useEffect(() => {
    if (Platform.OS !== "ios") return;
    let alive = true;
    AppleAuthentication.isAvailableAsync()
      .then((available) => {
        if (alive) setAppleAvailable(available);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  async function handleApple() {
    if (inFlight.current) return;
    if (beforeStart && !beforeStart()) return;
    inFlight.current = true;
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (!credential.identityToken) {
        Alert.alert(t("mod_error_title"), t("auth_login_failed"));
        return;
      }
      const { data, error } = await supabase.auth.signInWithIdToken({ provider: "apple", token: credential.identityToken });
      if (error) {
        Alert.alert(t("mod_error_title"), describe(error.message));
        return;
      }
      // Apple e jep emrin vetëm herën e parë: ruhet te llogaria që të mos humbasë.
      const fullName = [credential.fullName?.givenName, credential.fullName?.familyName].filter(Boolean).join(" ").trim();
      if (fullName && !data.user?.user_metadata?.full_name) {
        await supabase.auth.updateUser({ data: { full_name: fullName } });
      }
      if (data.user?.id) await onSignedIn?.(data.user.id);
    } catch (e) {
      // Anulimi nga përdoruesi s'është gabim.
      if ((e as { code?: string })?.code === "ERR_REQUEST_CANCELED") return;
      Alert.alert(t("mod_error_title"), e instanceof Error ? describe(e.message) : t("auth_login_failed"));
    } finally {
      inFlight.current = false;
    }
  }

  /**
   * Asnje mesazh bosh.
   *
   * Kur kthimi deshton, Supabase ndonjehere nuk jep fare tekst, dhe alert-i
   * dilte me "null" — gje qe s'i thote perdoruesit asgje dhe as neve. Ketu
   * cdo gabim pa tekst zevendesohet me shkakun e vertete me te shpeshte:
   * adresa e kthimit nuk eshte ne listen e lejuar te Supabase-it.
   */
  function describe(message: string | null | undefined, redirectTo?: string): string {
    const text = typeof message === "string" ? message.trim() : "";
    if (!text || text === "null" || text === "undefined") {
      // Adresa shfaqet e plote: ajo eshte pikerisht rreshti qe duhet
      // ngjitur te Supabase, dhe te Expo Go ndryshon me IP-ne e rrjetit.
      return redirectTo ? `${t("auth_redirect_blocked")}

${redirectTo}` : t("auth_redirect_blocked");
    }
    return text;
  }

  async function handleOAuth(provider: "google") {
    if (inFlight.current) return;
    if (beforeStart && !beforeStart()) return;
    inFlight.current = true;

    try {
      // Dev/prod build: bebix://auth/callback — Expo Go: exp://<IP>:8081/--/auth/callback.
      // Të dyja duhet të jenë te Supabase → Auth → URL Configuration → Redirect URLs.
      const redirectTo = Linking.createURL("auth/callback");
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo,
          skipBrowserRedirect: true,
          // Pa këtë, Google e rikyç heshturazi llogarinë e fundit pa pyetur.
          queryParams: { prompt: "select_account" },
        },
      });

      if (error || !data?.url) {
        Alert.alert(t("mod_error_title"), describe(error?.message, redirectTo));
        return;
      }

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

      if (result.type !== "success" || !result.url) {
        // Përdoruesi e anuloi/mbylli browser-in — s'ka nevojë për gabim.
        return;
      }

      const parsed = parseOAuthRedirect(result.url);
      let userId: string | undefined;

      if (parsed.type === "error") {
        Alert.alert(t("mod_error_title"), describe(parsed.message, redirectTo));
        return;
      } else if (parsed.type === "code") {
        const { data: exchanged, error: exchangeError } =
          await supabase.auth.exchangeCodeForSession(parsed.code);
        if (exchangeError) {
          Alert.alert(t("mod_error_title"), describe(exchangeError.message, redirectTo));
          return;
        }
        userId = exchanged.user?.id;
      } else if (parsed.type === "tokens") {
        const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
          access_token: parsed.accessToken,
          refresh_token: parsed.refreshToken,
        });
        if (sessionError) {
          Alert.alert(t("mod_error_title"), describe(sessionError.message, redirectTo));
          return;
        }
        userId = sessionData.user?.id;
      } else {
        // Shfletuesi u kthye pa asnje token: pothuajse gjithmone sepse
        // Supabase e dergoi te Site URL-ja, jo te appi.
        Alert.alert(t("mod_error_title"), `${t("auth_no_session")}

${redirectTo}`);
        return;
      }

      if (userId) {
        await onSignedIn?.(userId);
      }
    } catch (e) {
      Alert.alert(t("mod_error_title"), e instanceof Error ? describe(e.message) : t("auth_login_failed"));
    } finally {
      inFlight.current = false;
    }
  }

  return (
    <View className="flex-row gap-3">
      {appleAvailable && (
        <Pressable
          className={buttonClass}
          onPressIn={() => setPressedKey("apple")}
          onPressOut={() => setPressedKey(null)}
          onPress={handleApple}
          accessibilityRole="button"
          accessibilityLabel={t("auth_continue_apple")}
        >
          <MotiView animate={{ scale: pressedKey === "apple" ? 0.94 : 1 }}>
            <AppleGlyph />
          </MotiView>
        </Pressable>
      )}

      <Pressable
        className={buttonClass}
        onPressIn={() => setPressedKey("google")}
        onPressOut={() => setPressedKey(null)}
        onPress={() => handleOAuth("google")}
        accessibilityRole="button"
        accessibilityLabel={t("auth_continue_google")}
      >
        <MotiView animate={{ scale: pressedKey === "google" ? 0.94 : 1 }}>
          <GoogleGlyph />
        </MotiView>
      </Pressable>
    </View>
  );
}

function AppleGlyph() {
  // Logoja e Apple-it ndjek ngjyren e tekstit, qe te duket mbi butonin e erret.
  const theme = useThemeColors();
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24">
      <Path
        fill={theme.ink}
        d="M16.365 1.43c0 1.14-.462 2.243-1.176 3.032-.79.876-2.058 1.552-3.108 1.464-.14-1.09.42-2.243 1.164-3.008.812-.86 2.232-1.5 3.12-1.488zM20.85 17.02c-.548 1.26-.812 1.824-1.518 2.94-.984 1.56-2.37 3.504-4.086 3.516-1.53.012-1.92-.996-3.996-.984-2.076.012-2.508.996-4.038.984-1.716-.012-3.03-1.776-4.014-3.336-2.754-4.332-3.042-9.42-1.344-12.12 1.206-1.92 3.114-3.048 4.902-3.048 1.818 0 2.964 1.008 4.47 1.008 1.458 0 2.352-1.008 4.47-1.008 1.596 0 3.288.876 4.494 2.388-3.954 2.172-3.312 7.824.66 9.66z"
      />
    </Svg>
  );
}

function GoogleGlyph() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24">
      <Path
        fill="#4285F4"
        d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.47a5.53 5.53 0 0 1-2.4 3.63v3h3.88c2.27-2.09 3.57-5.17 3.57-8.82z"
      />
      <Path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.95-2.91l-3.88-3c-1.08.72-2.46 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.27v3.11A12 12 0 0 0 12 24z"
      />
      <Path
        fill="#FBBC05"
        d="M5.27 14.28A7.2 7.2 0 0 1 4.89 12c0-.79.14-1.56.38-2.28V6.61H1.27A12 12 0 0 0 0 12c0 1.94.46 3.77 1.27 5.39l4-3.11z"
      />
      <Path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.69 1.27 6.61l4 3.11C6.22 6.86 8.87 4.75 12 4.75z"
      />
    </Svg>
  );
}
