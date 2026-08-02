import { useEffect } from "react";
import { Tabs, router } from "expo-router";
import { Icon, IconName } from "@/components/ui/Icon";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { TranslationKey } from "@/lib/i18n/translations";
import { useOnboardingStatus } from "@/lib/hooks/useOnboardingStatus";

const TABS: { name: string; icon: IconName; labelKey: TranslationKey }[] = [
  { name: "home", icon: "home", labelKey: "nav_home" },
  { name: "baby", icon: "baby", labelKey: "nav_baby" },
  { name: "shop", icon: "shop", labelKey: "nav_shop" },
  { name: "community", icon: "community", labelKey: "nav_community" },
  { name: "more", icon: "more", labelKey: "nav_more" },
];

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

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.replace("/(auth)/login");
    }
  }, [loading, isAuthenticated]);

  if (loading || !isAuthenticated) return null;

  return (
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
  );
}
