import { useEffect } from "react";
import { Tabs, router } from "expo-router";
import { View, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon, IconName } from "@/components/ui/Icon";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { TranslationKey } from "@/lib/i18n/translations";
import { useOnboardingStatus } from "@/lib/hooks/useOnboardingStatus";
import { useAppState } from "@/lib/state/AppStateContext";
import { shadows } from "@/lib/shadows";

const TABS: { name: string; icon: IconName; labelKey: TranslationKey }[] = [
  { name: "home", icon: "home", labelKey: "nav_home" },
  { name: "baby", icon: "baby", labelKey: "nav_baby" },
  { name: "shop", icon: "shop", labelKey: "nav_shop" },
  { name: "community", icon: "community", labelKey: "nav_community" },
  { name: "more", icon: "more", labelKey: "nav_more" },
];

// Tabet që s'kërkojnë profil — një guest mund t'i shohë pa login.
// Të gjitha tabet e tjera kërkojnë profil (varen nga të dhëna personale).
const GUEST_ALLOWED_TABS = new Set(["shop"]);

const TAB_COLORS = {
  light: { background: "#FFFFFF", border: "#E9DFCC", active: "#2C271F", inactive: "#A79D8A" },
  dark: { background: "#211D17", border: "#3A342A", active: "#F7F1E4", inactive: "#9C927E" },
};

const AI_BUTTON_SIZE = 56;
const AI_OVERLAP = 16;

/**
 * Bottom tab bar for the app.
 *
 * Që kur u shtua "Vazhdo te Dyqani pa Login", ky layout s'e bllokon më
 * TËRË app-in kur s'ka session — vetëm redirekton në /login nëse
 * përdoruesi s'ka as session, as e ka zgjedhur guest mode (`canBrowse`).
 * Tabet private (home/baby/community/more) dhe butoni i AI-së gatuhen
 * individualisht më poshtë (`guardTabPress` / `handleAiPress`): një guest
 * shfleton lirshëm te Shop, por çdo tentativë tjetër e çon te
 * "require-account", i cili e kthen te funksioni origjinal pas login-it.
 */
export default function MainLayout() {
  const { t } = useTranslation();
  const { state } = useAppState();
  const { loading, isAuthenticated, isGuest } = useOnboardingStatus();
  const insets = useSafeAreaInsets();

  const canBrowse = isAuthenticated || isGuest;

  useEffect(() => {
    if (!loading && !canBrowse) {
      router.replace("/(auth)/login");
    }
  }, [loading, canBrowse]);

  if (loading || !canBrowse) return null;

  const colors = state.darkMode ? TAB_COLORS.dark : TAB_COLORS.light;
  const tabBarHeight = 58 + insets.bottom;
  const tabBarPaddingBottom = Math.max(insets.bottom, 10);

  function guardTabPress(tabName: string, e: { preventDefault: () => void }) {
    if (isAuthenticated || GUEST_ALLOWED_TABS.has(tabName)) return;
    e.preventDefault();
    router.push({
      pathname: "/(auth)/require-account",
      params: { redirect: `/(main)/${tabName}` },
    });
  }

  function handleAiPress() {
    if (!isAuthenticated) {
      router.push({ pathname: "/(auth)/require-account", params: { redirect: "/ai-chat" } });
      return;
    }
    router.push("/ai-chat");
  }

  return (
    <View style={{ flex: 1 }}>
      <Tabs
        initialRouteName={isAuthenticated ? "home" : "shop"}
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.active,
          tabBarInactiveTintColor: colors.inactive,
          tabBarStyle: {
            backgroundColor: colors.background,
            borderTopColor: colors.border,
            borderTopWidth: 1,
            height: tabBarHeight,
            paddingTop: 8,
            paddingBottom: tabBarPaddingBottom,
          },
          tabBarLabelStyle: { fontSize: 10.5, fontFamily: "Inter_500Medium", includeFontPadding: false },
        }}
      >
        {TABS.map((tab) => (
          <Tabs.Screen
            key={tab.name}
            name={tab.name}
            options={{
              title: t(tab.labelKey),
              tabBarIcon: ({ color, focused }) => (
                <Icon name={tab.icon} size={22} color={focused ? colors.active : color} />
              ),
            }}
            listeners={{
              tabPress: (e) => guardTabPress(tab.name, e),
            }}
          />
        ))}

        <Tabs.Screen name="ai-chat" options={{ href: null }} />
      </Tabs>

      <Pressable
        onPress={handleAiPress}
        style={[
          shadows.softLg,
          {
            position: "absolute",
            bottom: tabBarHeight - AI_OVERLAP,
            left: "50%",
            marginLeft: -AI_BUTTON_SIZE / 2,
            width: AI_BUTTON_SIZE,
            height: AI_BUTTON_SIZE,
            borderRadius: AI_BUTTON_SIZE / 2,
            borderWidth: 4,
            borderColor: colors.background,
          },
        ]}
        className="bg-olive items-center justify-center"
      >
        <Icon name="sparkle" size={24} color="#FFFFFF" />
      </Pressable>
    </View>
  );
}