import { useMemo, useState } from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Check, ChevronRight, Info, ShieldCheck } from "lucide-react-native";
import { BackButton } from "@/components/ui/BackButton";
import { useRecipeText } from "@/components/recipes/RecipeParts";
import { FoodTrySheet, ReactionCard, planAmountKey, useFoodDate } from "@/components/recipes/FoodParts";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { useThemeColors } from "@/lib/theme/useThemeColors";
import { useTones } from "@/lib/theme/tone";
import { haptics } from "@/lib/haptics";
import { findFood, useFoods } from "@/lib/recipes/foods";
import { useCareAccess, useFoodTries } from "@/lib/recipes/foodTries";
import { ALLERGEN_PLAN, PLAN_TRIES, allergenInProgress, allergenProgress, type AllergenProgress } from "@/lib/recipes/firstFoods";
import { useRecipeChild } from "@/lib/recipes/useRecipeChild";
import type { Allergen, Food } from "@/lib/recipes/types";
import type { TranslationKey } from "@/lib/i18n/translations";

const HOW: Record<Allergen, TranslationKey> = {
  egg: "foods_how_egg",
  peanut: "foods_how_peanut",
  milk: "foods_how_milk",
  wheat: "foods_how_wheat",
  sesame: "foods_how_sesame",
  fish: "foods_how_fish",
  tree_nut: "foods_how_tree_nut",
  soy: "foods_how_soy",
  shellfish: "foods_how_shellfish",
};

/**
 * Plani i alergjenëve: për çdo alergjen kryesor, 3 prova me sasi të vogla që rriten. Pas 3 provave pa reagim, "I
 * prezantuar ✓" dhe këshilla ta mbash 1–2 herë në javë. "Pati reagim" tregon shenjat dhe kë të thërrasësh; te alergjitë
 * e profilit shkruhet vetëm kur prindi e konfirmon. Gjyshërit shohin udhëzuesin, por jo provat, pa lejen e prindërve.
 */
export default function AllergenPlan() {
  const { t } = useTranslation();
  const c = useThemeColors();
  const foods = useFoods();
  const { tries } = useFoodTries();
  const access = useCareAccess();
  const child = useRecipeChild();
  const [logging, setLogging] = useState<{ food: Food; step: number } | null>(null);

  const progress = useMemo(() => allergenProgress(access.canSee ? tries : [], foods), [access.canSee, tries, foods]);
  const current = allergenInProgress(progress);
  const young = child.months != null && child.months < 6;

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top", "bottom", "left", "right"]}>
      <View className="px-4 pb-2 pt-2">
        <BackButton fallback="/(main)/baby/recipes/foods" />
      </View>
      <ScrollView className="flex-1" contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32, alignItems: "center" }}>
        <View style={{ width: "100%", maxWidth: 760 }}>
          <Text accessibilityRole="header" className="font-display text-[28px] leading-[35px] text-ink">
            {t("foods_plan_title")}
          </Text>
          <Text className="mt-1.5 font-body text-[14.5px] leading-[21px] text-ink-soft">{t("foods_plan_intro")}</Text>
          <View className="mt-3 flex-row rounded-2xl bg-cream-soft p-3.5" style={{ gap: 10 }}>
            <Info size={16} color={c.inkSoft} style={{ marginTop: 2 }} />
            <Text className="flex-1 font-body text-[13.5px] leading-5 text-ink-soft">{t("recipes_allergen_note")}</Text>
          </View>
          {young ? <Text className="mt-3 font-bodyMedium text-[13.5px] leading-5 text-ink-soft">{t("foods_plan_young")}</Text> : null}
          {!access.canSee ? <Text className="mt-3 font-body text-[13px] leading-[19px] text-ink-soft">{t("foods_viewer_note")}</Text> : null}

          <View className="mt-4" style={{ gap: 12 }}>
            {progress.map((p) => (
              <AllergenCard
                key={p.allergen}
                progress={p}
                busyWith={current && current !== p.allergen && p.status === "not_started" ? current : null}
                canSee={access.canSee}
                canWrite={access.canWrite}
                onLog={(food, step) => {
                  haptics.tap();
                  setLogging({ food, step });
                }}
              />
            ))}
          </View>

          <View className="mt-6 flex-row" style={{ gap: 8 }}>
            <Info size={14} color={c.inkFaint} style={{ marginTop: 2 }} />
            <Text className="flex-1 font-body text-[12.5px] leading-[18px] text-ink-faint">{t("recipes_guidance_note")}</Text>
          </View>
        </View>
      </ScrollView>
      <FoodTrySheet food={logging?.food ?? null} step={logging?.step ?? null} visible={!!logging} onClose={() => setLogging(null)} />
    </SafeAreaView>
  );
}

