import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Baby, ShoppingBag } from "lucide-react-native";
import { StoryTonightCard } from "@/components/stories/StoryTonightCard";
import { AskAiButton } from "@/components/baby/AskAiButton";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { useThemeColors } from "@/lib/theme/useThemeColors";
import { haptics } from "@/lib/haptics";
import { shadows } from "@/lib/shadows";
import type { TranslationKey } from "@/lib/i18n/translations";

/**
 * Kreu për llogarinë pa fëmijë ("S'kam ende fëmijë": gjyshër, dhurata, planifikim). Pa shënime, gjumë apo dhëmbë
 * të një bebi që s'ekziston: përshëndetja, "Shto fëmijë" (edhe me muajin e pritur), dyqani dhe përralla për sonte.
 */
export function NoChildHome({ greeting }: { greeting: string }) {
  const { t } = useTranslation();
  const theme = useThemeColors();

  const card = (icon: React.ReactNode, title: TranslationKey, body: TranslationKey, cta: TranslationKey, onPress: () => void) => (
    <Pressable
      onPress={() => {
        haptics.tap();
        onPress();
      }}
      accessibilityRole="button"
      style={[shadows.soft, { marginTop: 16, borderRadius: 22, padding: 18, backgroundColor: theme.surface }]}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View style={{ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: theme.oliveBg }}>
          {icon}
        </View>
        <Text className="flex-1 font-bodySemibold text-[17px] text-ink">{t(title)}</Text>
      </View>
      <Text className="mt-2.5 font-body text-[14px] leading-5 text-ink-soft">{t(body)}</Text>
      <Text className="mt-3 font-bodySemibold text-[14px] text-olive">{t(cta)} →</Text>
    </Pressable>
  );

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      <ScrollView className="flex-1 px-5" contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        <View className="pb-2 pt-2">
          <Text className="font-body text-xs text-ink-faint">{greeting}</Text>
          <Text accessibilityRole="header" className="font-display text-2xl text-ink">
            {t("nochild_title")}
          </Text>
        </View>

        {card(<Baby size={22} color={theme.olive} strokeWidth={1.8} />, "nochild_add_title", "nochild_add_body", "children_add", () =>
          router.push({ pathname: "/(main)/more/children", params: { add: "1" } })
        )}
        {card(<ShoppingBag size={22} color={theme.olive} strokeWidth={1.8} />, "nochild_shop_title", "nochild_shop_body", "nochild_shop_cta", () =>
          router.push("/(main)/shop")
        )}

        <StoryTonightCard months={null} />
      </ScrollView>
      <AskAiButton />
    </SafeAreaView>
  );
}
