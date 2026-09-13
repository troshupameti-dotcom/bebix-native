import { View } from "react-native";
import { Redirect } from "expo-router";
import { MotiView } from "moti";
import { Logo } from "@/components/auth/Logo";
import { useOnboardingStatus } from "@/lib/hooks/useOnboardingStatus";

export default function Index() {
  const { loading, hasSeenOnboarding, isAuthenticated, isGuest } = useOnboardingStatus();

  // 1. Sa kohë po lexohet storage/auth state, shfaq ekranin e ngarkimit
  if (loading) {
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

  // 2. Redirects të sigurta, deklarative, pasi u ngarkua statusi
  if (isAuthenticated) {
    return <Redirect href="/(main)/home" />;
  }

  if (isGuest) {
    return <Redirect href="/(main)/shop" />;
  }

  if (hasSeenOnboarding) {
    return <Redirect href="/(auth)/login" />;
  }

  return <Redirect href="/(auth)/welcome" />;
}