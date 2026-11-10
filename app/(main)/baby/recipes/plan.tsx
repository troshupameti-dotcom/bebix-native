import { useMemo, useRef, useState } from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { ChevronLeft, ChevronRight, Info, Plus, ShoppingBasket, Snowflake, Sparkles, WandSparkles } from "lucide-react-native";
import { BackButton } from "@/components/ui/BackButton";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { MEAL_LABEL, RecipeRow } from "@/components/recipes/RecipeParts";
import { FoodAvatar } from "@/components/recipes/FoodParts";
import { RecipePickerSheet, pickerOptions, useDayLabels } from "@/components/recipes/PlanParts";
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
import { applyPlan, setPlanSlots, useMealPlan } from "@/lib/recipes/mealPlan";
import {
  addDays,
  fillWeek,
  firstFreeSlot,
  isoDay,
  mealsForMonths,
  newFoodSuggestion,
  plannableRecipes,
  seedOf,
  slotKey,
  weekDays,
  weekStartOf,
  type PlanChild,
} from "@/lib/recipes/planner";
import { MEAL_TYPES, type MealType } from "@/lib/recipes/types";

/** Sa javë larg lejohet të shkohet: 4 prapa (për t'u parë), 5 përpara. */
const WEEKS_BACK = 4;
const WEEKS_AHEAD = 5;

/**
 * "Plani i javës": 7 ditë × mëngjes / drekë / darkë / zemër. Prekja hap recetën, prekja e gjatë e ndërron. "Plotëso
 * javën për mua" vendos receta te vaktet bosh (moshë, alergji, ushqimet që i pëlqejnë, jo më shumë se 2 herë, hekur çdo
 * ditë). "Provo diçka të re ✨" propozon një recetë me një ushqim që s'e ka provuar. Plani është i familjes: e ndryshojnë
 * prindërit, gjyshërit e shohin.
 */
