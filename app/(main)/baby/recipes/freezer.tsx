import { useMemo, useState } from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { CalendarPlus, Info, RefreshCw, Share2, Snowflake } from "lucide-react-native";
import { BackButton } from "@/components/ui/BackButton";
import { MEAL_LABEL, RecipeRow } from "@/components/recipes/RecipeParts";
import { CATEGORY_LABEL } from "@/components/recipes/FoodParts";
import { shareToWhatsApp, useDayLabels } from "@/components/recipes/PlanParts";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { useThemeColors } from "@/lib/theme/useThemeColors";
import { useTones } from "@/lib/theme/tone";
import { haptics } from "@/lib/haptics";
import { useToast } from "@/lib/toast/ToastContext";
import { useHouseholdRole } from "@/lib/hooks/useHouseholdRole";
import { useRecipes } from "@/lib/recipes/useRecipes";
import { useRecipeFavorites } from "@/lib/recipes/favorites";
import { useRecipeChild } from "@/lib/recipes/useRecipeChild";
import { useFoods } from "@/lib/recipes/foods";
import { useCareAccess, useFoodTries } from "@/lib/recipes/foodTries";
import { summarizeTries } from "@/lib/recipes/firstFoods";
import { allergyConflicts } from "@/lib/recipes/catalog";
import { applyPlan, useMealPlan } from "@/lib/recipes/mealPlan";
import {
  FREEZER_DAYS,
  addDays,
  amountText,
  freezerAssignments,
  freezerPicks,
  freezerSchedule,
  plannableRecipes,
  seedOf,
  shoppingList,
  shoppingText,
  weekDays,
  weekStartOf,
  type ShoppingCategory,
} from "@/lib/recipes/planner";
import type { MealType } from "@/lib/recipes/types";
import type { TranslationKey } from "@/lib/i18n/translations";

/**
 * "Ditë gatimi për ngrirje": "Gatuaj të dielën, mjafton për 5 ditë". Deri në 3 receta që ngrijnë mirë (me hekur kur
 * ka), radha e drekave nga e hëna te e premtja, lista e blerjeve për gatimin dhe "Vendosi në plan".
 */
