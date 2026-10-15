import { useEffect, useMemo, useState } from "react";
import { View, Text, ScrollView, Pressable, Image, Alert, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Constants from "expo-constants";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAppState } from "@/lib/state/AppStateContext";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { Icon, IconName } from "@/components/ui/Icon";
import { shadows } from "@/lib/shadows";
import { haptics } from "@/lib/haptics";
import { supabase } from "@/lib/supabase/client";
import { useAuthUser } from "@/lib/hooks/useAuthUser";
import { useThemeColors } from "@/lib/theme/useThemeColors";
import { unregisterPushToken } from "@/lib/notifications";
import { GIFTS_ENABLED } from "@/lib/gifts/enabled";
import { setNightAuto, useNightMode } from "@/lib/baby/nightMode";
import { computeAgeText } from "@/lib/dateUtils";
import { WHATS_NEW_KEY, WHATS_NEW_VERSION } from "@/lib/whatsNew";
import { searchSettings } from "@/lib/settings/search";

/** Ngjyra e pllakës së ikonës sipas rubrikës: që rubrikat të dallohen me një shikim. */
type Tint = "orange" | "olive" | "neutral";
const TINT_BG: Record<Tint, string> = { orange: "bg-orange-bg", olive: "bg-olive-bg", neutral: "bg-cream-soft" };

type Row = {
  key: string;
  icon: IconName;
  label: string;
  onPress: () => void;
  badge?: string;
  /** Fjalë të afërta për kërkimin (s'shfaqen), shqip dhe anglisht. */
  keywords?: string;
  /** Veprim që s'kthehet mbrapa (fshirja): me ngjyrën e paralajmërimit. */
  destructive?: boolean;
  /** Pika e vogël "e re" (p.sh. "Çfarë ka të re" ende pa u parë). */
  fresh?: boolean;
};

type Section = { key: string; title: string; tint: Tint; rows: Row[] };

