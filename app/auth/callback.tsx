import { useEffect, useRef } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import * as Linking from "expo-linking";
import { MotiView } from "moti";
import { Logo } from "@/components/auth/Logo";
import { supabase } from "@/lib/supabase/client";
import { parseOAuthRedirect } from "@/lib/auth/oauthRedirect";

// Sa pritet që SocialAuthRow ta mbarojë shkëmbimin e token-it para fallback-ut.
const FALLBACK_MS = 10000;

/**
 * Destinacioni i deep link-ut `bebix://auth/callback`.
 *
 * Në iOS, `WebBrowser.openAuthSessionAsync` e kap URL-në vetë dhe ky ekran
 * s'hapet kurrë gjatë OAuth-it. Në Android, intent-i i shkon edhe
 * expo-router-it, që pa këtë route do të shfaqte "Unmatched route".
 *
 * Token-i i OAuth-it s'shkëmbehet këtu (bëhet te SocialAuthRow, që e merr
 * URL-në nga WebBrowser). POR linku i rivendosjes së fjalëkalimit vjen nga
 * email-i, jo nga WebBrowser: atë s'e dëgjonte askush, dhe përdoruesi
 * mbetej te ky ekran derisa fallback-u e kthente te faqja kryesore. Prandaj
 * këtu kontrollohet URL-ja hyrëse, dhe vetëm `type=recovery` trajtohet.
 */
export default function AuthCallback() {
  const handled = useRef(false);

  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      if (!handled.current) router.replace("/");
    }, FALLBACK_MS);

    async function handleUrl(url: string | null) {
      if (!url || !active || handled.current) return;

      const parsed = parseOAuthRedirect(url);
      if (parsed.type !== "tokens" || !parsed.recovery) return;

      handled.current = true;
      clearTimeout(timer);

      const { error } = await supabase.auth.setSession({
        access_token: parsed.accessToken,
        refresh_token: parsed.refreshToken,
      });

      if (!active) return;
      // Sesioni i rikuperimit lejon vetëm një gjë: vendosjen e fjalëkalimit.
      // Nëse dështon, linku ka skaduar — kthehu te kërkesa për një të ri.
      router.replace(error ? "/(auth)/forgot-password" : "/(auth)/reset-password");
    }

    Linking.getInitialURL().then(handleUrl);
    const subscription = Linking.addEventListener("url", (event) => handleUrl(event.url));

    return () => {
      active = false;
      clearTimeout(timer);
      subscription.remove();
    };
  }, []);

  return (
    <View className="flex-1 items-center justify-center bg-cream">
      <MotiView
        from={{ opacity: 0.4 }}
        animate={{ opacity: 1 }}
        transition={{ type: "timing", duration: 900, loop: true, repeatReverse: true }}
      >
        <Logo tagline={undefined} size="md" />
      </MotiView>
    </View>
  );
}
