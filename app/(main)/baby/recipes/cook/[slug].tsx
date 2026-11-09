import { useMemo, useState } from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { useKeepAwake } from "expo-keep-awake";
import { ChevronLeft, ChevronRight, X } from "lucide-react-native";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { useThemeColors } from "@/lib/theme/useThemeColors";
import { haptics } from "@/lib/haptics";
import { useRecipes } from "@/lib/recipes/useRecipes";
import { findRecipe } from "@/lib/recipes/api";
import { ingredientLine } from "@/lib/recipes/catalog";

/**
 * Modaliteti i gatimit: një hap në ekran, me shkronja të mëdha, dhe ekrani s'fiket ndërsa gatuan (`expo-keep-awake`,
 * vetëm sa ky ekran është i hapur). Faqja e parë tregon përbërësit, që t'i nxjerrësh të gjitha para se të nisësh.
 */
export default function CookMode() {
  useKeepAwake();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { t } = useTranslation();
  const c = useThemeColors();
  const index = useRecipes();
  const recipe = useMemo(() => index.recipes.find((r) => r.slug === slug) ?? (slug ? findRecipe(String(slug)) : null), [index.recipes, slug]);
  // Faqja 0 = përbërësit; pastaj një faqe për çdo hap.
  const [page, setPage] = useState(0);

  const close = () => (router.canGoBack() ? router.back() : router.replace({ pathname: "/(main)/baby/recipes/[slug]", params: { slug: String(slug ?? "") } }));
  if (!recipe) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-cream px-8">
        <Text className="text-center font-bodySemibold text-[15px] text-ink">{t("recipes_not_found")}</Text>
      </SafeAreaView>
    );
  }

  const pages = recipe.steps.length + 1;
  const last = page === pages - 1;
  const go = (next: number) => {
    haptics.select();
    setPage(Math.max(0, Math.min(pages - 1, next)));
  };

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top", "bottom", "left", "right"]}>
      <View className="flex-row items-center justify-between px-4 pb-2 pt-2">
        <Text className="flex-1 font-bodySemibold text-[15px] text-ink-soft" numberOfLines={1}>
          {recipe.title}
        </Text>
        <Pressable onPress={close} accessibilityRole="button" accessibilityLabel={t("recipes_cook_close")} className="h-11 w-11 items-center justify-center rounded-full border border-ink/10 bg-surface">
          <X size={19} color={c.ink} />
        </Pressable>
      </View>

      <View className="mx-5 mt-1 flex-row" style={{ gap: 4 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {Array.from({ length: pages }, (_, i) => (
          <View key={i} className={`h-1 flex-1 rounded-full ${i <= page ? "bg-olive" : "bg-cream-line"}`} />
        ))}
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ paddingHorizontal: 24, paddingVertical: 28 }}>
        {page === 0 ? (
          <>
            <Text className="font-bodySemibold text-[15px] uppercase tracking-[1px] text-ink-faint" accessibilityRole="header">
              {t("recipes_ingredients")}
            </Text>
            {recipe.ingredients.map((i, n) => (
              <Text key={`${i.name}-${n}`} className="mt-4 font-body text-[22px] leading-[31px] text-ink">
                {`• ${ingredientLine(i)}`}
                {i.optional ? <Text className="text-ink-faint">{` (${t("recipes_optional")})`}</Text> : null}
              </Text>
            ))}
          </>
        ) : (
          <>
            <Text className="font-bodySemibold text-[15px] uppercase tracking-[1px] text-ink-faint" accessibilityRole="header">
              {t("recipes_step_of", { n: page, total: recipe.steps.length })}
            </Text>
            <Text className="mt-4 font-body text-[28px] leading-[40px] text-ink" accessibilityLiveRegion="polite">
              {recipe.steps[page - 1]}
            </Text>
          </>
        )}
      </ScrollView>

      <View className="flex-row px-5 pb-3 pt-2" style={{ gap: 10 }}>
        <Pressable
          onPress={() => go(page - 1)}
          disabled={page === 0}
          accessibilityRole="button"
          accessibilityLabel={t("recipes_prev")}
          accessibilityState={{ disabled: page === 0 }}
          className={`flex-1 flex-row items-center justify-center rounded-full border border-ink/10 bg-surface ${page === 0 ? "opacity-40" : ""}`}
          style={{ minHeight: 60, gap: 6 }}
        >
          <ChevronLeft size={20} color={c.ink} />
          <Text className="font-bodySemibold text-[16px] text-ink">{t("recipes_prev")}</Text>
        </Pressable>
        <Pressable
          onPress={() => (last ? close() : go(page + 1))}
          accessibilityRole="button"
          accessibilityLabel={last ? t("recipes_done") : t("recipes_next")}
          className="flex-[1.4] flex-row items-center justify-center rounded-full bg-ink"
          style={{ minHeight: 60, gap: 6 }}
        >
          <Text className="font-bodySemibold text-[16px] text-cream">{last ? t("recipes_done") : t("recipes_next")}</Text>
          {last ? null : <ChevronRight size={20} color={c.cream} />}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
