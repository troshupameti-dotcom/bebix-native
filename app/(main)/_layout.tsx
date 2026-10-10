import { log } from "@/lib/log";
import { useEffect, useRef, useState } from "react";
import { Tabs, router, usePathname } from "expo-router";
import { BackHandler, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon, IconName } from "@/components/ui/Icon";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { TranslationKey } from "@/lib/i18n/translations";
import { useOnboardingStatus } from "@/lib/hooks/useOnboardingStatus";
import { useThemeColors } from "@/lib/theme/useThemeColors";
import { listenForNotificationOpens, registerForPushNotificationsAsync, syncWeeklyRecapReminder } from "@/lib/notifications";
import { isNotificationEnabled } from "@/lib/notifications/catalog";
import { useAppState } from "@/lib/state/AppStateContext";
import { saveMyMemberProfile } from "@/lib/baby/household";
import { relationFromProfile } from "@/lib/baby/team";
import { useHouseholdRole } from "@/lib/hooks/useHouseholdRole";
import { routeForNotification } from "@/lib/notifications/routing";
import { useBabyRecordsSync } from "@/lib/hooks/useBabyRecordsSync";

// AI-ja rri ne mes: aty ku ishte butoni rrethor, pra duart e mesuara e
// gjejne ne te njejtin vend, dhe eshte pika me e arritshme me gisht.
const TABS: { name: string; icon: IconName; labelKey: TranslationKey }[] = [
  { name: "baby", icon: "baby", labelKey: "nav_baby" },
  { name: "shop", icon: "shop", labelKey: "nav_shop" },
  { name: "ai-chat", icon: "sparkle", labelKey: "nav_ai" },
  { name: "community", icon: "community", labelKey: "nav_community" },
  { name: "more", icon: "settings", labelKey: "nav_more" },
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
  const { t, lang } = useTranslation();
  const { loading, isAuthenticated, isGuest } = useOnboardingStatus();
  const theme = useThemeColors();
  const insets = useSafeAreaInsets();

  const canBrowse = isAuthenticated || isGuest;

  useEffect(() => {
    if (!loading && !canBrowse) {
      router.replace("/(auth)/login");
    }
  }, [loading, canBrowse]);

  // Mysafiri në faqen kryesore të Dyqanit: "prapa" e çon te hyrja (ku mund të
  // hyjë ose të regjistrohet), jo te Bebi dhe as jashtë app-it.
  const pathname = usePathname();
  useEffect(() => {
    if (isAuthenticated || !isGuest || pathname !== "/shop") return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      router.replace("/(auth)/login");
      return true;
    });
    return () => sub.remove();
  }, [isAuthenticated, isGuest, pathname]);

  // Historiku i baby-t sinkronizohet me Supabase (offline-first: AsyncStorage
  // mbetet burimi per UI-n, sync-u punon ne sfond).
  useBabyRecordsSync(isAuthenticated);

  // Push token merret vetem per perdorues te kycur (jo per guest-at) dhe
  // vetem nje here per session — ref-i e ndal perseritjen ne re-render.
  const pushRegistered = useRef(false);
  // Leja e njoftimeve vjen pas regjistrimit: atëherë planifikohet edhe përmbledhja e javës.
  const [pushReady, setPushReady] = useState(false);
  useEffect(() => {
    if (!isAuthenticated) {
      // Dalje nga llogaria: lejo regjistrimin perseri per perdoruesin e radhes.
      pushRegistered.current = false;
      return;
    }
    if (pushRegistered.current) return;
    pushRegistered.current = true;

    registerForPushNotificationsAsync()
      .then(() => setPushReady(true))
      .catch((e) => {
        log("Regjistrimi i push notifications deshtoi:", e);
      });
  }, [isAuthenticated]);

  // Përmbledhja e së hënës: planifikohet pas lejes së push-it, hiqet kur fiket ose del nga llogaria.
  const { state } = useAppState();
  const weeklyOn = isAuthenticated && isNotificationEnabled(state.notificationPrefs, "baby_weekly");
  const babyName = state.profile.babyName?.trim() || null;
  const weeklyTitle = babyName ? t("weekly_push_title", { name: babyName }) : t("weekly_push_title_plain");
  const weeklyBody = t("weekly_push_body");
  useEffect(() => {
    void syncWeeklyRecapReminder({ enabled: weeklyOn, title: weeklyTitle, body: weeklyBody });
  }, [weeklyOn, weeklyTitle, weeklyBody, pushReady]);

  // Emri, lidhja dhe gjuha ime te familja: partneri sheh "Mami" te "Ekipi sot"
  // dhe njoftimet e tij për mua vijnë në gjuhën time.
  const role = useHouseholdRole();
  const parentName = state.profile.parentName ?? null;
  const relation = relationFromProfile(state.profile.relation, role);
  useEffect(() => {
    if (!isAuthenticated) return;
    void saveMyMemberProfile({ displayName: parentName, relation, lang }).catch(() => {});
  }, [isAuthenticated, parentName, relation, lang]);

  // Prekja e një njoftimi hap ekranin që i përket (postimi, porosia, ushqyerja...).
  useEffect(() => {
    if (!isAuthenticated) return;
    return listenForNotificationOpens((data) => {
      const route = routeForNotification(data);
      if (route) router.push(route as never);
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
        // Mysafiri s'ka tab-e të tjera: "prapa" nga Dyqani s'duhet ta çojë te Bebi.
        backBehavior={isAuthenticated ? "firstRoute" : "none"}
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