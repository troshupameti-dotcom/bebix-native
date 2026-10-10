import { View, Text, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { BackButton } from "@/components/ui/BackButton";
import { WhatsNewList } from "@/components/WhatsNew";
import { useTranslation } from "@/lib/i18n/LanguageContext";

/** "Çfarë ka të re", për ta rihapur nga Më shumë. */
export default function WhatsNewScreen() {
  const { t } = useTranslation();
  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      <View className="mb-2 flex-row items-center px-5 pt-2">
        <BackButton fallback="/(main)/more" className="mr-3" />
        <Text className="font-display text-xl text-ink">{t("wn_title")}</Text>
      </View>
      <ScrollView className="flex-1 px-5" contentContainerStyle={{ paddingBottom: 32 }}>
        <Text className="mb-5 font-body text-[14px] leading-6 text-ink-soft">{t("wn_intro")}</Text>
        <WhatsNewList onOpen={(item) => item.route && router.push(item.route)} />
      </ScrollView>
    </SafeAreaView>
  );
}
