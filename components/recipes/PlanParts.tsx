import { useMemo, useState } from "react";
import { View, Text, Pressable, ScrollView, Linking, Share } from "react-native";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Chip } from "@/components/stories/StoryParts";
import { MEAL_LABEL, RecipeRow } from "@/components/recipes/RecipeParts";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { haptics } from "@/lib/haptics";
import { useToast } from "@/lib/toast/ToastContext";
import { useRecipeFavorites } from "@/lib/recipes/favorites";
import { allergyConflicts, fitsMonths } from "@/lib/recipes/catalog";
import { addDays, isoDay, likingScore, parseDay, slotKey, type PlanChild, type PlanMap } from "@/lib/recipes/planner";
import { setPlanSlots } from "@/lib/recipes/mealPlan";
import type { FoodSummary } from "@/lib/recipes/firstFoods";
import { MEAL_TYPES, type MealType, type Recipe } from "@/lib/recipes/types";

/** Emrat e ditëve dhe muajve nga përkthimet e Ditarit (Hermes s'ka gjithmonë të dhënat e shqipes). */
export function useDayLabels() {
  const { t } = useTranslation();
  return useMemo(() => {
    const long = t("diary_weekdays_long").split(",");
    const short = t("diary_weekdays_short").split(",");
    const months = t("diary_months_of").split(",");
    const idx = (day: string) => (parseDay(day).getDay() + 6) % 7;
    const dayMonth = (day: string) => `${parseDay(day).getDate()} ${months[parseDay(day).getMonth()]}`;
    return {
      long: (day: string) => long[idx(day)] ?? day,
      short: (day: string) => short[idx(day)] ?? day,
      dayMonth,
      title: (day: string) => `${long[idx(day)] ?? ""}, ${dayMonth(day)}`,
      range: (start: string) => {
        const end = addDays(start, 6);
        const a = parseDay(start);
        const b = parseDay(end);
        return a.getMonth() === b.getMonth() ? `${a.getDate()}–${b.getDate()} ${months[b.getMonth()]}` : `${dayMonth(start)} – ${dayMonth(end)}`;
      },
    };
  }, [t]);
}

/** Recetat që mund të zgjidhen për një vakt: ato që plani i propozon të parat, pastaj të tjerat e moshës. */
export function pickerOptions(recipes: Recipe[], plannable: Recipe[], meal: MealType, child: PlanChild, summary: Map<string, FoodSummary>): Recipe[] {
  const ok = new Set(plannable.map((r) => r.slug));
  const fitting = recipes.filter((r) => r.mealTypes.includes(meal) && (child.months == null || fitsMonths(r, child.months)));
  const score = (r: Recipe) => likingScore(r, summary, child.foods);
  return [...fitting.filter((r) => ok.has(r.slug)).sort((a, b) => score(b) - score(a)), ...fitting.filter((r) => !ok.has(r.slug))];
}

/** Dritarja "Zgjidh recetën" / "Ndërroje": lista e recetave të vaktit dhe "Hiqe nga plani". */
export function RecipePickerSheet({
  visible,
  onClose,
  title,
  options,
  current,
  childAllergens,
  onPick,
  onRemove,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  options: Recipe[];
  current: string | null;
  childAllergens: PlanChild["allergens"];
  onPick: (slug: string) => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  const favs = useRecipeFavorites();
  return (
    <BottomSheet visible={visible} onClose={onClose} maxHeightPct={85}>
      <View className="px-5 pb-4 pt-2">
        <Text className="font-bodySemibold text-[18px] text-ink" accessibilityRole="header">
          {title}
        </Text>
        <Text className="mb-3 mt-1 font-body text-[13px] leading-[18px] text-ink-soft">{t("plan_picker_sub")}</Text>
        {current ? (
          <Pressable onPress={onRemove} accessibilityRole="button" className="mb-3 items-center justify-center rounded-full border border-ink/15" style={{ minHeight: 44 }}>
            <Text className="font-bodyMedium text-[14px] text-ink">{t("plan_remove")}</Text>
          </Pressable>
        ) : null}
        {options.length ? (
          options.map((r) => <RecipeRow key={r.slug} recipe={r} favorite={favs.isFavorite(r.slug)} conflicts={allergyConflicts(r, childAllergens)} onPress={onPick} />)
        ) : (
          <Text className="py-6 text-center font-body text-[14px] text-ink-soft">{t("plan_picker_empty")}</Text>
        )}
      </View>
    </BottomSheet>
  );
}

/** "Shto në plan" nga faqja e recetës: dita (sot e 6 ditët pas) dhe vakti; kur vakti është i zënë, thuhet çfarë zëvendëson. */
export function AddToPlanSheet({ recipe, visible, onClose, plan, lookup }: { recipe: Recipe; visible: boolean; onClose: () => void; plan: PlanMap; lookup: (slug: string) => Recipe | null | undefined }) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const labels = useDayLabels();
  const today = isoDay(new Date());
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i));
  const [day, setDay] = useState(today);
  const [meal, setMeal] = useState<MealType>(recipe.mealTypes[0] ?? "lunch");
  const taken = plan[slotKey(day, meal)];
  const takenTitle = taken && taken !== recipe.slug ? (lookup(taken)?.title ?? null) : null;

  const save = () => {
    haptics.success();
    setPlanSlots([{ day, meal, recipeSlug: recipe.slug }]);
    showToast(t("plan_added", { day: day === today ? t("plan_today") : labels.long(day), meal: t(MEAL_LABEL[meal]) }));
    onClose();
  };

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View className="px-5 pb-5 pt-2">
        <Text className="font-bodySemibold text-[18px] text-ink" accessibilityRole="header">
          {t("plan_add_title")}
        </Text>
        <Text className="mt-1 font-body text-[13px] text-ink-soft">{recipe.title}</Text>
        <Text className="mb-2 mt-4 font-bodySemibold text-[12.5px] uppercase tracking-[1px] text-ink-faint">{t("plan_add_day")}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {days.map((d) => (
            <Chip key={d} label={d === today ? t("plan_today") : `${labels.short(d)} ${parseDay(d).getDate()}`} selected={day === d} onPress={() => setDay(d)} />
          ))}
        </ScrollView>
        <Text className="mb-2 mt-4 font-bodySemibold text-[12.5px] uppercase tracking-[1px] text-ink-faint">{t("plan_add_meal")}</Text>
        <View className="flex-row flex-wrap" style={{ gap: 8 }}>
          {MEAL_TYPES.map((m) => (
            <Chip key={m} label={t(MEAL_LABEL[m])} selected={meal === m} onPress={() => setMeal(m)} />
          ))}
        </View>
        {takenTitle ? <Text className="mt-3 font-body text-[13px] leading-[18px] text-ink-soft">{t("plan_replaces", { title: takenTitle })}</Text> : null}
        <Pressable onPress={save} accessibilityRole="button" className="mt-5 items-center justify-center rounded-full bg-ink" style={{ minHeight: 50 }}>
          <Text className="font-bodySemibold text-[15px] text-cream">{t("plan_add_save")}</Text>
        </Pressable>
      </View>
    </BottomSheet>
  );
}

/** "Ndaje" në WhatsApp; kur s'hapet (p.sh. pa WhatsApp), dritarja e zakonshme e ndarjes. */
export async function shareToWhatsApp(text: string) {
  haptics.tap();
  try {
    await Linking.openURL(`https://wa.me/?text=${encodeURIComponent(text)}`);
  } catch {
    await Share.share({ message: text }).catch(() => {});
  }
}
