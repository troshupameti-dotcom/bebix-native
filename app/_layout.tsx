import "../global.css";
import "@/lib/theme/interop";
import { installErrorReporter } from "@/lib/errors/reporter";
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

SplashScreen.preventAutoHideAsync();

// Lidhet para se te renderohet cdo gje: nje gabim ne montim duhet kapur.
installErrorReporter();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Poppins_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync();
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
      <Stack
        screenOptions={{
          headerShown: false,
          animation: "fade",
          contentStyle: { backgroundColor: theme.cream },
        }}
      />
    </>
  );
}
