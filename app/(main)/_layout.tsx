import { useEffect } from "react";
import { Tabs, router, usePathname } from "expo-router";
import { View, Pressable } from "react-native";
import { Icon, IconName } from "@/components/ui/Icon";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { TranslationKey } from "@/lib/i18n/translations";
import { useOnboardingStatus } from "@/lib/hooks/useOnboardingStatus";
import { shadows } from "@/lib/shadows";

const TABS: { name: string; icon: IconName; labelKey: TranslationKey }[] = [
  { name: "home", icon: "home", labelKey: "nav_home" },
  { name: "baby", icon: "baby", labelKey: "nav_baby" },
  { name: "shop", icon: "shop", labelKey: "nav_shop" },
  { name: "community", icon: "community", labelKey: "nav_community" },
  { name: "more", icon: "more", labelKey: "nav_more" },
];

// Rrugët ku butoni flotues i AI DUHET të shfaqet — vetëm 4 tab-et kryesore,
// jo "more" dhe jo faqet e brendshme (product details, cart, etj.).
const AI_BUTTON_KEYWORDS = ["home", "baby", "shop", "community"];

/**
 * Bottom tab bar for the signed-in app.
 *
 * Expo Router has no server-side middleware equivalent, so route
 * protection happens here instead: this layout wraps every tab, checks
 * for a live Supabase session on mount, and bounces to /login if there
 * isn't one. Simpler than guarding each of the 5 screens individually.
 */
export default function MainLayout() {
  const { t } = useTranslation();
  const { loading, isAuthenticated } = useOnboardingStatus();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.replace("/(auth)/login");
    }
  }, [loading, isAuthenticated]);

  if (loading || !isAuthenticated) return null;

  console.log("PATHNAME AKTUAL:", pathname);
  const showAiButton = AI_BUTTON_KEYWORDS.some((keyword) => pathname.includes(keyword)) && !pathname.includes("more");

  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: "#2C271F",
          tabBarInactiveTintColor: "#A79D8A",
          tabBarStyle: {
            backgroundColor: "#FFFFFF",
            borderTopColor: "#E9DFCC",
            height: 84,
            paddingTop: 8,
            paddingBottom: 24,
          },
          tabBarLabelStyle: { fontSize: 10.5, fontFamily: "Inter_500Medium" },
        }}
      >
        {TABS.map((tab) => (
          <Tabs.Screen
            key={tab.name}
            name={tab.name}
            options={{
              title: t(tab.labelKey),
              tabBarIcon: ({ color, focused }) => (
                <Icon name={tab.icon} size={22} color={focused ? "#2C271F" : color} />
              ),
            }}
          />
        ))}
      </Tabs>

      {showAiButton && (
        <Pressable
          onPress={() => router.push("/ai-chat")}
          style={shadows.softLg}
          className="absolute bottom-24 right-5 w-14 h-14 rounded-full bg-olive items-center justify-center"
        >
          <Icon name="sparkle" size={24} color="#FFFFFF" />
        </Pressable>
      )}
    </View>
  );
}