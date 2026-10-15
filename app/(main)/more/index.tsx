import { useEffect, useMemo, useState } from "react";
import { View, Text, ScrollView, Pressable, Image, Alert, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Constants from "expo-constants";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  Baby, Bell, Bookmark, ChevronRight, FileText, Gift, Globe, Heart, Info, LifeBuoy, LogOut, MoonStar, Package, Search, Sparkles,
  Stethoscope, SunMoon, Trash, UserRound, Users, X, type LucideIcon,
} from "lucide-react-native";
import { useAppState } from "@/lib/state/AppStateContext";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { shadows } from "@/lib/shadows";
import { haptics } from "@/lib/haptics";
import { supabase } from "@/lib/supabase/client";
import { useAuthUser } from "@/lib/hooks/useAuthUser";
import { useThemeColors } from "@/lib/theme/useThemeColors";
import { unregisterPushToken } from "@/lib/notifications";
import { GIFTS_ENABLED } from "@/lib/gifts/enabled";
import { setNightOverride, useNightMode } from "@/lib/baby/nightMode";
import { computeAgeText } from "@/lib/dateUtils";
import { WHATS_NEW_KEY, WHATS_NEW_VERSION } from "@/lib/whatsNew";
import { searchSettings } from "@/lib/settings/search";

type Row = {
  key: string;
  /** Ikona (Lucide) dhe ngjyra e pllakës së saj, si te Cilësimet e iPhone-it. */
  icon: LucideIcon;
  color: string;
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

type Section = { key: string; title: string; rows: Row[] };

/** Ngjyrat e pllakave të ikonave: paleta e sistemit të Apple-it, e njohur dhe e lexueshme në të dyja temat. */
const C = {
  red: "#FF3B30",
  orange: "#FF9500",
  pink: "#FF2D55",
  purple: "#AF52DE",
  indigo: "#5856D6",
  blue: "#007AFF",
  teal: "#30B0C7",
  green: "#34C759",
  gray: "#8E8E93",
} as const;

/** Pllaka e ikonës: katror i rrumbullakosur me ngjyrë, ikonë e bardhë (si te iPhone). */
function IconTile({ icon: Glyph, color, size = 30 }: { icon: LucideIcon; color: string; size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.26, backgroundColor: color, alignItems: "center", justifyContent: "center" }}>
      <Glyph size={size * 0.58} color="#FFFFFF" strokeWidth={2.2} />
    </View>
  );
}

/** Një rresht: ikona me ngjyrë, emri, vlera aktuale dhe shigjeta. Zonë prekjeje ≥ 52pt. */
function SettingsRow({ row, last, subtitle }: { row: Row; last: boolean; subtitle?: string }) {
  const theme = useThemeColors();
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
      <View className="mr-3.5">
        <IconTile icon={row.icon} color={row.color} />
      </View>
      <View className={`flex-1 flex-row items-center self-stretch pr-3 ${last ? "" : "border-b border-cream-line"}`} style={{ minHeight: 52 }}>
        <View className="flex-1 py-2">
          <Text className="font-bodyMedium text-[15.5px] text-ink" style={row.destructive ? { color: C.red } : undefined}>
            {row.label}
          </Text>
          {subtitle ? <Text className="mt-0.5 font-body text-xs text-ink-faint">{subtitle}</Text> : null}
        </View>
        {row.fresh ? <View className="mr-2 h-2 w-2 rounded-full" style={{ backgroundColor: C.red }} /> : null}
        {row.badge ? <Text className="mr-1 font-body text-[14px] text-ink-faint">{row.badge}</Text> : null}
        {row.destructive ? null : <ChevronRight size={18} color={theme.inkFaint} strokeWidth={2} />}
      </View>
    </Pressable>
  );
}

function SectionCard({ section }: { section: Section }) {
  return (
    <View className="mb-6">
      <Text accessibilityRole="header" className="mb-2 px-6 font-bodyMedium text-[12.5px] uppercase text-ink-faint">
        {section.title}
      </Text>
      <View className="mx-4 overflow-hidden rounded-2xl bg-surface" style={shadows.soft}>
        {section.rows.map((r, i) => (
          <SettingsRow key={r.key} row={r} last={i === section.rows.length - 1} />
        ))}
      </View>
    </View>
  );
}

/**
 * Pllaka e qendrës së kontrollit (si te iPhone): katror; rrethi me ikonën merr ngjyrë kur është ndezur; poshtë
 * emri dhe gjendja. Ndërron pa hapur faqe.
 */
