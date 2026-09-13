import "../global.css";
import { useEffect } from "react";
import { View } from "react-native";
import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import * as SplashScreen from "expo-splash-screen";
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from "@expo-google-fonts/inter";
import { Poppins_700Bold } from "@expo-google-fonts/poppins";
import { LanguageProvider } from "@/lib/i18n/LanguageContext";
import { AppStateProvider } from "@/lib/state/AppStateContext";
import { ToastProvider } from "@/lib/toast/ToastContext";
import { LanguageToggle } from "@/components/ui/LanguageToggle";

SplashScreen.preventAutoHideAsync();

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
            <View style={{ flex: 1 }}>
              <Stack screenOptions={{ headerShown: false, animation: "fade" }} />
              <LanguageToggle />
            </View>
          </ToastProvider>
        </AppStateProvider>
      </LanguageProvider>
    </GestureHandlerRootView>
  );
}