import { useEffect, useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Check, ChevronRight } from "lucide-react-native";
import { RecipeCover, useRecipeText } from "@/components/recipes/RecipeParts";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { useThemeColors } from "@/lib/theme/useThemeColors";
import { haptics } from "@/lib/haptics";
import { useRecipes } from "@/lib/recipes/useRecipes";
import { useRecipeChild } from "@/lib/recipes/useRecipeChild";
import { recipeOfTheDay } from "@/lib/recipes/catalog";
import type { TranslationKey } from "@/lib/i18n/translations";

/** Karta "Gati për ushqimet e para?" del vetëm një herë; pas "E kuptova" ose hapjes së recetave s'del më. */
export const READY_SEEN_KEY = "bebix_recipes_ready_seen_v1";
const SIGNS: TranslationKey[] = ["recipes_ready_sign_1", "recipes_ready_sign_2", "recipes_ready_sign_3", "recipes_ready_sign_4"];

/**
 * Te faqja e bebit: nga 6 muaj deri në 5 vjeç, "Ide për sot 🥣" (një recetë që i përshtatet moshës dhe s'ka
 * alergjenët e fëmijës). Në 5 muaj, një herë, shenjat e gatishmërisë për ushqimet e para. Pa njoftime.
 */
export function RecipeTodayCard() {
  const { t } = useTranslation();
  const c = useThemeColors();
  const text = useRecipeText();
  const child = useRecipeChild();
  const index = useRecipes();
  const months = child.months;
  const [readySeen, setReadySeen] = useState<boolean | null>(null);

  const isFive = months != null && months >= 5 && months < 6;
  useEffect(() => {
    if (!isFive) return;
    let alive = true;
    AsyncStorage.getItem(READY_SEEN_KEY)
      .then((v) => alive && setReadySeen(v === "1"))
      .catch(() => alive && setReadySeen(false));
    return () => {
      alive = false;
    };
  }, [isFive]);

  const today = useMemo(() => (months != null && months >= 6 ? recipeOfTheDay(index.recipes, months, child.allergens) : null), [index.recipes, months, child.allergens]);

  const markReady = () => {
    setReadySeen(true);
    void AsyncStorage.setItem(READY_SEEN_KEY, "1").catch(() => {});
  };

  if (isFive) {
    if (readySeen !== false) return null;
    return (
      <View className="mb-4 rounded-3xl border border-cream-line bg-surface p-4">
        <Text className="font-bodySemibold text-[16px] text-ink" accessibilityRole="header">
          {t("recipes_ready_title")}
        </Text>
        <Text className="mt-1 font-body text-[13.5px] leading-5 text-ink-soft">{t("recipes_ready_body")}</Text>
        <View className="mt-3" style={{ gap: 8 }}>
          {SIGNS.map((k) => (
            <View key={k} className="flex-row items-center" style={{ gap: 10 }}>
              <View className="h-6 w-6 items-center justify-center rounded-full bg-cream-soft">
                <Check size={13} color={c.olive} strokeWidth={2.4} />
              </View>
              <Text className="flex-1 font-body text-[14.5px] text-ink">{t(k)}</Text>
            </View>
          ))}
        </View>
        <Text className="mt-3 font-body text-[12.5px] leading-[18px] text-ink-faint">{t("recipes_ready_note")}</Text>
        <View className="mt-4 flex-row" style={{ gap: 8 }}>
          <Pressable onPress={markReady} accessibilityRole="button" className="flex-1 items-center justify-center rounded-full border border-ink/10" style={{ minHeight: 44 }}>
            <Text className="font-bodyMedium text-[13.5px] text-ink">{t("recipes_ready_dismiss")}</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              haptics.tap();
              markReady();
              router.push("/(main)/baby/recipes");
            }}
            accessibilityRole="button"
            className="flex-1 items-center justify-center rounded-full bg-ink"
            style={{ minHeight: 44 }}
          >
            <Text className="font-bodySemibold text-[13.5px] text-cream">{t("recipes_ready_open")}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (!today || months == null || months > 60) return null;
  return (
    <View className="mb-4 overflow-hidden rounded-3xl border border-cream-line bg-surface">
      <Pressable
        onPress={() => {
          haptics.tap();
          router.push({ pathname: "/(main)/baby/recipes/[slug]", params: { slug: today.slug } });
        }}
        accessibilityRole="button"
        accessibilityLabel={`${t("recipes_today_card_title")}: ${today.title}`}
        className="flex-row items-center p-3 active:opacity-80"
        style={{ gap: 12 }}
      >
        <RecipeCover recipe={today} style={{ width: 84, height: 84 }} radius={16} />
        <View className="flex-1">
          <Text className="font-bodyMedium text-[12.5px] text-olive">{t("recipes_today_card_title")}</Text>
          <Text numberOfLines={2} className="mt-0.5 font-bodySemibold text-[15.5px] leading-5 text-ink">
            {today.title}
          </Text>
          <Text className="mt-1 font-body text-[12.5px] text-ink-soft">
            {text.age(today)} · {text.time(today)}
          </Text>
        </View>
        <ChevronRight size={18} color={c.inkFaint} />
      </Pressable>
      <Pressable
        onPress={() => {
          haptics.tap();
          router.push("/(main)/baby/recipes");
        }}
        accessibilityRole="button"
        className="border-t border-cream-line px-4 py-3 active:opacity-80"
      >
        <Text className="font-bodyMedium text-[13.5px] text-ink-soft">{t("recipes_today_card_all")} →</Text>
      </Pressable>
    </View>
  );
}
