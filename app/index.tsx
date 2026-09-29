import { View } from "react-native";
import { Redirect } from "expo-router";
import { Image } from "expo-image";
import { useOnboardingStatus } from "@/lib/hooks/useOnboardingStatus";

export default function Index() {
  const { loading, hasSeenOnboarding, isAuthenticated, isGuest } = useOnboardingStatus();

  // 1. Sa kohë po lexohet storage/auth state, shfaq ekranin e ngarkimit
  if (loading) {
    return (
      // E njëjta figurë, sfond dhe madhësi si splash-i: kalimi s'duket fare.
      <View className="flex-1 items-center justify-center" style={{ backgroundColor: "#F3F3F1" }}>
        <Image source={require("@/assets/images/splash-logo.png")} style={{ width: 300, height: 300 }} contentFit="contain" />
      </View>
    );
  }

  // 2. Redirects të sigurta, deklarative, pasi u ngarkua statusi
  if (isAuthenticated) {
    return <Redirect href="/(main)/baby" />;
  }

  if (isGuest) {
    return <Redirect href="/(main)/shop" />;
  }

  if (hasSeenOnboarding) {
    return <Redirect href="/(auth)/login" />;
  }

  return <Redirect href="/(auth)/welcome" />;
}