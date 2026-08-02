import { useRef, useState } from "react";
import { View, Text, ScrollView, Dimensions, NativeSyntheticEvent, NativeScrollEvent } from "react-native";
import { router } from "expo-router";
import { MotiView } from "moti";
import { SafeAreaView } from "react-native-safe-area-context";
import { Logo } from "@/components/auth/Logo";
import { PrimaryButton } from "@/components/auth/PrimaryButton";
import { SecondaryButton } from "@/components/auth/SecondaryButton";
import { OnboardingDots } from "@/components/auth/OnboardingDots";
import { markOnboardingSeen } from "@/lib/hooks/useOnboardingStatus";
import { Icon } from "@/components/ui/Icon";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const SLIDES = [
  { tagline: "For every little step." },
  { tagline: "Track feeds, sleep & growth — beautifully." },
  { tagline: "A calmer way to care for your little one." },
];

export default function WelcomeScreen() {
  const [index, setIndex] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  function handleScrollEnd(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const next = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    setIndex(next);
  }

  function goTo(i: number) {
    scrollRef.current?.scrollTo({ x: i * SCREEN_WIDTH, animated: true });
    setIndex(i);
  }

  async function handleCreateAccount() {
    await markOnboardingSeen();
    router.push("/(auth)/signup");
  }

  async function handleLogIn() {
    await markOnboardingSeen();
    router.push("/(auth)/login");
  }

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top", "bottom"]}>
      <View className="items-center pt-6">
        <Logo tagline={undefined} />
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScrollEnd}
        className="mt-6 flex-1"
      >
        {SLIDES.map((slide, i) => (
          <View key={i} style={{ width: SCREEN_WIDTH }} className="items-center px-6">
            <MotiView
              from={{ opacity: 0, translateY: 24 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: "timing", duration: 500, delay: 100 }}
              className="aspect-[4/5] w-full max-h-[48%] items-center justify-center overflow-hidden rounded-xl3 bg-cream-soft"
            >
              {/* Swap for a real photo (expo-image) once assets exist */}
              <Icon name="baby" size={72} color="#E9DFCC" />
            </MotiView>

            <MotiView
              from={{ opacity: 0, translateY: 8 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: "timing", duration: 400, delay: 200 }}
            >
              <Text className="mt-6 text-center font-body text-base text-ink-soft">
                {slide.tagline}
              </Text>
            </MotiView>
          </View>
        ))}
      </ScrollView>

      <View className="mt-4 items-center">
        <OnboardingDots count={SLIDES.length} activeIndex={index} onSelect={goTo} />
      </View>

      <MotiView
        from={{ opacity: 0, translateY: 12 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: "timing", duration: 400, delay: 300 }}
        className="gap-3 px-6 pb-4 pt-8"
      >
        <PrimaryButton label="Create Account" onPress={handleCreateAccount} />
        <SecondaryButton label="Log In" onPress={handleLogIn} />
      </MotiView>
    </SafeAreaView>
  );
}