/** Një rresht: ikona me ngjyrën e rubrikës, emri, vlera aktuale dhe shigjeta. Zonë prekjeje ≥ 52pt. */
function SettingsRow({ row, tint, last, subtitle }: { row: Row; tint: Tint; last: boolean; subtitle?: string }) {
  const theme = useThemeColors();
  const tone = row.destructive ? theme.orange : tint === "orange" ? theme.orange : tint === "olive" ? theme.olive : theme.inkSoft;
  return (
    <Pressable
      onPress={() => {
        haptics.tap();
        row.onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={[row.label, row.badge, subtitle].filter(Boolean).join(", ")}
      style={({ pressed }) => ({ minHeight: 52, backgroundColor: pressed ? theme.creamSoft : "transparent" })}
      className="flex-row items-center pl-4"
    >
      <View className={`mr-3 h-8 w-8 items-center justify-center rounded-full ${row.destructive ? "bg-orange-bg" : TINT_BG[tint]}`}>
        <Icon name={row.icon} size={16} color={tone} />
      </View>
      <View className={`flex-1 flex-row items-center self-stretch pr-4 ${last ? "" : "border-b border-cream-line"}`} style={{ minHeight: 52 }}>
        <View className="flex-1 py-2">
          <Text className={`font-bodyMedium text-[15px] ${row.destructive ? "text-orange" : "text-ink"}`}>{row.label}</Text>
          {subtitle ? <Text className="mt-0.5 font-body text-xs text-ink-faint">{subtitle}</Text> : null}
        </View>
        {row.fresh ? <View className="mr-2 h-2 w-2 rounded-full bg-orange" /> : null}
        {row.badge ? <Text className="mr-1.5 font-body text-[13px] text-ink-soft">{row.badge}</Text> : null}
        {row.destructive ? null : <Icon name="chevronRight" size={16} color={theme.inkFaint} />}
      </View>
    </Pressable>
  );
}

function SectionCard({ section }: { section: Section }) {
  return (
    <View className="mb-6">
      <Text accessibilityRole="header" className="mb-2 px-6 font-bodyMedium text-xs uppercase text-ink-faint">
        {section.title}
      </Text>
      <View className="mx-5 overflow-hidden rounded-xl2 bg-surface" style={shadows.soft}>
        {section.rows.map((r, i) => (
          <SettingsRow key={r.key} row={r} tint={section.tint} last={i === section.rows.length - 1} />
        ))}
      </View>
    </View>
  );
}

/**
 * Pllaka e ndërrimit me një prekje (tema, nata, gjuha): tregon gjendjen aktuale dhe e ndërron pa hapur faqe.
 * E ndezur = e mbushur me theksin, që gjendja të shihet pa lexuar.
 */
function QuickTile({ icon, label, value, on, role, onPress }: { icon: IconName; label: string; value: string; on: boolean; role: "switch" | "button"; onPress: () => void }) {
  const theme = useThemeColors();
  return (
    <Pressable
      onPress={() => {
        haptics.select();
        onPress();
      }}
      accessibilityRole={role}
      accessibilityState={role === "switch" ? { checked: on } : undefined}
      accessibilityLabel={`${label}: ${value}`}
      style={({ pressed }) => [shadows.soft, { flex: 1, minHeight: 92, opacity: pressed ? 0.85 : 1 }]}
      className={`rounded-xl2 p-3 ${on ? "bg-olive" : "bg-surface"}`}
    >
      <View className={`mb-2 h-8 w-8 items-center justify-center rounded-full ${on ? "" : "bg-olive-bg"}`}>
        <Icon name={icon} size={16} color={on ? theme.onAccent : theme.olive} />
      </View>
      <Text numberOfLines={1} className={`font-bodyMedium text-xs ${on ? "text-on-accent" : "text-ink-soft"}`}>
        {label}
      </Text>
      <Text numberOfLines={1} className={`mt-0.5 font-bodySemibold text-sm ${on ? "text-on-accent" : "text-ink"}`}>
        {value}
      </Text>
    </Pressable>
  );
}

/**
 * Cilësimet: titulli dhe kërkimi lart, profili, tri ndërrime me një prekje (tema, modaliteti i natës, gjuha),
 * pastaj rubrikat me ikona të dallueshme. Llogaria (dalja, fshirja) rri e ndarë në fund, që të gjendet lehtë
 * por të mos preket gabimisht. Kërkimi gjen edhe pa "ë/ç" dhe me fjalë të afërta.
 */
export default function MoreScreen() {
  const router = useRouter();
  const theme = useThemeColors();
  const { state, setDarkMode } = useAppState();
  const night = useNightMode();
  const { profile } = state;
  const { t, language, setLanguage } = useLanguage();
  const { email, provider } = useAuthUser();
  const [query, setQuery] = useState("");
  const [whatsNewSeen, setWhatsNewSeen] = useState(true);

  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(WHATS_NEW_KEY)
      .then((seen) => alive && setWhatsNewSeen(seen === WHATS_NEW_VERSION))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const babyName = profile.nickname || profile.babyName;
  const babyAge = profile.babyDob ? computeAgeText(profile.babyDob, language) : "";

  function logout() {
    Alert.alert(t("logout_confirm_title"), t("logout_confirm_body"), [
      { text: t("cancel"), style: "cancel" },
      {
        text: t("logout_action"),
        style: "destructive",
        onPress: async () => {
          // Telefoni s'duhet të marrë më njoftimet e kësaj llogarie.
          await unregisterPushToken();
          await supabase.auth.signOut();
          router.replace("/(auth)/login");
        },
      },
    ]);
  }

  const sections: Section[] = useMemo(
    () => [
      {
        key: "saved",
        title: t("section_saved"),
        tint: "orange",
        rows: [
          { key: "orders", icon: "cube", label: t("my_orders"), keywords: "porosi blerje dyqan orders shop", onPress: () => router.push("/shop/orders", { withAnchor: true }) },
          { key: "wishlist", icon: "heart", label: t("saved_products"), keywords: "produkte pelqyera wishlist", onPress: () => router.push("/shop/wishlist", { withAnchor: true }) },
          ...(GIFTS_ENABLED
            ? [{ key: "gifts", icon: "star" as const, label: t("gift_title"), keywords: "dhurata lista gifts registry", onPress: () => router.push("/more/gifts") }]
            : []),
          { key: "posts", icon: "bookmark", label: t("saved_posts"), keywords: "postime komuniteti posts", onPress: () => router.push("/community/saved", { withAnchor: true }) },
        ],
      },
      {
        key: "prefs",
        title: t("section_prefs"),
        tint: "olive",
        rows: [
          { key: "notifications", icon: "bell", label: t("notifications"), keywords: "njoftime kujtesa ore te qeta push reminders quiet", onPress: () => router.push("/more/notifications") },
          {
            key: "appearance",
            icon: "eye",
            label: t("appearance"),
            keywords: "tema erret celet dark light theme",
            badge: state.darkMode ? t("appearance_dark") : t("appearance_light"),
            onPress: () => router.push("/more/appearance"),
          },
          {
            key: "night",
            icon: "moon",
            label: t("night_title"),
            keywords: "nate hene kuqe drite gjume ndricimi night red light",
            badge: night.prefs.auto ? t("night_on") : t("night_off"),
            onPress: () => router.push("/more/night-mode"),
          },
          {
            key: "language",
            icon: "globe",
            label: t("language"),
            keywords: "gjuha shqip anglisht language english albanian",
            badge: language === "sq" ? t("language_sq") : t("language_en"),
            onPress: () => router.push("/more/language"),
          },
        ],
      },
      {
        key: "family",
        title: t("section_family"),
        tint: "neutral",
        rows: [
          { key: "family", icon: "family", label: t("family_title"), keywords: "partneri gjyshrit ftese anetare family invite", onPress: () => router.push("/more/family") },
        ],
      },
      {
        key: "help",
        title: t("section_help"),
        tint: "neutral",
        rows: [
          { key: "whatsnew", icon: "sparkle", label: t("wn_title"), keywords: "te reja perditesim whats new", fresh: !whatsNewSeen, onPress: () => router.push("/more/whats-new") },
          { key: "help", icon: "comment", label: t("help_center"), keywords: "ndihme pyetje kontakt email help support", onPress: () => router.push("/more/help") },
          { key: "about", icon: "baby", label: t("about_bebix"), keywords: "rreth versioni about", onPress: () => router.push("/more/about") },
          { key: "legal", icon: "lock", label: t("legal"), keywords: "privatesia kushtet ligjore privacy terms", onPress: () => router.push("/more/legal") },
        ],
      },
      {
        key: "account",
        title: t("section_account"),
        tint: "neutral",
        rows: [
          { key: "logout", icon: "logout", label: t("logout"), keywords: "dil dalje logout sign out", onPress: logout },
          // Mysafiri s'ka llogari për të fshirë. Fshirja duhet të jetë e gjetshme, jo e fshehur (Google Play).
          ...(provider
            ? [{ key: "delete", icon: "trash" as const, label: t("delete_account"), keywords: "fshi llogarine delete account", destructive: true, onPress: () => router.push("/more/delete-account") }]
            : []),
        ],
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, language, state.darkMode, night.prefs.auto, provider, whatsNewSeen]
  );

  const results = useMemo(
    () => searchSettings(sections.flatMap((s) => s.rows.map((row) => ({ ...row, section: s }))), query),
    [sections, query]
  );
  const searching = query.trim().length > 0;

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 40 }}>
        <Text accessibilityRole="header" className="mb-3 mt-2 px-6 font-display text-3xl text-ink">
          {t("nav_more")}
        </Text>

        {/* Kërkimi: gjen edhe pa "ë/ç" dhe me fjalë të afërta. */}
        <View className="mx-5 mb-5 flex-row items-center rounded-full bg-surface px-4" style={[shadows.soft, { minHeight: 46 }]}>
          <Icon name="search" size={16} color={theme.inkFaint} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t("settings_search_ph")}
            placeholderTextColor={theme.inkFaint}
            accessibilityLabel={t("settings_search_ph")}
            returnKeyType="search"
            autoCorrect={false}
            className="ml-2.5 flex-1 font-body text-[15px] text-ink"
            style={{ paddingVertical: 10 }}
          />
          {searching ? (
            <Pressable onPress={() => setQuery("")} hitSlop={10} accessibilityRole="button" accessibilityLabel={t("a11y_close")} className="h-7 w-7 items-center justify-center rounded-full bg-cream-soft">
              <Icon name="close" size={12} color={theme.inkSoft} />
            </Pressable>
          ) : null}
        </View>

        {searching ? (
          results.length ? (
            <View className="mx-5 mb-6 overflow-hidden rounded-xl2 bg-surface" style={shadows.soft}>
              {results.map((r, i) => (
                <SettingsRow key={r.key} row={r} tint={r.section.tint} last={i === results.length - 1} subtitle={r.section.title} />
              ))}
            </View>
          ) : (
            <View className="mx-5 items-center rounded-xl2 bg-surface px-6 py-8" style={shadows.soft}>
              <Icon name="search" size={22} color={theme.inkFaint} />
              <Text className="mt-3 text-center font-body text-sm leading-5 text-ink-soft">{t("settings_no_results", { q: query.trim() })}</Text>
            </View>
          )
        ) : (
          <>
            {/* Profili: emri, email-i dhe bebi me moshën. */}
            <Pressable
              onPress={() => router.push("/more/profile")}
              accessibilityRole="button"
              accessibilityLabel={`${profile.parentName || t("add_your_name")}, ${t("profile_hint")}`}
              style={({ pressed }) => [shadows.softLg, { opacity: pressed ? 0.9 : 1 }]}
              className="mx-5 mb-4 flex-row items-center rounded-xl3 bg-surface p-4"
            >
              <View className="mr-4 h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-olive-bg">
                {profile.parentPhoto ? <Image source={{ uri: profile.parentPhoto }} className="h-16 w-16" /> : <Icon name="user" size={26} color={theme.olive} />}
              </View>
              <View className="flex-1">
                <Text className="font-bodySemibold text-[17px] text-ink" numberOfLines={1}>
                  {profile.parentName || t("add_your_name")}
                </Text>
                <Text className="mt-0.5 font-body text-xs text-ink-soft" numberOfLines={1}>
                  {email ?? t("profile_hint")}
                </Text>
                {babyName ? (
                  <View className="mt-2 flex-row items-center self-start rounded-full bg-olive-bg px-2.5 py-1">
                    <Icon name="baby" size={12} color={theme.olive} />
                    <Text className="ml-1.5 font-bodyMedium text-xs text-olive" numberOfLines={1}>
                      {babyAge ? `${babyName} · ${babyAge}` : babyName}
                    </Text>
                  </View>
                ) : null}
              </View>
              <Icon name="chevronRight" size={18} color={theme.inkFaint} />
            </Pressable>

            {/* Me një prekje: tema, modaliteti i natës, gjuha. */}
            <Text accessibilityRole="header" className="mb-2 px-6 font-bodyMedium text-xs uppercase text-ink-faint">
              {t("settings_quick")}
            </Text>
            <View className="mx-5 mb-6 flex-row" style={{ gap: 10 }}>
              <QuickTile
                icon="eye"
                label={t("appearance")}
                value={state.darkMode ? t("appearance_dark") : t("appearance_light")}
                on={state.darkMode}
                role="switch"
                onPress={() => setDarkMode(!state.darkMode)}
              />
              <QuickTile
                icon="moon"
                label={t("settings_quick_night")}
                value={night.prefs.auto ? t("night_on") : t("night_off")}
                on={night.prefs.auto}
                role="switch"
                onPress={() => setNightAuto(!night.prefs.auto)}
              />
              <QuickTile
                icon="globe"
                label={t("language")}
                value={language === "sq" ? t("language_sq") : t("language_en")}
                on={false}
                role="button"
                onPress={() => setLanguage(language === "sq" ? "en" : "sq")}
              />
            </View>

            {sections.slice(0, 4).map((s) => (
              <SectionCard key={s.key} section={s} />
            ))}

            {/* Ftesa për ekspertët: kartë më vete, që të lexohet si ftesë, jo si rresht menyje. */}
            <Pressable
              onPress={() => router.push("/more/doctor-registration")}
              accessibilityRole="button"
              accessibilityLabel={`${t("expert_cta_title")} ${t("expert_cta_sub")}`}
              style={({ pressed }) => [shadows.soft, { opacity: pressed ? 0.9 : 1 }]}
              className="mx-5 mb-6 flex-row items-center rounded-xl2 bg-olive-bg p-4"
            >
              <View className="mr-3 h-10 w-10 items-center justify-center rounded-full bg-surface">
                <Icon name="plus" size={18} color={theme.olive} />
              </View>
              <View className="flex-1">
                <Text className="font-bodySemibold text-sm text-ink">{t("expert_cta_title")}</Text>
                <Text className="mt-0.5 font-body text-xs text-ink-soft">{t("expert_cta_sub")}</Text>
              </View>
              <Icon name="chevronRight" size={16} color={theme.olive} />
            </Pressable>

            {/* Llogaria: e ndarë në fund, që të gjendet lehtë por të mos preket gabimisht. */}
            <SectionCard section={sections[4]} />

            <Text className="mt-2 text-center font-body text-[11px] text-ink-faint">
              {/* Nga app.json, që të mos mbetet "1.0.0" pas çdo publikimi. */}
              Bebix v{Constants.expoConfig?.version ?? "1.0.0"}
            </Text>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
