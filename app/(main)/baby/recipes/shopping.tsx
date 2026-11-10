import { useEffect, useMemo, useState } from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Check, Info, Share2 } from "lucide-react-native";
import { BackButton } from "@/components/ui/BackButton";
import { CATEGORY_LABEL } from "@/components/recipes/FoodParts";
import { shareToWhatsApp, useDayLabels } from "@/components/recipes/PlanParts";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { useThemeColors } from "@/lib/theme/useThemeColors";
import { useTones } from "@/lib/theme/tone";
import { haptics } from "@/lib/haptics";
import { useRecipes } from "@/lib/recipes/useRecipes";
import { useFoods } from "@/lib/recipes/foods";
import { useMealPlan } from "@/lib/recipes/mealPlan";
import { amountText, batchesFor, isoDay, planUses, shoppingList, shoppingText, slotKey, weekDays, weekStartOf, type ShoppingCategory } from "@/lib/recipes/planner";
import { MEAL_TYPES } from "@/lib/recipes/types";
import type { TranslationKey } from "@/lib/i18n/translations";

const checkedKey = (week: string) => `bebix_shopping_checked_v1:${week}`;

/**
 * "Lista e blerjeve": përbërësit e planit të javës (nga sot e tutje), të bashkuar (2 karota + 3 karota = 5 karota) dhe
 * të ndarë sipas kategorisë. ✓ kur e blen (ruhet në këtë telefon); "Ndaje" e dërgon në WhatsApp pa ato të blerat.
 */
export default function ShoppingListScreen() {
  const { week: weekParam } = useLocalSearchParams<{ week?: string }>();
  const { t } = useTranslation();
  const c = useThemeColors();
  const tones = useTones();
  const labels = useDayLabels();
  const index = useRecipes();
  const foods = useFoods();
  const { plan } = useMealPlan();
  const today = isoDay(new Date());
  const week = /^\d{4}-\d{2}-\d{2}$/.test(String(weekParam ?? "")) ? String(weekParam) : weekStartOf(new Date());
  const days = weekDays(week).filter((d) => d >= today);
  const [bought, setBought] = useState<Set<string>>(new Set());

  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(checkedKey(week))
      .then((raw) => {
        if (alive && raw) setBought(new Set(JSON.parse(raw) as string[]));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [week]);

  const lookup = useMemo(() => new Map(index.recipes.map((r) => [r.slug, r])), [index.recipes]);
  const keys = days.flatMap((d) => MEAL_TYPES.map((m) => slotKey(d, m)));
  const uses = planUses(plan, keys, (s) => lookup.get(s));
  const groups = shoppingList(uses, foods);
  const total = groups.reduce((n, g) => n + g.items.length, 0);
  const left = groups.reduce((n, g) => n + g.items.filter((i) => !bought.has(i.key)).length, 0);
  const cookedOnce = uses.some((u) => batchesFor(u.recipe, u.count) < u.count);
  const label = (cat: ShoppingCategory) => (cat === "other" ? t("shop_list_other") : t(CATEGORY_LABEL[cat] as TranslationKey));

  const toggle = (key: string) => {
    haptics.select();
    setBought((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      void AsyncStorage.setItem(checkedKey(week), JSON.stringify([...next])).catch(() => {});
      return next;
    });
  };

  const share = () => {
    void shareToWhatsApp(shoppingText(groups, `🛒 ${t("shop_list_title")} · ${labels.range(week)}`, label, t("recipes_optional"), bought));
  };

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top", "left", "right"]}>
      <View className="px-4 pb-1 pt-2">
        <BackButton fallback="/(main)/baby/recipes/plan" />
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 36, alignItems: "center" }}>
        <View style={{ width: "100%", maxWidth: 760 }}>
          <Text accessibilityRole="header" className="font-display text-[28px] leading-[35px] text-ink">
            {t("shop_list_title")}
          </Text>
          <Text className="mt-1 font-body text-[14px] leading-5 text-ink-soft">
            {labels.range(week)} · {total ? t("shop_list_count", { left, total }) : t("shop_list_sub")}
          </Text>

          {total ? (
            <Pressable onPress={share} accessibilityRole="button" className="mt-4 flex-row items-center justify-center rounded-full bg-ink active:opacity-80" style={{ minHeight: 50, gap: 8 }}>
              <Share2 size={17} color={c.cream} />
              <Text className="font-bodySemibold text-[15px] text-cream">{t("shop_list_share")}</Text>
            </Pressable>
          ) : (
            <View className="mt-5 rounded-3xl border border-cream-line bg-surface p-5">
              <Text className="font-bodySemibold text-[15.5px] text-ink">{t("shop_list_empty_title")}</Text>
              <Text className="mt-1 font-body text-[14px] leading-5 text-ink-soft">{t("shop_list_empty")}</Text>
              <Pressable onPress={() => router.replace("/(main)/baby/recipes/plan")} accessibilityRole="button" className="mt-4 self-start justify-center rounded-full bg-ink px-5" style={{ minHeight: 44 }}>
                <Text className="font-bodyMedium text-[13.5px] text-cream">{t("plan_title")}</Text>
              </Pressable>
            </View>
          )}

          {groups.map((g) => (
            <View key={g.category} className="mt-5">
              <Text className="mb-1 font-bodySemibold text-[13px] uppercase tracking-[1px] text-ink-faint" accessibilityRole="header">
                {label(g.category)}
              </Text>
              {g.items.map((item) => {
                const done = bought.has(item.key);
                return (
                  <Pressable
                    key={item.key}
                    onPress={() => toggle(item.key)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: done }}
                    accessibilityLabel={`${item.name}, ${amountText(item)}`}
                    className="flex-row items-center border-b border-cream-line py-3 active:opacity-70"
                    style={{ gap: 12, minHeight: 52 }}
                  >
                    <View
                      className="h-6 w-6 items-center justify-center rounded-md"
                      style={{ borderWidth: done ? 0 : 1.5, borderColor: c.inkFaint, backgroundColor: done ? tones.green.tint : "transparent" }}
                    >
                      {done ? <Check size={15} color="#fff" strokeWidth={3} /> : null}
                    </View>
                    <View className="flex-1">
                      <Text className={`font-bodyMedium text-[15.5px] ${done ? "text-ink-faint line-through" : "text-ink"}`}>
                        {item.name}
                        {item.optional ? <Text className="font-body text-ink-faint">{` (${t("recipes_optional")})`}</Text> : null}
                      </Text>
                      <Text numberOfLines={1} className="mt-0.5 font-body text-[12px] text-ink-faint">
                        {item.recipes.join(" · ")}
                      </Text>
                    </View>
                    <Text className={`font-bodySemibold text-[14px] ${done ? "text-ink-faint" : "text-ink"}`}>{amountText(item)}</Text>
                  </Pressable>
                );
              })}
            </View>
          ))}

          {total ? (
            <View className="mt-6 flex-row" style={{ gap: 8 }}>
              <Info size={14} color={c.inkFaint} style={{ marginTop: 2 }} />
              <Text className="flex-1 font-body text-[12.5px] leading-[18px] text-ink-faint">
                {cookedOnce ? `${t("shop_list_batches")} ` : ""}
                {t("shop_list_note")}
              </Text>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
