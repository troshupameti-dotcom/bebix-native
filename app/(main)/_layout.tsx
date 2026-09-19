import { useEffect, useRef } from "react";
import { Tabs, router } from "expo-router";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon, IconName } from "@/components/ui/Icon";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { TranslationKey } from "@/lib/i18n/translations";
import { useOnboardingStatus } from "@/lib/hooks/useOnboardingStatus";
import { useThemeColors } from "@/lib/theme/useThemeColors";
import { registerForPushNotificationsAsync } from "@/lib/notifications";
import { useBabyRecordsSync } from "@/lib/hooks/useBabyRecordsSync";

// AI-ja rri ne mes: aty ku ishte butoni rrethor, pra duart e mesuara e
// gjejne ne te njejtin vend, dhe eshte pika me e arritshme me gisht.
const TABS: { name: string; icon: IconName; labelKey: TranslationKey }[] = [
  { name: "baby", icon: "baby", labelKey: "nav_baby" },
  { name: "shop", icon: "shop", labelKey: "nav_shop" },
  { name: "ai-chat", icon: "sparkle", labelKey: "nav_ai" },
  { name: "community", icon: "community", labelKey: "nav_community" },
  { name: "more", icon: "more", labelKey: "nav_more" },
];

// Tabet që s'kërkojnë profil — një guest mund t'i shohë pa login.
// Të gjitha tabet e tjera kërkojnë profil (varen nga të dhëna personale).
const GUEST_ALLOWED_TABS = new Set(["shop"]);



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
  const { loading, isAuthenticated, isGuest } = useOnboardingStatus();
  const theme = useThemeColors();
  const insets = useSafeAreaInsets();

  const canBrowse = isAuthenticated || isGuest;

  useEffect(() => {
    if (!loading && !canBrowse) {
      router.replace("/(auth)/login");
    }
  }, [loading, canBrowse]);

  // Historiku i baby-t sinkronizohet me Supabase (offline-first: AsyncStorage
  // mbetet burimi per UI-n, sync-u punon ne sfond).
  useBabyRecordsSync(isAuthenticated);

  // Push token merret vetem per perdorues te kycur (jo per guest-at) dhe
  // vetem nje here per session — ref-i e ndal perseritjen ne re-render.
  const pushRegistered = useRef(false);
  useEffect(() => {
    if (!isAuthenticated) {
      // Dalje nga llogaria: lejo regjistrimin perseri per perdoruesin e radhes.
      pushRegistered.current = false;
      return;
    }
    if (pushRegistered.current) return;
    pushRegistered.current = true;

    registerForPushNotificationsAsync().catch((e) => {
      console.log("Regjistrimi i push notifications deshtoi:", e);
    });
  }, [isAuthenticated]);

  if (loading || !canBrowse) return null;

  const colors = {
    background: theme.surface,
    border: theme.creamLine,
    active: theme.ink,
    inactive: theme.inkFaint,
  };
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


  return (
    <View style={{ flex: 1 }}>
      <Tabs
        initialRouteName={isAuthenticated ? "baby" : "shop"}
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
                // react-navigation e tipizon color si ColorValue; ne praktike
                // vjen nga paleta, pra string hex.
                <Icon name={tab.icon} size={22} color={focused ? colors.active : (color as string)} />
              ),
            }}
            listeners={{
              tabPress: (e) => guardTabPress(tab.name, e),
            }}
          />
        ))}

        <Tabs.Screen name="notifications" options={{ href: null }} />
      </Tabs>

    </View>
  );
}