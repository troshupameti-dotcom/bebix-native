import { useState } from "react";
import { Linking, Pressable, ScrollView, Text, View } from "react-native";
import { AlertTriangle, Check, Phone } from "lucide-react-native";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { useThemeColors } from "@/lib/theme/useThemeColors";
import { useTones, type TONES } from "@/lib/theme/tone";
import { haptics } from "@/lib/haptics";
import { useToast } from "@/lib/toast/ToastContext";
import { useRecipeText } from "@/components/recipes/RecipeParts";
import { Chip } from "@/components/stories/StoryParts";
import { useAddAllergy, useRecipeChild } from "@/lib/recipes/useRecipeChild";
import { addFoodTry } from "@/lib/recipes/foodTries";
import { ALLERGEN_PLAN, PLAN_TRIES } from "@/lib/recipes/firstFoods";
import { REACTION_SYMPTOMS, type Allergen, type ChokingRisk, type Food, type FoodCategory, type FoodLiking, type Nutrient, type ReactionSymptom } from "@/lib/recipes/types";
import type { TranslationKey } from "@/lib/i18n/translations";

// ---- Tekstet ---------------------------------------------------------------------

export const CATEGORY_LABEL: Record<FoodCategory, TranslationKey> = {
  fruit: "foods_cat_fruit",
  vegetable: "foods_cat_vegetable",
  grain: "foods_cat_grain",
  protein: "foods_cat_protein",
  dairy: "foods_cat_dairy",
  allergen: "foods_cat_allergen",
};
export const CATEGORY_TONE: Record<FoodCategory, keyof typeof TONES> = {
  fruit: "pink",
  vegetable: "green",
  grain: "amber",
  protein: "orange",
  dairy: "blue",
  allergen: "purple",
};
export const RISK_LABEL: Record<ChokingRisk, TranslationKey> = { low: "foods_risk_low", medium: "foods_risk_medium", high: "foods_risk_high" };
export const NUTRIENT_LABEL: Record<Nutrient, TranslationKey> = {
  iron: "foods_nutrient_iron",
  protein: "foods_nutrient_protein",
  calcium: "foods_nutrient_calcium",
  vitamin_c: "foods_nutrient_vitamin_c",
  fiber: "foods_nutrient_fiber",
  omega3: "foods_nutrient_omega3",
};
const SYMPTOM_LABEL: Record<ReactionSymptom, TranslationKey> = { rash: "foods_symptom_rash", vomit: "foods_symptom_vomit", swelling: "foods_symptom_swelling", other: "foods_symptom_other" };

/** 😋 E hëngri të gjithë · 🙂 Pak · 🙅 E refuzoi: të njëjtat te receta dhe te prova e një ushqimi. */
export const LIKING_OPTIONS: { key: FoodLiking; emoji: string; label: TranslationKey }[] = [
  { key: "all", emoji: "😋", label: "recipes_liked_all" },
  { key: "some", emoji: "🙂", label: "recipes_liked_some" },
  { key: "refused", emoji: "🙅", label: "recipes_liked_no" },
];
export const likingEmoji = (l: FoodLiking | null) => LIKING_OPTIONS.find((o) => o.key === l)?.emoji ?? "";

/** Sasitë e tri provave të një alergjeni. */
const PLAN_AMOUNTS: Record<"tiny" | "small", TranslationKey[]> = {
  tiny: ["foods_amount_quarter_tsp", "foods_amount_half_tsp", "foods_amount_one_tsp"],
  small: ["foods_amount_one_tsp", "foods_amount_two_tsp", "foods_amount_one_tbsp"],
};
export function planAmountKey(allergen: Allergen, step: number): TranslationKey {
  return PLAN_AMOUNTS[ALLERGEN_PLAN[allergen].scale][Math.min(Math.max(step, 0), PLAN_TRIES - 1)];
}

export function useFoodDate() {
  const { lang } = useTranslation();
  return (iso: string) => new Date(iso).toLocaleDateString(lang === "en" ? "en-GB" : "sq-AL", { day: "numeric", month: "long" });
}

// ---- Shenja e ushqimit -----------------------------------------------------------------

/** Rrethi i ushqimit: shenja e vogël, ose germa e parë me ngjyrën e kategorisë. */
export function FoodAvatar({ food, size = 44 }: { food: Food; size?: number }) {
  const tones = useTones();
  const tone = tones[CATEGORY_TONE[food.category]];
  return (
    <View className="items-center justify-center rounded-full" style={{ width: size, height: size, backgroundColor: tone.tintBg }}>
      {food.emoji ? (
        <Text style={{ fontSize: size * 0.5 }} accessibilityElementsHidden importantForAccessibility="no">
          {food.emoji}
        </Text>
      ) : (
        <Text className="font-bodySemibold" style={{ fontSize: size * 0.42, color: tone.ink }} accessibilityElementsHidden importantForAccessibility="no">
          {food.name.slice(0, 1).toLocaleUpperCase("sq")}
        </Text>
      )}
    </View>
  );
}

// ---- Reagimi ---------------------------------------------------------------------------