export default function FreezerDayScreen() {
  const { week: weekParam } = useLocalSearchParams<{ week?: string }>();
  const { t } = useTranslation();
  const c = useThemeColors();
  const tones = useTones();
  const labels = useDayLabels();
  const { showToast } = useToast();
  const canEdit = useHouseholdRole() !== "viewer";
  const index = useRecipes();
  const favs = useRecipeFavorites();
  const kid = useRecipeChild();
  const foods = useFoods();
  const { tries } = useFoodTries();
  const access = useCareAccess();
  const { plan } = useMealPlan();
  const [round, setRound] = useState(0);

  const week = /^\d{4}-\d{2}-\d{2}$/.test(String(weekParam ?? "")) ? String(weekParam) : addDays(weekStartOf(new Date()), 7);
  const days = weekDays(week).slice(0, FREEZER_DAYS);
  const sunday = addDays(week, -1);
  const visibleTries = useMemo(() => (access.canSee ? tries : []), [access.canSee, tries]);
  const summary = useMemo(() => summarizeTries(visibleTries), [visibleTries]);
  const plannable = useMemo(
    () => plannableRecipes(index.recipes, { months: kid.months, allergens: kid.allergens, tries: visibleTries, foods }),
    [index.recipes, kid.months, kid.allergens, visibleTries, foods]
  );
  const picks = freezerPicks(plannable, summary, foods, seedOf(`${week}:${round}`));
  const schedule = freezerSchedule(picks);
  const counts = picks.map((r) => ({ recipe: r, count: schedule.filter((s) => s.slug === r.slug).length }));
  const groups = shoppingList(counts, foods);
  const label = (cat: ShoppingCategory) => (cat === "other" ? t("shop_list_other") : t(CATEGORY_LABEL[cat] as TranslationKey));
  const mealOf = (i: number): MealType => (schedule[i]?.mealTypes.includes("lunch") ? "lunch" : "dinner");

  const place = () => {
    const assigned = freezerAssignments(days, schedule, plan);
    const n = Object.keys(assigned).length;
    haptics.success();
    applyPlan(assigned);
    showToast(n ? t("freezer_placed", { n }) : t("freezer_placed_none"));
    if (n) router.back();
  };

  const openRecipe = (slug: string) => {
    haptics.tap();
    router.push({ pathname: "/(main)/baby/recipes/[slug]", params: { slug } });
  };

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top", "left", "right"]}>
      <View className="px-4 pb-1 pt-2">
        <BackButton fallback="/(main)/baby/recipes/plan" />
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 36, alignItems: "center" }}>
        <View style={{ width: "100%", maxWidth: 760 }}>
          <View className="flex-row items-center" style={{ gap: 10 }}>
            <Snowflake size={24} color={tones.blue.tint} />
            <Text accessibilityRole="header" className="flex-1 font-display text-[28px] leading-[35px] text-ink">
              {t("freezer_title")}
            </Text>
          </View>
          <Text className="mt-1 font-body text-[15px] leading-[22px] text-ink-soft">{t("freezer_sub")}</Text>
          <Text className="mt-1 font-body text-[13px] text-ink-faint">{t("freezer_when", { day: labels.title(sunday), range: labels.range(week) })}</Text>

          {picks.length ? (
            <>
              <Text className="mb-2 mt-5 font-bodySemibold text-[18px] text-ink" accessibilityRole="header">
                {t("freezer_cook")}
              </Text>
              {picks.map((r) => (
                <View key={r.slug}>
                  <RecipeRow recipe={r} favorite={favs.isFavorite(r.slug)} conflicts={allergyConflicts(r, kid.allergens)} onPress={openRecipe} />
                  <Text className="-mt-1 mb-3 px-1 font-body text-[13px] leading-[18px] text-ink-soft">
                    <Text className="font-bodySemibold">{t("recipes_storage_freezer")}: </Text>
                    {r.freezerNote}
                  </Text>
                </View>
              ))}

              <Text className="mb-1 mt-3 font-bodySemibold text-[18px] text-ink" accessibilityRole="header">
                {t("freezer_schedule")}
              </Text>
              <View className="rounded-2xl border border-cream-line bg-surface px-4">
                {schedule.map((r, i) => (
                  <View key={`${r.slug}-${i}`} className={`flex-row items-center py-3 ${i ? "border-t border-cream-line" : ""}`} style={{ gap: 10 }}>
                    <Text className="font-bodyMedium text-[13px] text-ink-faint" style={{ width: 96 }}>
                      {labels.long(days[i])} · {t(MEAL_LABEL[mealOf(i)])}
                    </Text>
                    <Text numberOfLines={2} className="flex-1 font-bodyMedium text-[14.5px] text-ink">
                      {r.title}
                    </Text>
                  </View>
                ))}
              </View>

              <View className="mt-4" style={{ gap: 8 }}>
                {canEdit ? (
                  <Pressable onPress={place} accessibilityRole="button" className="flex-row items-center justify-center rounded-full bg-ink active:opacity-80" style={{ minHeight: 50, gap: 8 }}>
                    <CalendarPlus size={17} color={c.cream} />
                    <Text className="font-bodySemibold text-[15px] text-cream">{t("freezer_place")}</Text>
                  </Pressable>
                ) : null}
                <Pressable
                  onPress={() => {
                    haptics.tap();
                    setRound((n) => n + 1);
                  }}
                  accessibilityRole="button"
                  className="flex-row items-center justify-center rounded-full border border-ink/15 bg-surface active:opacity-80"
                  style={{ minHeight: 46, gap: 8 }}
                >
                  <RefreshCw size={15} color={c.ink} />
                  <Text className="font-bodySemibold text-[14px] text-ink">{t("freezer_other")}</Text>
                </Pressable>
              </View>

              <View className="mb-1 mt-6 flex-row items-center justify-between">
                <Text className="font-bodySemibold text-[18px] text-ink" accessibilityRole="header">
                  {t("freezer_shopping")}
                </Text>
                <Pressable
                  onPress={() => void shareToWhatsApp(shoppingText(groups, `🧊 ${t("freezer_title")} · ${labels.title(sunday)}`, label, t("recipes_optional")))}
                  accessibilityRole="button"
                  accessibilityLabel={t("shop_list_share")}
                  className="flex-row items-center rounded-full border border-ink/10 bg-surface px-3.5"
                  style={{ minHeight: 40, gap: 6 }}
                >
                  <Share2 size={15} color={c.ink} />
                  <Text className="font-bodyMedium text-[13px] text-ink">{t("recipes_share")}</Text>
                </Pressable>
              </View>
              {groups.map((g) => (
                <View key={g.category} className="mt-3">
                  <Text className="mb-1 font-bodySemibold text-[12.5px] uppercase tracking-[1px] text-ink-faint">{label(g.category)}</Text>
                  {g.items.map((item) => (
                    <View key={item.key} className="flex-row items-center justify-between border-b border-cream-line py-2" style={{ gap: 10 }}>
                      <Text className="flex-1 font-body text-[15px] text-ink">
                        {item.name}
                        {item.optional ? <Text className="text-ink-faint">{` (${t("recipes_optional")})`}</Text> : null}
                      </Text>
                      <Text className="font-bodySemibold text-[14px] text-ink">{amountText(item)}</Text>
                    </View>
                  ))}
                </View>
              ))}
            </>
          ) : (
            <Text className="mt-5 rounded-2xl bg-cream-soft p-4 font-body text-[14px] leading-5 text-ink-soft">{t("freezer_none")}</Text>
          )}

          <View className="mt-6 flex-row" style={{ gap: 8 }}>
            <Info size={14} color={c.inkFaint} style={{ marginTop: 2 }} />
            <Text className="flex-1 font-body text-[12.5px] leading-[18px] text-ink-faint">{t("freezer_safety")}</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
