import "../global.css";
import "@/lib/theme/interop";
import { installErrorReporter } from "@/lib/errors/reporter";
import { initSentry, wrapWithSentry } from "@/lib/errors/sentry";
import { useEffect } from "react";
import { Stack, usePathname } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import * as SplashScreen from "expo-splash-screen";
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from "@expo-google-fonts/inter";
import { Poppins_700Bold } from "@expo-google-fonts/poppins";
import { LanguageProvider } from "@/lib/i18n/LanguageContext";
import { AppStateProvider } from "@/lib/state/AppStateContext";
import { ToastProvider } from "@/lib/toast/ToastContext";
import { useThemeColors } from "@/lib/theme/useThemeColors";
import { recordPath } from "@/lib/navigation/history";
import { BrandSplash } from "@/components/ui/BrandSplash";
import { MAX_CONTENT_WIDTH } from "@/lib/layout";
import { View } from "react-native";

SplashScreen.preventAutoHideAsync();
// Pas splash-it të sistemit vjen BrandSplash me të njëjtin sfond: kalim i shpejtë.
SplashScreen.setOptions({ duration: 200, fade: true });

/**
 * Sa gjatë rri logoja në hapje, si te TikTok: mjaft sa të shihet marka, pa u
 * bërë pritje. Nëse app-i ngarkohet më ngadalë, rri deri sa të jetë gati.
 */
const SPLASH_MIN_MS = 1800;
const APP_START = Date.now();

// Lidhet para se te renderohet cdo gje: nje gabim ne montim duhet kapur.
initSentry();
installErrorReporter();

export default wrapWithSentry(RootLayout);

function RootLayout() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Poppins_700Bold,
  });

  // Splash-i i sistemit hiqet sapo app-i është gati; koha e mbetur e logos
  // kalon te BrandSplash, që tregon logon e plotë (edhe te Android).
  useEffect(() => {
    if (fontsLoaded) void SplashScreen.hideAsync();
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <LanguageProvider>
        <AppStateProvider>
          <ToastProvider>
            <ThemedStack />
          </ToastProvider>
        </AppStateProvider>
      </LanguageProvider>
      <BrandSplash until={APP_START + SPLASH_MIN_MS} />
    </GestureHandlerRootView>
  );
}
/**
 * Brenda providerëve, që të dijë temën: ikonat e StatusBar-it dhe sfondi pas
 * ekraneve (i dukshëm gjatë animacioneve) ndjekin temën, pa blic të bardhë.
 */
function ThemedStack() {
  const theme = useThemeColors();
  const pathname = usePathname();

  // Kthimi duhet te dije ku ishte perdoruesi vertet: me kater tabe, secili
  // me stiven e vet, `router.back()` nuk mjafton (shih goBackOr).
  useEffect(() => {
    recordPath(pathname);
  }, [pathname]);

  return (
    <>
      <StatusBar style={theme.isDark ? "light" : "dark"} />
      {/* Në tablet dhe në të palosshmit e hapur përmbajtja rri në qendër me
          gjerësi të kufizuar; në telefon mbush gjithë ekranin. */}
      <View style={{ flex: 1, alignItems: "center", backgroundColor: theme.cream }}>
        <View style={{ flex: 1, width: "100%", maxWidth: MAX_CONTENT_WIDTH }}>
          <Stack
            screenOptions={{
              headerShown: false,
              animation: "fade",
              contentStyle: { backgroundColor: theme.cream },
            }}
          />
        </View>
      </View>
    </>
  );
}
