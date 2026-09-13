import { Pressable, View, Alert } from "react-native";
import { MotiView } from "moti";
import { useState } from "react";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import Svg, { Path } from "react-native-svg";
import { supabase } from "@/lib/supabase/client";

WebBrowser.maybeCompleteAuthSession();

type SocialAuthRowProps = {
  onEmailSelect?: () => void;
};

const buttonClass =
  "h-14 flex-1 items-center justify-center rounded-2xl border border-ink/10 bg-cream";

/**
 * Apple / Google / Email row. Uses Supabase's generic OAuth flow opened in
 * an in-app browser, which redirects back into the app via the `bebix://`
 * deep link scheme registered in app.json.
 *
 * Note: if you ship Google sign-in on iOS, App Store guideline 4.8 requires
 * offering Sign in with Apple too, ideally via the native
 * `expo-apple-authentication` button (a closer-to-native alternative to
 * this generic OAuth flow) — swap the Apple handler for that when ready.
 */
export function SocialAuthRow({ onEmailSelect }: SocialAuthRowProps) {
  const [pressedKey, setPressedKey] = useState<string | null>(null);

  // Supabase's OAuth redirect returns tokens in the URL FRAGMENT (after #),
  // not as query params (after ?) — new URL().searchParams misses them entirely.
  function parseAuthParams(url: string): Record<string, string> {
    const hashIndex = url.indexOf("#");
    const queryIndex = url.indexOf("?");
    const paramsString =
      hashIndex !== -1
        ? url.substring(hashIndex + 1)
        : queryIndex !== -1
        ? url.substring(queryIndex + 1)
        : "";

    const params: Record<string, string> = {};
    paramsString.split("&").forEach((pair) => {
      if (!pair) return;
      const [key, value] = pair.split("=");
      if (key) params[decodeURIComponent(key)] = decodeURIComponent(value ?? "");
    });
    return params;
  }

  async function handleOAuth(provider: "apple" | "google") {
    const redirectTo = Linking.createURL("auth/callback");
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo, skipBrowserRedirect: true },
    });

    if (error || !data?.url) {
      Alert.alert("Gabim", error?.message ?? "S'u krijua dot lidhja e login-it.");
      return;
    }

    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

    if (result.type !== "success" || !result.url) {
      // User cancelled or dismissed — no error needed
      return;
    }

    // Modern Supabase-js defaults to PKCE flow: the redirect URL carries
    // ?code=... which must be exchanged for a session.
    const codeMatch = result.url.match(/[?&]code=([^&]+)/);
    if (codeMatch) {
      const code = decodeURIComponent(codeMatch[1]);
      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
      if (exchangeError) {
        Alert.alert("Gabim", exchangeError.message);
      }
      return;
    }

    // Fallback: older/implicit flow returns tokens in the URL fragment (#...)
    const params = parseAuthParams(result.url);

    if (params.error) {
      Alert.alert("Gabim", params.error_description ?? params.error);
      return;
    }

    const access_token = params.access_token;
    const refresh_token = params.refresh_token;

    if (access_token && refresh_token) {
      const { error: sessionError } = await supabase.auth.setSession({
        access_token,
        refresh_token,
      });
      if (sessionError) {
        Alert.alert("Gabim", sessionError.message);
      }
    } else {
      Alert.alert("Gabim", "Nuk u morën tokenat e sesionit nga serveri.");
    }
  }

  return (
    <View className="flex-row gap-3">
      <Pressable
        className={buttonClass}
        onPressIn={() => setPressedKey("apple")}
        onPressOut={() => setPressedKey(null)}
        onPress={() => handleOAuth("apple")}
      >
        <MotiView animate={{ scale: pressedKey === "apple" ? 0.94 : 1 }}>
          <AppleGlyph />
        </MotiView>
      </Pressable>

      <Pressable
        className={buttonClass}
        onPressIn={() => setPressedKey("google")}
        onPressOut={() => setPressedKey(null)}
        onPress={() => handleOAuth("google")}
      >
        <MotiView animate={{ scale: pressedKey === "google" ? 0.94 : 1 }}>
          <GoogleGlyph />
        </MotiView>
      </Pressable>

      <Pressable
        className={buttonClass}
        onPressIn={() => setPressedKey("email")}
        onPressOut={() => setPressedKey(null)}
        onPress={onEmailSelect}
      >
        <MotiView animate={{ scale: pressedKey === "email" ? 0.94 : 1 }}>
          <EmailGlyph />
        </MotiView>
      </Pressable>
    </View>
  );
}

function AppleGlyph() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24">
      <Path
        fill="#2C271F"
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

function EmailGlyph() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#2C271F" strokeWidth={1.6}>
      <Path d="M3 5h18v14H3V5Z" />
      <Path d="M3.5 6.5 12 13l8.5-6.5" />
    </Svg>
  );
}