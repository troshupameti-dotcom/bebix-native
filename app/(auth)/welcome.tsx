import { useRef, useState } from "react";
import { View, Text, Pressable, ScrollView, Dimensions, NativeSyntheticEvent, NativeScrollEvent } from "react-native";
import { router } from "expo-router";
import { MotiView } from "moti";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { Logo } from "@/components/auth/Logo";
import { PrimaryButton } from "@/components/auth/PrimaryButton";
import { SecondaryButton } from "@/components/auth/SecondaryButton";
import { OnboardingDots } from "@/components/auth/OnboardingDots";
import { markOnboardingSeen, markGuestMode } from "@/lib/hooks/useOnboardingStatus";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import type { TranslationKey } from "@/lib/i18n/translations";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const SLIDES: { taglineKey: TranslationKey; image: number }[] = [
  { taglineKey: "welcome_tagline_1", image: require("@/assets/images/onboarding/baby-first-steps.jpg") },
  { taglineKey: "welcome_tagline_2", image: require("@/assets/images/onboarding/track-illustration.png") },
  { taglineKey: "welcome_tagline_3", image: require("@/assets/images/onboarding/shop-products.jpg") },
];

export default function WelcomeScreen() {
  const { t } = useTranslation();
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

  async function handleCreateProfile() {
    await markOnboardingSeen();
    router.push("/(auth)/create-profile");
  }

  async function handleGuestShop() {
    await markGuestMode();
    router.replace("/(main)/shop");
  }

  async function handleLogin() {
    await markOnboardingSeen();
    router.push("/(auth)/login");
  }

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top", "bottom"]}>
      <View className="items-center pt-4">
        <Logo tagline={undefined} size="md" />
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScrollEnd}
        className="mt-3 flex-1"
      >
        {SLIDES.map((slide, i) => (
          <View key={i} style={{ width: SCREEN_WIDTH }} className="items-center px-6">
            <MotiView
              from={{ opacity: 0, translateY: 24 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: "timing", duration: 500, delay: 100 }}
              className="aspect-[3/4] w-full max-h-[70%] overflow-hidden rounded-xl3 bg-cream-soft"
              style={{
                shadowColor: "#2C271F",
                shadowOpacity: 0.08,
                shadowRadius: 12,
                shadowOffset: { width: 0, height: 6 },
                elevation: 3,
              }}
            >
              <Image source={slide.image} style={{ width: "100%", height: "100%" }} contentFit="cover" transition={300} />
            </MotiView>

            <MotiView
              from={{ opacity: 0, translateY: 8 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: "timing", duration: 400, delay: 200 }}
            >
              <Text className="mt-3 text-center font-body text-base text-ink-soft">{t(slide.taglineKey)}</Text>
            </MotiView>
          </View>
        ))}
      </ScrollView>

      <View className="mt-2 items-center">
        <OnboardingDots count={SLIDES.length} activeIndex={index} onSelect={goTo} />
      </View>

      <MotiView
        from={{ opacity: 0, translateY: 12 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: "timing", duration: 400, delay: 300 }}
        className="gap-3 px-6 pb-2 pt-6"
      >
        <PrimaryButton label={t("welcome_create_profile")} onPress={handleCreateProfile} />
        <SecondaryButton label={t("welcome_guest_shop")} onPress={handleGuestShop} />
      </MotiView>

      <Pressable onPress={handleLogin} className="items-center pb-4 pt-2">
        <Text className="font-body text-sm text-ink-faint underline">{t("welcome_have_account")}</Text>
      </Pressable>
    </SafeAreaView>
  );
}