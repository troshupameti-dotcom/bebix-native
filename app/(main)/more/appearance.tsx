import { View, Text, Switch } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack } from "expo-router";
import { useAppState } from "@/lib/state/AppStateContext";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { Icon } from "@/components/ui/Icon";
import { shadows } from "@/lib/shadows";

export default function AppearanceScreen() {
  const { state, setDarkMode } = useAppState();
  const { t } = useLanguage();

  return (
    <SafeAreaView className="flex-1 bg-cream dark:bg-ink" edges={["top"]}>
      <Stack.Screen options={{ title: t("appearance_title") }} />
      <View className="px-5 pt-4">
        <Text className="font-display text-2xl text-ink dark:text-cream mb-1">{t("appearance_title")}</Text>
        <Text className="font-body text-sm text-ink-soft dark:text-cream/60 mb-6">{t("appearance_hint")}</Text>

        <View className="bg-surface dark:bg-ink/40 rounded-xl2 overflow-hidden" style={shadows.soft}>
          <View className="flex-row items-center px-4 py-3.5">
            <View className="w-8 h-8 rounded-full bg-cream-soft dark:bg-cream/10 items-center justify-center mr-3">
              <Icon name="moon" size={16} color="#6E7452" />
            </View>
            <Text className="font-bodyMedium text-sm text-ink dark:text-cream flex-1">
              {state.darkMode ? t("appearance_dark") : t("appearance_light")}
            </Text>
            <Switch
              value={state.darkMode}
              onValueChange={setDarkMode}
              trackColor={{ false: "#E4DFD3", true: "#8A9160" }}
              thumbColor="#FFFFFF"
              ios_backgroundColor="#E4DFD3"
            />
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}