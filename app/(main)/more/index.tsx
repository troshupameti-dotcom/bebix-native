import { View, Text, ScrollView, Pressable, Image, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Constants from "expo-constants";
import { useAppState } from "@/lib/state/AppStateContext";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { Icon, IconName } from "@/components/ui/Icon";
import { shadows } from "@/lib/shadows";
import { supabase } from "@/lib/supabase/client";
import { useAuthUser } from "@/lib/hooks/useAuthUser";

type Row = {
  icon: IconName;
  label: string;
  onPress: () => void;
  badge?: string;
};

function Section({ title, rows }: { title: string; rows: Row[] }) {
  return (
    <View className="mb-6">
      <Text className="font-bodyMedium text-xs text-ink-faint uppercase px-5 mb-2">{title}</Text>
      <View className="mx-5 bg-surface rounded-xl2 overflow-hidden" style={shadows.soft}>
        {rows.map((r, i) => (
          <Pressable
            key={r.label}
            onPress={r.onPress}
            className={`flex-row items-center px-4 py-3.5 ${i < rows.length - 1 ? "border-b border-cream-line" : ""}`}
          >
            <View className="w-8 h-8 rounded-full bg-cream-soft items-center justify-center mr-3">
              <Icon name={r.icon} size={16} color="#6E7452" />
            </View>
            <Text className="font-bodyMedium text-sm text-ink flex-1">{r.label}</Text>
            {r.badge && (
              <View className="bg-cream-soft rounded-full px-2 py-0.5 mr-2">
                <Text className="font-bodySemibold text-[10px] text-ink-faint">{r.badge}</Text>
              </View>
            )}
            <Icon name="chevronRight" size={16} color="#A79D8A" />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export default function MoreScreen() {
  const router = useRouter();
  const { state } = useAppState();
  const { profile } = state;
  const { t, language } = useLanguage();
  const { email } = useAuthUser();

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Profile — Meti only, no stats */}
        <Pressable
          onPress={() => router.push("/more/profile")}
          style={shadows.softLg}
          className="mx-5 mt-2 bg-surface rounded-xl3 p-4 flex-row items-center mb-6"
        >
          <View className="w-14 h-14 rounded-full bg-olive-bg items-center justify-center overflow-hidden mr-4">
            {profile.parentPhoto ? (
              <Image source={{ uri: profile.parentPhoto }} className="w-14 h-14" />
            ) : (
              <Icon name="family" size={24} color="#6E7452" />
            )}
          </View>
          <View className="flex-1">
            <Text className="font-bodySemibold text-base text-ink">
              {profile.parentName || t("add_your_name")}
            </Text>
            <Text className="font-body text-xs text-ink-soft" numberOfLines={1}>
              {email ?? t("profile_hint")}
            </Text>
          </View>
          <Icon name="chevronRight" size={18} color="#A79D8A" />
        </Pressable>

        <Section
          title={t("section_saved")}
          rows={[
            { icon: "cube", label: t("my_orders"), onPress: () => router.push("/shop/orders") },
            { icon: "heart", label: t("saved_products"), onPress: () => router.push("/shop/wishlist") },
            { icon: "bookmark", label: t("saved_posts"), onPress: () => router.push("/community/saved") },
          ]}
        />

        <Section
          title={t("section_settings")}
          rows={[
            { icon: "bell", label: t("notifications"), onPress: () => router.push("/more/notifications") },
            {
              icon: "moon",
              label: t("appearance"),
              onPress: () => router.push("/more/appearance"),
              badge: state.darkMode ? t("appearance_dark") : t("appearance_light"),
            },
            {
              icon: "globe",
              label: t("language"),
              onPress: () => router.push("/more/language"),
              badge: language === "sq" ? t("language_sq") : t("language_en"),
            },
          ]}
        />

        {/* Llogaria — fshirja duhet të jetë e gjetshme, jo e fshehur. */}
        <Section
          title={t("section_account")}
          rows={[
            { icon: "family", label: t("family_title"), onPress: () => router.push("/more/family") },
            { icon: "close", label: t("delete_account"), onPress: () => router.push("/more/delete-account") },
          ]}
        />

        <Section
          title={t("section_help")}
          rows={[
            { icon: "comment", label: t("help_center"), onPress: () => router.push("/more/help") },
            { icon: "family", label: t("about_bebix"), onPress: () => router.push("/more/about") },
            { icon: "lock", label: t("legal"), onPress: () => router.push("/more/legal") },
          ]}
        />

        {/* Expert CTA — separate from settings list, so it reads as an invitation, not a menu item */}
        <Pressable
          onPress={() => router.push("/more/doctor-registration")}
          style={shadows.soft}
          className="mx-5 mb-6 bg-olive-bg rounded-xl2 p-4 flex-row items-center"
        >
          <View className="w-10 h-10 rounded-full bg-surface items-center justify-center mr-3">
            <Icon name="shield" size={18} color="#6E7452" />
          </View>
          <View className="flex-1">
            <Text className="font-bodySemibold text-sm text-ink">{t("expert_cta_title")}</Text>
            <Text className="font-body text-xs text-ink-soft mt-0.5">{t("expert_cta_sub")}</Text>
          </View>
          <Icon name="chevronRight" size={16} color="#6E7452" />
        </Pressable>

        <Pressable
          onPress={() =>
            Alert.alert(t("logout_confirm_title"), t("logout_confirm_body"), [
              { text: t("cancel"), style: "cancel" },
              {
                text: t("logout_action"),
                style: "destructive",
                onPress: async () => {
                  await supabase.auth.signOut();
                  router.replace("/(auth)/login");
                },
              },
            ])
          }
          className="items-center py-3"
        >
          <Text className="font-bodyMedium text-sm text-orange">{t("logout")}</Text>
        </Pressable>

        <Text className="font-body text-[11px] text-ink-faint text-center mt-4">
          {/* Nga app.json, që të mos mbetet "1.0.0" pas çdo publikimi. */}
          Bebix v{Constants.expoConfig?.version ?? "1.0.0"}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}