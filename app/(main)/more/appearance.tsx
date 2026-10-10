import { View, Text } from "react-native";
import { ThemedSwitch } from "@/components/ui/ThemedSwitch";
import { SafeAreaView } from "react-native-safe-area-context";
import { BackButton } from "@/components/ui/BackButton";
import { useAppState } from "@/lib/state/AppStateContext";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { Icon } from "@/components/ui/Icon";
import { shadows } from "@/lib/shadows";
import { setNightAuto, useNightMode } from "@/lib/baby/nightMode";

export default function AppearanceScreen() {
  const { state, setDarkMode } = useAppState();
  const { t } = useLanguage();
  const night = useNightMode();

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      <View className="flex-row items-center px-5 pt-2 mb-4">
        <BackButton fallback="/(main)/more" className="mr-3" />
        <Text className="font-display text-xl text-ink">{t("appearance_title")}</Text>
      </View>
      <View className="px-5">
        <Text className="font-body text-sm text-ink-soft mb-6">{t("appearance_hint")}</Text>

        <View className="bg-surface rounded-xl2 overflow-hidden" style={shadows.soft}>
          <View className="flex-row items-center px-4 py-3.5">
            <View className="w-8 h-8 rounded-full bg-cream-soft items-center justify-center mr-3">
              <Icon name="moon" size={16} color="#6E7452" />
            </View>
            <Text className="font-bodyMedium text-sm text-ink flex-1">
              {state.darkMode ? t("appearance_dark") : t("appearance_light")}
            </Text>
            <ThemedSwitch
              value={state.darkMode}
              onValueChange={setDarkMode}
            />
          </View>
        </View>

        {/* Modaliteti i natës: ekran i errët me ngjyrë të ngrohtë dhe butona të mëdhenj, 22:00–06:00. */}
        <View className="bg-surface rounded-xl2 overflow-hidden mt-4" style={shadows.soft}>
          <View className="flex-row items-center px-4 py-3.5">
            <View className="w-8 h-8 rounded-full bg-cream-soft items-center justify-center mr-3">
              <Icon name="moon" size={16} color="#B23A1C" />
            </View>
            <View className="flex-1 mr-3">
              <Text className="font-bodyMedium text-sm text-ink">{t("night_auto")}</Text>
              <Text className="font-body text-xs text-ink-soft mt-0.5">{t("night_auto_hint")}</Text>
            </View>
            <ThemedSwitch value={night.prefs.auto} onValueChange={setNightAuto} />
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}