export function SymptomChips({ value, onChange }: { value: ReactionSymptom[]; onChange: (v: ReactionSymptom[]) => void }) {
  const { t } = useTranslation();
  return (
    <View className="flex-row flex-wrap" style={{ gap: 8 }}>
      {REACTION_SYMPTOMS.map((s) => (
        <Chip key={s} label={t(SYMPTOM_LABEL[s])} selected={value.includes(s)} onPress={() => onChange(value.includes(s) ? value.filter((x) => x !== s) : [...value, s])} />
      ))}
    </View>
  );
}

/**
 * "Pati reagim": shenjat që duhen vëzhguar, "Thirr pediatrin; për vështirësi frymëmarrjeje thirr 112", dhe (vetëm për
 * prindërit) shtimi te alergjitë e profilit, që bëhet VETËM pasi prindi e konfirmon.
 */
export function ReactionCard({ allergens, canWrite }: { allergens: Allergen[]; canWrite: boolean }) {
  const { t } = useTranslation();
  const tones = useTones();
  const text = useRecipeText();
  const child = useRecipeChild();
  const addAllergy = useAddAllergy();
  const [asking, setAsking] = useState(false);
  const [done, setDone] = useState<"added" | "known" | null>(null);
  const known = allergens.filter((a) => child.allergens.includes(a));
  const missing = allergens.filter((a) => !child.allergens.includes(a));
  const ink = tones.orange.ink;

  return (
    <View accessibilityRole="alert" className="rounded-2xl p-4" style={{ backgroundColor: tones.orange.tintBg }}>
      <View className="flex-row items-center" style={{ gap: 8 }}>
        <AlertTriangle size={18} color={tones.orange.tint} strokeWidth={2.2} />
        <Text className="font-bodySemibold text-[16px]" style={{ color: ink }}>
          {t("foods_reaction_title")}
        </Text>
      </View>
      <Text className="mt-2 font-body text-[14.5px] leading-[21px]" style={{ color: ink }}>
        {t("foods_reaction_signs")}
      </Text>
      <Text className="mt-2 font-bodySemibold text-[14.5px] leading-[21px]" style={{ color: ink }}>
        {t("foods_reaction_call")}
      </Text>
      <Pressable
        onPress={() => void Linking.openURL("tel:112").catch(() => {})}
        accessibilityRole="button"
        accessibilityLabel={t("foods_call_112")}
        className="mt-3 flex-row items-center self-start rounded-full px-4"
        style={{ gap: 8, minHeight: 44, backgroundColor: tones.orange.tint }}
      >
        <Phone size={16} color="#FFFFFF" />
        <Text className="font-bodySemibold text-[14px]" style={{ color: "#FFFFFF" }}>
          {t("foods_call_112")}
        </Text>
      </Pressable>

      {canWrite && allergens.length ? (
        <View className="mt-4 border-t pt-3" style={{ borderColor: `${tones.orange.tint}33` }}>
          {done === "added" || (!missing.length && known.length) ? (
            <View className="flex-row items-center" style={{ gap: 6 }}>
              <Check size={16} color={ink} />
              <Text className="flex-1 font-bodyMedium text-[13.5px]" style={{ color: ink }}>
                {done === "added" ? t("foods_allergy_added") : t("foods_allergy_known", { allergens: text.allergenList(known) })}
              </Text>
            </View>
          ) : asking ? (
            <>
              <Text className="font-bodyMedium text-[14px] leading-5" style={{ color: ink }}>
                {child.name
                  ? t("foods_allergy_confirm", { allergens: text.allergenList(missing), name: child.name })
                  : t("foods_allergy_confirm_noname", { allergens: text.allergenList(missing) })}
              </Text>
              <View className="mt-3 flex-row" style={{ gap: 8 }}>
                <Pressable
                  onPress={() => {
                    haptics.success();
                    addAllergy(missing, new Date());
                    setDone("added");
                    setAsking(false);
                  }}
                  accessibilityRole="button"
                  className="flex-1 items-center justify-center rounded-full"
                  style={{ minHeight: 44, backgroundColor: tones.orange.tint }}
                >
                  <Text className="font-bodySemibold text-[14px]" style={{ color: "#FFFFFF" }}>
                    {t("foods_allergy_yes")}
                  </Text>
                </Pressable>
                <Pressable onPress={() => setAsking(false)} accessibilityRole="button" className="flex-1 items-center justify-center rounded-full border" style={{ minHeight: 44, borderColor: `${tones.orange.tint}55` }}>
                  <Text className="font-bodyMedium text-[14px]" style={{ color: ink }}>
                    {t("foods_allergy_no")}
                  </Text>
                </Pressable>
              </View>
            </>
          ) : (
            <Pressable onPress={() => setAsking(true)} accessibilityRole="button" className="items-start justify-center" style={{ minHeight: 40 }}>
              <Text className="font-bodySemibold text-[14px] underline" style={{ color: ink }}>
                {t("foods_allergy_add")}
              </Text>
            </Pressable>
          )}
        </View>
      ) : null}
    </View>
  );
}

