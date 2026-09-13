import { View, Text, Switch } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack } from "expo-router";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { shadows } from "@/lib/shadows";

export default function LanguageScreen() {
  const { t, language, setLanguage } = useLanguage();
  const isEnglish = language === "en";

  return (
    <SafeAreaView className="flex-1 bg-cream dark:bg-ink" edges={["top"]}>
      <Stack.Screen options={{ title: t("language_title") }} />
      <View className="px-5 pt-4">
        <Text className="font-display text-2xl text-ink dark:text-cream mb-1">{t("language_title")}</Text>
        <Text className="font-body text-sm text-ink-soft dark:text-cream/60 mb-6">{t("language_hint")}</Text>

        <View className="bg-surface dark:bg-ink/40 rounded-xl2 overflow-hidden flex-row items-center px-4 py-3.5" style={shadows.soft}>
          <Text className={`font-bodySemibold text-sm mr-3 ${!isEnglish ? "text-ink dark:text-cream" : "text-ink-faint dark:text-cream/40"}`}>
            {t("language_sq")}
          </Text>
          <Switch
            value={isEnglish}
            onValueChange={(value) => setLanguage(value ? "en" : "sq")}
            trackColor={{ false: "#E4DFD3", true: "#8A9160" }}
            thumbColor="#FFFFFF"
            ios_backgroundColor="#E4DFD3"
          />
          <Text className={`font-bodySemibold text-sm ml-3 ${isEnglish ? "text-ink dark:text-cream" : "text-ink-faint dark:text-cream/40"}`}>
            {t("language_en")}
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}