function AllergenCard({
  progress: p,
  busyWith,
  canSee,
  canWrite,
  onLog,
}: {
  progress: AllergenProgress;
  busyWith: Allergen | null;
  canSee: boolean;
  canWrite: boolean;
  onLog: (food: Food, step: number) => void;
}) {
  const { t } = useTranslation();
  const c = useThemeColors();
  const tones = useTones();
  const text = useRecipeText();
  const date = useFoodDate();
  const food = findFood(ALLERGEN_PLAN[p.allergen].foodKey);
  const introduced = p.status === "introduced";
  const status =
    p.status === "reaction"
      ? { label: t("foods_status_reaction"), tone: tones.orange }
      : introduced
        ? { label: t("foods_status_introduced"), tone: tones.green }
        : p.status === "in_progress"
          ? { label: t("foods_status_step", { n: p.tries, total: PLAN_TRIES }), tone: tones.blue }
          : { label: t("foods_status_not_started"), tone: null };

  return (
    <View className="rounded-2xl border border-cream-line bg-surface p-4">
      <View className="flex-row items-center" style={{ gap: 10 }}>
        <Text className="flex-1 font-bodySemibold text-[17px] text-ink" accessibilityRole="header">
          {text.allergenCap(p.allergen)}
        </Text>
        {canSee ? (
          <View className="rounded-full px-3 py-1" style={{ backgroundColor: status.tone?.tintBg ?? c.creamSoft }}>
            <Text className="font-bodyMedium text-[12.5px]" style={{ color: status.tone?.ink ?? c.inkSoft }}>
              {status.label}
            </Text>
          </View>
        ) : null}
      </View>
      <Text className="mt-1.5 font-body text-[14px] leading-5 text-ink-soft">{t(HOW[p.allergen])}</Text>

      {/* Tri provat me sasitë që rriten. */}
      <View className="mt-3 flex-row" style={{ gap: 8 }}>
        {Array.from({ length: PLAN_TRIES }, (_, i) => {
          const done = canSee && (introduced || i < p.tries);
          return (
            <View
              key={i}
              className="flex-1 items-center rounded-xl px-1 py-2"
              style={{ backgroundColor: done ? tones.green.tintBg : c.creamSoft }}
              accessibilityLabel={t("foods_plan_dot_a11y", { n: i + 1, amount: t(planAmountKey(p.allergen, i)) })}
            >
              <View className="h-6 w-6 items-center justify-center rounded-full" style={{ backgroundColor: done ? tones.green.tint : c.surface }}>
                {done ? <Check size={14} color="#FFFFFF" strokeWidth={3} /> : <Text className="font-bodySemibold text-[12px] text-ink-soft">{i + 1}</Text>}
              </View>
              <Text className="mt-1 text-center font-body text-[11.5px] leading-[15px] text-ink-soft">{t(planAmountKey(p.allergen, i))}</Text>
            </View>
          );
        })}
      </View>

      {canSee && introduced ? (
        <Text className="mt-3 font-body text-[13.5px] leading-5" style={{ color: tones.green.ink }}>
          {t("foods_keep_weekly")}
          {p.lastAt ? ` ${t("foods_last_time", { date: date(p.lastAt) })}` : ""}
        </Text>
      ) : null}
      {canSee && p.status === "reaction" ? (
        <View className="mt-3" style={{ gap: 8 }}>
          {p.reactionAt ? <Text className="font-bodyMedium text-[13.5px] text-ink-soft">{t("foods_reaction_on", { date: date(p.reactionAt) })}</Text> : null}
          <ReactionCard allergens={[p.allergen]} canWrite={canWrite} />
          <Text className="font-body text-[13px] leading-[19px] text-ink-soft">{t("foods_reaction_retry")}</Text>
        </View>
      ) : null}
      {canSee && busyWith ? <Text className="mt-3 font-body text-[13px] leading-[19px] text-ink-faint">{t("foods_one_at_a_time", { allergen: text.allergen(busyWith) })}</Text> : null}

      <View className="mt-3 flex-row items-center" style={{ gap: 8 }}>
        {canWrite && food && p.nextStep != null ? (
          <Pressable onPress={() => onLog(food, p.nextStep!)} accessibilityRole="button" className="justify-center rounded-full bg-ink px-4" style={{ minHeight: 44 }}>
            <Text className="font-bodySemibold text-[14px] text-cream">{t("foods_log_step", { n: p.nextStep + 1 })}</Text>
          </Pressable>
        ) : null}
        {food ? (
          <Pressable
            onPress={() => {
              haptics.tap();
              router.push({ pathname: "/(main)/baby/recipes/food/[key]", params: { key: food.foodKey } });
            }}
            accessibilityRole="button"
            className="flex-row items-center justify-center rounded-full px-3"
            style={{ minHeight: 44, gap: 2 }}
          >
            <Text className="font-bodyMedium text-[13.5px] text-ink-soft">{t("foods_how_to_serve", { food: food.name })}</Text>
            <ChevronRight size={15} color={c.inkFaint} />
          </Pressable>
        ) : null}
      </View>
      {!canSee ? null : p.status === "not_started" && !busyWith ? (
        <View className="mt-1 flex-row items-center" style={{ gap: 6 }}>
          <ShieldCheck size={13} color={c.inkFaint} />
          <Text className="font-body text-[12px] text-ink-faint">{t("foods_morning_home")}</Text>
        </View>
      ) : null}
    </View>
  );
}
