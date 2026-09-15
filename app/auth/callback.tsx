import { useEffect } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { MotiView } from "moti";
import { Logo } from "@/components/auth/Logo";

// Sa pritet që SocialAuthRow ta mbarojë shkëmbimin e token-it para fallback-ut.
const FALLBACK_MS = 10000;

/**
 * Destinacioni i deep link-ut `bebix://auth/callback` pas OAuth-it.
 *
 * Në iOS, `WebBrowser.openAuthSessionAsync` e kap URL-në vetë dhe ky ekran
 * s'hapet kurrë. Në Android, intent-i i deep link-ut i shkon edhe
 * expo-router-it, që pa këtë route do të shfaqte "Unmatched route".
 *
 * Token-i s'shkëmbehet këtu (bëhet te SocialAuthRow, që e merr URL-në nga
 * WebBrowser) — ky ekran vetëm shfaq ngarkimin derisa SocialAuthRow të
 * navigojë. Nëse s'ndodh (p.sh. app-i u rihap nga link-u), kthehet te `/`,
 * i cili vendos vetë sipas sesionit.
 */
export default function AuthCallback() {
  useEffect(() => {
    const timer = setTimeout(() => router.replace("/"), FALLBACK_MS);
    return () => clearTimeout(timer);
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