function ControlTile({
  icon: Glyph,
  text,
  label,
  value,
  on,
  color,
  role,
  onPress,
}: {
  icon?: LucideIcon;
  text?: string;
  label: string;
  value: string;
  on: boolean;
  color: string;
  role: "switch" | "button";
  onPress: () => void;
}) {
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
      style={({ pressed }) => [shadows.soft, { flex: 1, aspectRatio: 1, transform: [{ scale: pressed ? 0.96 : 1 }] }]}
      className="justify-between rounded-[22px] bg-surface p-3.5"
    >
      <View style={{ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: on ? color : theme.creamSoft }}>
        {Glyph ? (
          <Glyph size={21} color={on ? "#FFFFFF" : theme.ink} strokeWidth={2.2} />
        ) : (
          <Text style={{ color: on ? "#FFFFFF" : theme.ink, fontSize: 14, fontFamily: "Inter_700Bold" }}>{text}</Text>
        )}
      </View>
      <View>
        <Text numberOfLines={1} className="font-bodySemibold text-[13.5px] text-ink">
          {label}
        </Text>
        <Text numberOfLines={1} className="mt-0.5 font-body text-xs text-ink-faint">
          {value}
        </Text>
      </View>
    </Pressable>
  );
}

/**
 * Cilësimet, si te iPhone: titulli dhe kërkimi lart, profili, qendra e kontrollit (tema, modaliteti i natës,
 * gjuha) dhe rubrikat me ikona me ngjyrë. Llogaria (dalja, fshirja) rri e ndarë në fund, që të gjendet lehtë por
 * të mos preket gabimisht. Kërkimi gjen edhe pa "ë/ç" dhe me fjalë të afërta.
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
        rows: [
          { key: "orders", icon: Package, color: C.orange, label: t("my_orders"), keywords: "porosi blerje dyqan orders shop", onPress: () => router.push("/shop/orders", { withAnchor: true }) },
          { key: "wishlist", icon: Heart, color: C.pink, label: t("saved_products"), keywords: "produkte pelqyera wishlist", onPress: () => router.push("/shop/wishlist", { withAnchor: true }) },
          ...(GIFTS_ENABLED
            ? [{ key: "gifts", icon: Gift, color: C.purple, label: t("gift_title"), keywords: "dhurata lista gifts registry", onPress: () => router.push("/more/gifts") }]
            : []),
          { key: "posts", icon: Bookmark, color: C.teal, label: t("saved_posts"), keywords: "postime komuniteti posts", onPress: () => router.push("/community/saved", { withAnchor: true }) },
        ],
      },
      {
        key: "prefs",
        title: t("section_prefs"),
        rows: [
          { key: "notifications", icon: Bell, color: C.red, label: t("notifications"), keywords: "njoftime kujtesa ore te qeta push reminders quiet", onPress: () => router.push("/more/notifications") },
          {
            key: "appearance",
            icon: SunMoon,
            color: C.blue,
            label: t("appearance"),
            keywords: "tema erret celet dark light theme",
            badge: state.darkMode ? t("appearance_dark") : t("appearance_light"),
            onPress: () => router.push("/more/appearance"),
          },
          {
            key: "night",
            icon: MoonStar,
            color: C.indigo,
            label: t("night_title"),
            keywords: "nate hene kuqe drite gjume ndricimi night red light",
            badge: night.prefs.auto ? t("night_on") : t("night_off"),
            onPress: () => router.push("/more/night-mode"),
          },
          {
            key: "language",
            icon: Globe,
            color: C.gray,
            label: t("language"),
            keywords: "gjuha shqip anglisht language english albanian",
            badge: language === "sq" ? t("language_sq") : t("language_en"),
            onPress: () => router.push("/more/language"),
          },
          { key: "family", icon: Users, color: C.green, label: t("family_title"), keywords: "partneri gjyshrit ftese anetare family invite", onPress: () => router.push("/more/family") },
        ],
      },
      {
        key: "help",
        title: t("section_help"),
        rows: [
          { key: "whatsnew", icon: Sparkles, color: C.orange, label: t("wn_title"), keywords: "te reja perditesim whats new", fresh: !whatsNewSeen, onPress: () => router.push("/more/whats-new") },
          { key: "help", icon: LifeBuoy, color: C.blue, label: t("help_center"), keywords: "ndihme pyetje kontakt email help support", onPress: () => router.push("/more/help") },
          { key: "about", icon: Info, color: C.gray, label: t("about_bebix"), keywords: "rreth versioni about", onPress: () => router.push("/more/about") },
          { key: "legal", icon: FileText, color: C.gray, label: t("legal"), keywords: "privatesia kushtet ligjore privacy terms", onPress: () => router.push("/more/legal") },
        ],
      },
      {
        key: "account",
        title: t("section_account"),
        rows: [
          { key: "logout", icon: LogOut, color: C.gray, label: t("logout"), keywords: "dil dalje logout sign out", onPress: logout },
          // Mysafiri s'ka llogari për të fshirë. Fshirja duhet të jetë e gjetshme, jo e fshehur (Google Play).
          ...(provider
            ? [{ key: "delete", icon: Trash, color: C.red, label: t("delete_account"), keywords: "fshi llogarine delete account", destructive: true, onPress: () => router.push("/more/delete-account") }]
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
        <Text accessibilityRole="header" className="mb-3 mt-2 px-5 font-display text-3xl text-ink">
          {t("nav_more")}
        </Text>

        {/* Kërkimi: gjen edhe pa "ë/ç" dhe me fjalë të afërta. */}
        <View className="mx-4 mb-5 flex-row items-center rounded-xl bg-surface px-3.5" style={[shadows.soft, { minHeight: 44 }]}>
          <Search size={17} color={theme.inkFaint} strokeWidth={2.2} />
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
              <X size={13} color={theme.inkSoft} strokeWidth={2.4} />
            </Pressable>
          ) : null}
        </View>

        {searching ? (
          results.length ? (
            <View className="mx-4 mb-6 overflow-hidden rounded-2xl bg-surface" style={shadows.soft}>
              {results.map((r, i) => (
                <SettingsRow key={r.key} row={r} last={i === results.length - 1} subtitle={r.section.title} />
              ))}
            </View>
          ) : (
            <View className="mx-4 items-center rounded-2xl bg-surface px-6 py-8" style={shadows.soft}>
              <Search size={22} color={theme.inkFaint} strokeWidth={2} />
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
              style={({ pressed }) => [shadows.soft, { opacity: pressed ? 0.9 : 1 }]}
              className="mx-4 mb-5 flex-row items-center rounded-2xl bg-surface p-4"
            >
              <View className="mr-4 h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-olive-bg">
                {profile.parentPhoto ? <Image source={{ uri: profile.parentPhoto }} className="h-16 w-16" /> : <UserRound size={28} color={theme.olive} strokeWidth={2} />}
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
                    <Baby size={13} color={theme.olive} strokeWidth={2.2} />
                    <Text className="ml-1.5 font-bodyMedium text-xs text-olive" numberOfLines={1}>
                      {babyAge ? `${babyName} · ${babyAge}` : babyName}
                    </Text>
                  </View>
                ) : null}
              </View>
              <ChevronRight size={18} color={theme.inkFaint} strokeWidth={2} />
            </Pressable>

            {/* Qendra e kontrollit: tema, modaliteti i natës, gjuha. */}
            <View className="mx-4 mb-6 flex-row" style={{ gap: 12 }}>
              <ControlTile
                icon={SunMoon}
                label={t("appearance")}
                value={state.darkMode ? t("appearance_dark") : t("appearance_light")}
                on={state.darkMode}
                color={C.indigo}
                role="switch"
                onPress={() => setDarkMode(!state.darkMode)}
              />
              {/* Modaliteti i natës ndizet menjëherë dhe hapet (më parë ndërronte vetëm orarin 22–06, ndaj ditën
                  dukej sikur s'bënte asgjë). */}
              <ControlTile
                icon={MoonStar}
                label={t("night_title")}
                value={night.active ? t("night_on") : t("night_off")}
                on={night.active}
                color={C.orange}
                role="switch"
                onPress={() => {
                  if (night.active) {
                    setNightOverride("off");
                    return;
                  }
                  setNightOverride("on");
                  router.navigate("/(main)/baby");
                }}
              />
              <ControlTile
                text={language === "sq" ? "SQ" : "EN"}
                label={t("language")}
                value={language === "sq" ? t("language_sq") : t("language_en")}
                on
                color={C.blue}
                role="button"
                onPress={() => setLanguage(language === "sq" ? "en" : "sq")}
              />
            </View>

            {sections.slice(0, 3).map((s) => (
              <SectionCard key={s.key} section={s} />
            ))}

            {/* Ftesa për ekspertët: kartë më vete, që të lexohet si ftesë, jo si rresht menyje. */}
            <Pressable
              onPress={() => router.push("/more/doctor-registration")}
              accessibilityRole="button"
              accessibilityLabel={`${t("expert_cta_title")} ${t("expert_cta_sub")}`}
              style={({ pressed }) => [shadows.soft, { opacity: pressed ? 0.9 : 1 }]}
              className="mx-4 mb-6 flex-row items-center rounded-2xl bg-surface p-4"
            >
              <View className="mr-3.5">
                <IconTile icon={Stethoscope} color={C.teal} size={40} />
              </View>
              <View className="flex-1">
                <Text className="font-bodySemibold text-sm text-ink">{t("expert_cta_title")}</Text>
                <Text className="mt-0.5 font-body text-xs text-ink-soft">{t("expert_cta_sub")}</Text>
              </View>
              <ChevronRight size={18} color={theme.inkFaint} strokeWidth={2} />
            </Pressable>

            {/* Llogaria: e ndarë në fund, që të gjendet lehtë por të mos preket gabimisht. */}
            <SectionCard section={sections[3]} />

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