// ---- Shënimi i një prove ---------------------------------------------------------------

const DAY_OPTIONS: { days: number; label: TranslationKey }[] = [
  { days: 0, label: "foods_day_today" },
  { days: 1, label: "foods_day_yesterday" },
  { days: 2, label: "foods_day_before" },
];

/**
 * "Shëno provën" me dorë: dita, si i pëlqeu dhe "pati reagim?". Për alergjenët tregon sasinë e provës së radhës.
 * `step` = prova e radhës e planit të alergjenëve (0, 1, 2), kur ka.
 */
export function FoodTrySheet({ food, visible, onClose, step = null }: { food: Food | null; visible: boolean; onClose: () => void; step?: number | null }) {
  const { t } = useTranslation();
  const c = useThemeColors();
  const { showToast } = useToast();
  const [days, setDays] = useState(0);
  const [liking, setLiking] = useState<FoodLiking | null>(null);
  const [reaction, setReaction] = useState<boolean | null>(null);
  const [symptoms, setSymptoms] = useState<ReactionSymptom[]>([]);

  const reset = () => {
    setDays(0);
    setLiking(null);
    setReaction(null);
    setSymptoms([]);
  };
  const close = () => {
    reset();
    onClose();
  };
  const save = () => {
    if (!food) return;
    haptics.success();
    const at = new Date();
    at.setDate(at.getDate() - days);
    addFoodTry({ foodKey: food.foodKey, triedAt: at.toISOString(), liking, reaction: reaction === true, symptoms });
    showToast(t("foods_try_saved", { food: food.name }));
    close();
  };

  return (
    <BottomSheet visible={visible && !!food} onClose={close} maxHeightPct={88}>
      {food ? (
        <ScrollView contentContainerStyle={{ paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
          <View className="flex-row items-center pt-2" style={{ gap: 12 }}>
            <FoodAvatar food={food} size={42} />
            <View className="flex-1">
              <Text className="font-bodySemibold text-[18px] text-ink">{t("foods_try_title", { food: food.name })}</Text>
              {food.allergen && step != null ? (
                <Text className="mt-0.5 font-body text-[13px] text-ink-soft">
                  {t("foods_plan_step", { n: step + 1, total: PLAN_TRIES, amount: t(planAmountKey(food.allergen, step)) })}
                </Text>
              ) : null}
            </View>
          </View>

          <Text className="mb-2 mt-5 font-bodySemibold text-[13px] uppercase tracking-[1px] text-ink-faint">{t("foods_try_when")}</Text>
          <View className="flex-row flex-wrap" style={{ gap: 8 }}>
            {DAY_OPTIONS.map((d) => (
              <Chip key={d.days} label={t(d.label)} selected={days === d.days} onPress={() => setDays(d.days)} />
            ))}
          </View>

          <Text className="mb-2 mt-5 font-bodySemibold text-[13px] uppercase tracking-[1px] text-ink-faint">{t("recipes_how_liked")}</Text>
          <View style={{ gap: 8 }}>
            {LIKING_OPTIONS.map((l) => (
              <Pressable
                key={l.key}
                onPress={() => {
                  haptics.select();
                  setLiking(liking === l.key ? null : l.key);
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: liking === l.key }}
                className="flex-row items-center rounded-2xl px-4"
                style={{ gap: 12, minHeight: 52, backgroundColor: liking === l.key ? c.creamSoft : c.surface, borderWidth: 1, borderColor: liking === l.key ? c.ink : c.creamLine }}
              >
                <Text style={{ fontSize: 22 }}>{l.emoji}</Text>
                <Text className="font-bodyMedium text-[15px] text-ink">{t(l.label)}</Text>
              </Pressable>
            ))}
          </View>

          <Text className="mb-2 mt-5 font-bodySemibold text-[13px] uppercase tracking-[1px] text-ink-faint">{t("foods_reaction_question")}</Text>
          <View className="flex-row" style={{ gap: 8 }}>
            <Chip label={t("foods_reaction_no")} selected={reaction === false} onPress={() => setReaction(false)} />
            <Chip label={t("foods_reaction_yes")} selected={reaction === true} onPress={() => setReaction(true)} />
          </View>
          {reaction ? (
            <View className="mt-3" style={{ gap: 12 }}>
              <SymptomChips value={symptoms} onChange={setSymptoms} />
              <ReactionCard allergens={food.allergen ? [food.allergen] : []} canWrite />
            </View>
          ) : null}

          <Pressable onPress={save} accessibilityRole="button" className="mt-6 items-center justify-center rounded-full bg-ink" style={{ minHeight: 50 }}>
            <Text className="font-bodySemibold text-[15px] text-cream">{t("foods_try_save")}</Text>
          </Pressable>
          <Pressable onPress={close} accessibilityRole="button" className="mt-2 items-center justify-center" style={{ minHeight: 44 }}>
            <Text className="font-bodyMedium text-[14px] text-ink-soft">{t("foods_cancel")}</Text>
          </Pressable>
        </ScrollView>
      ) : null}
    </BottomSheet>
  );
}