export default function MealPlanScreen() {
  const { t } = useTranslation();
  const c = useThemeColors();
  const tones = useTones();
  const labels = useDayLabels();
  const { showToast } = useToast();
  const role = useHouseholdRole();
  const canEdit = role !== "viewer";
  const index = useRecipes();
  const favs = useRecipeFavorites();
  const kid = useRecipeChild();
  const foods = useFoods();
  const { tries } = useFoodTries();
  const access = useCareAccess();
  const { plan } = useMealPlan();

  const today = isoDay(new Date());
  const thisWeek = weekStartOf(new Date());
  const [week, setWeek] = useState(thisWeek);
  const [picker, setPicker] = useState<{ day: string; meal: MealType } | null>(null);
  const [tryNew, setTryNew] = useState<{ seed: number; skip: string[] } | null>(null);
  const [ironNote, setIronNote] = useState<number>(0);
  // Çdo shtypje jep një propozim tjetër (por të parashikueshëm në teste).
  const presses = useRef(0);

  const days = weekDays(week);
  const visibleTries = useMemo(() => (access.canSee ? tries : []), [access.canSee, tries]);
  const summary = useMemo(() => summarizeTries(visibleTries), [visibleTries]);
  const child: PlanChild = useMemo(() => ({ months: kid.months, allergens: kid.allergens, tries: visibleTries, foods }), [kid.months, kid.allergens, visibleTries, foods]);
  const plannable = useMemo(() => plannableRecipes(index.recipes, child), [index.recipes, child]);
  const lookup = useMemo(() => new Map(index.recipes.map((r) => [r.slug, r])), [index.recipes]);
  const tooYoung = kid.months != null && kid.months < 6;
  const editableWeek = days[6] >= today;
  const weekOffset = Math.round((new Date(week).getTime() - new Date(thisWeek).getTime()) / (7 * 86_400_000));

  const fill = () => {
    haptics.success();
    const { assigned, daysWithoutIron } = fillWeek({
      days,
      meals: mealsForMonths(kid.months),
      plan,
      recipes: plannable,
      catalog: index.recipes,
      summary,
      foods,
      seed: seedOf(`${week}:${today}:${(presses.current += 1)}`),
      from: today,
    });
    const count = Object.keys(assigned).length;
    applyPlan(assigned);
    setIronNote(daysWithoutIron.length);
    showToast(count ? t("plan_filled", { n: count }) : t("plan_filled_none"));
  };

  const suggestion = tryNew ? newFoodSuggestion(index.recipes, child, summary, tryNew.seed, tryNew.skip) : null;
  const freeSlot = suggestion ? firstFreeSlot(days, MEAL_TYPES.filter((m) => suggestion.recipe.mealTypes.includes(m)), plan, today > days[0] ? today : days[0]) : null;
  const newFood = suggestion ? foods.find((f) => f.foodKey === suggestion.foodKey) ?? null : null;

  const placeSuggestion = () => {
    if (!suggestion || !freeSlot) return;
    haptics.success();
    setPlanSlots([{ day: freeSlot.day, meal: freeSlot.meal, recipeSlug: suggestion.recipe.slug }]);
    showToast(t("plan_added", { day: freeSlot.day === today ? t("plan_today") : labels.long(freeSlot.day), meal: t(MEAL_LABEL[freeSlot.meal]) }));
    setTryNew(null);
  };

  const openRecipe = (slug: string) => {
    haptics.tap();
    router.push({ pathname: "/(main)/baby/recipes/[slug]", params: { slug } });
  };

  const pickerCurrent = picker ? (plan[slotKey(picker.day, picker.meal)] ?? null) : null;
  const pickerList = picker ? pickerOptions(index.recipes, plannable, picker.meal, child, summary) : [];

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top", "left", "right"]}>
      <View className="px-4 pb-1 pt-2">
        <BackButton fallback="/(main)/baby/recipes" />
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 36, alignItems: "center" }}>
        <View style={{ width: "100%", maxWidth: 760 }}>
          <Text accessibilityRole="header" className="font-display text-[28px] leading-[35px] text-ink">
            {t("plan_title")}
          </Text>
          <Text className="mt-1 font-body text-[14px] leading-5 text-ink-soft">{canEdit ? t("plan_sub") : t("plan_viewer_note")}</Text>

          {/* Java: ‹ 16–22 nëntor › */}
          <View className="mt-4 flex-row items-center rounded-2xl border border-cream-line bg-surface px-2" style={{ minHeight: 52 }}>
            <Pressable
              onPress={() => setWeek(addDays(week, -7))}
              disabled={weekOffset <= -WEEKS_BACK}
              accessibilityRole="button"
              accessibilityLabel={t("diary_prev_week")}
              className="h-11 w-11 items-center justify-center"
              style={{ opacity: weekOffset <= -WEEKS_BACK ? 0.3 : 1 }}
            >
              <ChevronLeft size={20} color={c.ink} />
            </Pressable>
            <View className="flex-1 items-center">
              <Text className="font-bodySemibold text-[15.5px] text-ink">{labels.range(week)}</Text>
              <Text className="font-body text-[12px] text-ink-faint">{weekOffset === 0 ? t("plan_this_week") : weekOffset === 1 ? t("plan_next_week") : " "}</Text>
            </View>
            <Pressable
              onPress={() => setWeek(addDays(week, 7))}
              disabled={weekOffset >= WEEKS_AHEAD}
              accessibilityRole="button"
              accessibilityLabel={t("diary_next_week")}
              className="h-11 w-11 items-center justify-center"
              style={{ opacity: weekOffset >= WEEKS_AHEAD ? 0.3 : 1 }}
            >
              <ChevronRight size={20} color={c.ink} />
            </Pressable>
          </View>

          {tooYoung ? <Text className="mt-3 rounded-2xl bg-cream-soft p-3.5 font-body text-[13px] leading-[19px] text-ink-soft">{t("plan_too_young")}</Text> : null}

          {canEdit && editableWeek && !tooYoung ? (
            <View className="mt-3" style={{ gap: 8 }}>
              <Pressable onPress={fill} accessibilityRole="button" className="flex-row items-center justify-center rounded-full bg-ink active:opacity-80" style={{ minHeight: 50, gap: 8 }}>
                <WandSparkles size={17} color={c.cream} />
                <Text className="font-bodySemibold text-[15px] text-cream">{t("plan_fill")}</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  haptics.tap();
                  setTryNew({ seed: seedOf(`${today}:${(presses.current += 1)}`), skip: [] });
                }}
                accessibilityRole="button"
                className="flex-row items-center justify-center rounded-full border border-ink/15 bg-surface active:opacity-80"
                style={{ minHeight: 48, gap: 8 }}
              >
                <Sparkles size={16} color={tones.purple.tint} />
                <Text className="font-bodySemibold text-[14.5px] text-ink">{t("plan_try_new")}</Text>
              </Pressable>
              <Text className="font-body text-[12.5px] leading-[18px] text-ink-faint">{t("plan_fill_hint")}</Text>
            </View>
          ) : null}
          {ironNote > 0 ? <Text className="mt-3 rounded-2xl bg-cream-soft p-3.5 font-body text-[13px] leading-[19px] text-ink-soft">{t("plan_iron_note", { n: ironNote })}</Text> : null}

          <View className="mt-4 flex-row" style={{ gap: 10 }}>
            <PlanTile
              icon={<ShoppingBasket size={19} color={tones.green.tint} />}
              title={t("shop_list_title")}
              sub={t("shop_list_tile_sub")}
              onPress={() => {
                haptics.tap();
                router.push({ pathname: "/(main)/baby/recipes/shopping", params: { week } });
              }}
            />
            <PlanTile
              icon={<Snowflake size={19} color={tones.blue.tint} />}
              title={t("freezer_title")}
              sub={t("freezer_sub")}
              onPress={() => {
                haptics.tap();
                router.push({ pathname: "/(main)/baby/recipes/freezer", params: { week: week > thisWeek ? week : addDays(thisWeek, 7) } });
              }}
            />
          </View>

          {days.map((day) => {
            const isToday = day === today;
            const past = day < today;
            return (
              <View key={day} className="mt-4 rounded-3xl border border-cream-line bg-surface px-4 pb-1.5 pt-3.5" style={{ opacity: past ? 0.65 : 1 }}>
                <View className="mb-1 flex-row items-center" style={{ gap: 8 }}>
                  <Text className="font-bodySemibold text-[15.5px] text-ink" accessibilityRole="header">
                    {labels.title(day)}
                  </Text>
                  {isToday ? (
                    <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: tones.green.tintBg }}>
                      <Text className="font-bodySemibold text-[11.5px]" style={{ color: tones.green.ink }}>
                        {t("plan_today")}
                      </Text>
                    </View>
                  ) : null}
                </View>
                {MEAL_TYPES.map((meal) => {
                  const slug = plan[slotKey(day, meal)] ?? null;
                  const recipe = slug ? lookup.get(slug) : undefined;
                  const conflicts = recipe ? allergyConflicts(recipe, kid.allergens) : [];
                  const swap = () => {
                    if (!canEdit) return;
                    haptics.select();
                    setPicker({ day, meal });
                  };
                  return (
                    <Pressable
                      key={meal}
                      onPress={() => (recipe ? openRecipe(recipe.slug) : swap())}
                      onLongPress={swap}
                      delayLongPress={350}
                      disabled={!recipe && !canEdit}
                      accessibilityRole="button"
                      accessibilityLabel={`${t(MEAL_LABEL[meal])}: ${recipe?.title ?? t("plan_empty_slot")}`}
                      accessibilityHint={canEdit && recipe ? t("plan_swap_hint") : undefined}
                      accessibilityActions={canEdit && recipe ? [{ name: "longpress", label: t("plan_swap") }] : undefined}
                      onAccessibilityAction={(e) => e.nativeEvent.actionName === "longpress" && swap()}
                      className="flex-row items-center border-t border-cream-line py-2.5 active:opacity-70"
                      style={{ gap: 10, minHeight: 50 }}
                    >
                      <Text className="font-bodyMedium text-[12.5px] text-ink-faint" style={{ width: 74 }}>
                        {t(MEAL_LABEL[meal])}
                      </Text>
                      {recipe ? (
                        <>
                          <Text numberOfLines={2} className="flex-1 font-bodyMedium text-[14.5px] leading-5 text-ink">
                            {recipe.title}
                          </Text>
                          {recipe.nutrients.includes("iron") ? (
                            <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: tones.orange.tintBg }}>
                              <Text className="font-bodyMedium text-[11px]" style={{ color: tones.orange.ink }}>
                                {t("plan_iron")}
                              </Text>
                            </View>
                          ) : null}
                          {conflicts.length ? <Text className="font-bodySemibold text-[11.5px] text-orange">{t("plan_allergy_badge")}</Text> : null}
                        </>
                      ) : slug ? (
                        <Text className="flex-1 font-body text-[13.5px] text-ink-faint">{t("plan_missing_recipe")}</Text>
                      ) : canEdit ? (
                        <View className="flex-1 flex-row items-center" style={{ gap: 6 }}>
                          <Plus size={15} color={c.inkFaint} />
                          <Text className="font-body text-[13.5px] text-ink-faint">{t("plan_add_short")}</Text>
                        </View>
                      ) : (
                        <Text className="flex-1 font-body text-[13.5px] text-ink-faint">—</Text>
                      )}
                    </Pressable>
                  );
                })}
              </View>
            );
          })}

          <View className="mt-6 flex-row" style={{ gap: 8 }}>
            <Info size={14} color={c.inkFaint} style={{ marginTop: 2 }} />
            <Text className="flex-1 font-body text-[12.5px] leading-[18px] text-ink-faint">{t("plan_guidance_note")}</Text>
          </View>
        </View>
      </ScrollView>

      <RecipePickerSheet
        visible={!!picker}
        onClose={() => setPicker(null)}
        title={picker ? `${t(MEAL_LABEL[picker.meal])} · ${labels.title(picker.day)}` : ""}
        options={pickerList}
        current={pickerCurrent}
        childAllergens={kid.allergens}
        onPick={(slug) => {
          if (!picker) return;
          haptics.success();
          setPlanSlots([{ day: picker.day, meal: picker.meal, recipeSlug: slug }]);
          setPicker(null);
        }}
        onRemove={() => {
          if (!picker) return;
          haptics.tap();
          setPlanSlots([{ day: picker.day, meal: picker.meal, recipeSlug: null }]);
          setPicker(null);
        }}
      />

      <BottomSheet visible={!!tryNew} onClose={() => setTryNew(null)}>
        <View className="px-5 pb-5 pt-2">
          <Text className="font-bodySemibold text-[18px] text-ink" accessibilityRole="header">
            {t("plan_try_new")}
          </Text>
          {suggestion ? (
            <>
              {newFood ? (
                <View className="mb-3 mt-3 flex-row items-center rounded-2xl p-3" style={{ gap: 12, backgroundColor: tones.purple.tintBg }}>
                  <FoodAvatar food={newFood} size={40} />
                  <View className="flex-1">
                    <Text className="font-bodySemibold text-[14.5px]" style={{ color: tones.purple.ink }}>
                      {t("plan_new_food", { food: newFood.name })}
                    </Text>
                    <Text className="mt-0.5 font-body text-[12.5px] leading-[17px]" style={{ color: tones.purple.ink }}>
                      {t("plan_new_food_hint")}
                    </Text>
                  </View>
                </View>
              ) : null}
              <RecipeRow recipe={suggestion.recipe} favorite={favs.isFavorite(suggestion.recipe.slug)} conflicts={allergyConflicts(suggestion.recipe, kid.allergens)} onPress={openRecipe} />
              {freeSlot ? (
                <Pressable onPress={placeSuggestion} accessibilityRole="button" className="items-center justify-center rounded-full bg-ink" style={{ minHeight: 50 }}>
                  <Text className="font-bodySemibold text-[15px] text-cream">
                    {t("plan_place_at", { meal: t(MEAL_LABEL[freeSlot.meal]), day: freeSlot.day === today ? t("plan_today") : labels.long(freeSlot.day) })}
                  </Text>
                </Pressable>
              ) : (
                <Text className="font-body text-[13.5px] leading-5 text-ink-soft">{t("plan_no_free_slot")}</Text>
              )}
              <Pressable
                onPress={() => setTryNew((s) => (s ? { seed: s.seed + 1, skip: [...s.skip, suggestion.recipe.slug] } : s))}
                accessibilityRole="button"
                className="mt-2 items-center justify-center"
                style={{ minHeight: 44 }}
              >
                <Text className="font-bodyMedium text-[14px] text-ink-soft">{t("plan_another")}</Text>
              </Pressable>
            </>
          ) : (
            <Text className="mt-2 font-body text-[14px] leading-5 text-ink-soft">{t("plan_try_new_none")}</Text>
          )}
        </View>
      </BottomSheet>
    </SafeAreaView>
  );
}

function PlanTile({ icon, title, sub, onPress }: { icon: React.ReactNode; title: string; sub: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${title}. ${sub}`} className="flex-1 rounded-2xl border border-cream-line bg-surface p-3.5 active:opacity-80">
      {icon}
      <Text className="mt-2 font-bodySemibold text-[14.5px] leading-5 text-ink" numberOfLines={2}>
        {title}
      </Text>
      <Text className="mt-0.5 font-body text-[12.5px] leading-[17px] text-ink-soft" numberOfLines={2}>
        {sub}
      </Text>
    </Pressable>
  );
}
