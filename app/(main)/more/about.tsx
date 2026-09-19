import { View, Text, ScrollView, Pressable, Share } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Icon, IconName } from "@/components/ui/Icon";
import { shadows } from "@/lib/shadows";
import { BackButton } from "@/components/ui/BackButton";
import { useTranslation } from "@/lib/i18n/LanguageContext";

function ActionRow({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} className="flex-row items-center px-4 py-3.5 border-b border-cream-line">
      <View className="w-8 h-8 rounded-full bg-cream-soft items-center justify-center mr-3">
        <Icon name={icon} size={16} color="#6E7452" />
      </View>
      <Text className="font-bodyMedium text-sm text-ink flex-1">{label}</Text>
      <Icon name="chevronRight" size={16} color="#A79D8A" />
    </Pressable>
  );
}

export default function AboutScreen() {
  const { t } = useTranslation();

  const shareApp = () => {
    Share.share({ message: t("about_share_message") });
  };

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      <View className="flex-row items-center px-5 pt-2 mb-5">
        <BackButton fallback="/(main)/more" className="mr-3" />
        <Text className="font-display text-xl text-ink">{t("about_title")}</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View className="px-5 mb-6">
          <View style={shadows.soft} className="bg-olive-bg rounded-xl2 p-5">
            <Text className="font-bodySemibold text-lg text-ink mb-2">{t("about_mission")}</Text>
            <Text className="font-body text-sm text-ink-soft leading-6 mb-4">
              {t("about_mission_body")}
            </Text>
            <Text className="font-bodySemibold text-lg text-ink mb-2">{t("about_vision")}</Text>
            <Text className="font-body text-sm text-ink-soft leading-6">
              {t("about_vision_body")}
            </Text>
          </View>
        </View>

        <View className="px-5 mb-6">
          <View style={shadows.soft} className="bg-surface rounded-xl2 overflow-hidden">
            <ActionRow icon="sparkle" label={t("about_rate")} onPress={() => { /* Linking.openURL(url-i i App Store/Play Store kur të publikohet) */ }} />
            <ActionRow icon="share" label={t("about_share")} onPress={shareApp} />
            <ActionRow icon="globe" label={t("about_website")} onPress={() => { /* Linking.openURL("https://bebix.app") — vendos domain-in real */ }} />
          </View>
        </View>

        <View className="px-5">
          <Text className="font-body text-xs text-ink-faint text-center">{t("about_version")}</Text>
          <Text className="font-body text-xs text-ink-faint text-center mt-1">{t("about_rights")}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}