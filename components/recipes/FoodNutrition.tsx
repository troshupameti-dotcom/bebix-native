import { Text, View } from "react-native";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { useThemeColors } from "@/lib/theme/useThemeColors";
import { foodGroup, nutritionFor, portionFor, scaleNutrition, typicalGrams, type FoodGroup, type Portion, type ServeKey } from "@/lib/recipes/nutrition";
import type { Per100g } from "@/content/recipes/nutrition";
import type { Food } from "@/lib/recipes/types";
import type { TranslationKey } from "@/lib/i18n/translations";

/** "Sa shpesh", sipas grupit të ushqimit. */
export const FREQUENCY: Record<FoodGroup, TranslationKey> = {
  fruit: "food_freq_fruit",
  vegetable: "food_freq_vegetable",
  grain: "food_freq_grain",
  legume: "food_freq_legume",
  meat: "food_freq_meat",
  fish: "food_freq_fish",
  egg: "food_freq_egg",
  dairy: "food_freq_dairy",
  milk: "food_freq_milk",
  fat: "food_freq_fat",
  nut: "food_freq_nut",
  seasoning: "food_freq_seasoning",
  ingredient: "food_freq_ingredient",
};

/** Ushqimet që jepen më rrallë se grupi i tyre (mëlçia, toni, frutat e thata…). */
const FOOD_FREQUENCY: Record<string, TranslationKey> = {
  chicken_liver: "food_freq_liver",
  tuna: "food_freq_tuna",
  chia_seeds: "food_freq_seeds",
  ground_flaxseed: "food_freq_seeds",
  pumpkin_seeds: "food_freq_seeds",
  raisins: "food_freq_dried_fruit",
  dates: "food_freq_dried_fruit",
  dried_apricots: "food_freq_dried_fruit",
  prunes: "food_freq_dried_fruit",
  olives: "food_freq_olives",
  rice_cakes: "food_freq_rice_cakes",
};

/** "Sa shpesh" për një ushqim: i veçanti kur ka, përndryshe ai i grupit. */
export function frequencyKey(food: Pick<Food, "foodKey" | "category">): TranslationKey {
  return FOOD_FREQUENCY[food.foodKey] ?? FREQUENCY[foodGroup(food)];
}

const FORM: Record<"raw" | "cooked" | "dry", TranslationKey> = {
  raw: "food_form_raw",
  cooked: "food_form_cooked",
  dry: "food_form_dry",
};

const ROWS: { key: keyof Per100g; label: TranslationKey; unit: string }[] = [
  { key: "kcal", label: "food_nut_kcal", unit: "kcal" },
  { key: "protein", label: "food_nut_protein", unit: "g" },
  { key: "carbs", label: "food_nut_carbs", unit: "g" },
  { key: "fat", label: "food_nut_fat", unit: "g" },
  { key: "fiber", label: "food_nut_fiber", unit: "g" },
  { key: "iron", label: "food_nut_iron", unit: "mg" },
  { key: "calcium", label: "food_nut_calcium", unit: "mg" },
  { key: "vitC", label: "food_nut_vitc", unit: "mg" },
];

/** Numrat si i shkruan gjuha: presje dhjetore në shqip. Mbi 10 pa dhjetore; një vlerë e vogël por jo zero: "<0,1". */
export function formatAmount(v: number | null, lang: string, digits: 0 | 1 = 1): string {
  if (v == null) return "–";
  const rounded = v >= 10 || digits === 0 ? Math.round(v) : Math.round(v * 10) / 10;
  if (rounded === 0 && v > 0) return lang === "sq" ? "<0,1" : "<0.1";
  const s = String(rounded);
  return lang === "sq" ? s.replace(".", ",") : s;
}

/** "≈ 15–45 g për vakt". */
export function usePortionText(): (p: Portion) => string {
  const { t } = useTranslation();
  return (p) => (p.min === p.max ? t("food_portion_one", { n: p.min, unit: p.unit }) : t("food_portion", { min: p.min, max: p.max, unit: p.unit }));
}

/**
 * Vlerat ushqyese për 100 g dhe, kur dihet mosha, për një vakt të moshës (mesi i racionit). Pa vlera (ushqim i
 * shtuar nga paneli): s'del asgjë.
 */
export function NutritionTable({ food, band }: { food: Pick<Food, "foodKey" | "category" | "ageFromMonths">; band: ServeKey | null }) {
  const { t, lang } = useTranslation();
  const c = useThemeColors();
  const data = nutritionFor(food.foodKey);
  if (!data) return null;
  const portion = band ? portionFor(food, band) : null;
  const grams = portion ? typicalGrams(portion) : null;
  const meal = grams ? scaleNutrition(data.per100g, grams) : null;

  return (
    <View>
      <View className="flex-row items-end border-b border-cream-line pb-2">
        <Text className="flex-1 font-body text-[12.5px] text-ink-soft">{t(FORM[data.form])}</Text>
        <Text className="w-[72px] text-right font-bodySemibold text-[12.5px] text-ink-soft">100 g</Text>
        {meal && portion ? (
          <Text className="w-[92px] text-right font-bodySemibold text-[12.5px] text-olive" numberOfLines={2}>
            {t("food_portion_col", { n: grams!, unit: portion.unit })}
          </Text>
        ) : null}
      </View>
      {ROWS.map((row, i) => (
        <View
          key={row.key}
          accessible
          accessibilityLabel={[t(row.label), `100 g: ${formatAmount(data.per100g[row.key], lang, row.key === "kcal" ? 0 : 1)} ${row.unit}`, meal ? `${formatAmount(meal[row.key], lang, row.key === "kcal" ? 0 : 1)} ${row.unit}` : ""].filter(Boolean).join(", ")}
          className="flex-row items-center py-2"
          style={{ borderBottomWidth: i < ROWS.length - 1 ? 1 : 0, borderColor: c.creamLine }}
        >
          <Text className="flex-1 font-body text-[14px] text-ink">{t(row.label)}</Text>
          <Text className="w-[72px] text-right font-bodyMedium text-[14px] text-ink">
            {formatAmount(data.per100g[row.key], lang, row.key === "kcal" ? 0 : 1)} <Text className="font-body text-[12px] text-ink-faint">{row.unit}</Text>
          </Text>
          {meal ? (
            <Text className="w-[92px] text-right font-bodySemibold text-[14px] text-olive">
              {formatAmount(meal[row.key], lang, row.key === "kcal" ? 0 : 1)} <Text className="font-body text-[12px] text-ink-faint">{row.unit}</Text>
            </Text>
          ) : null}
        </View>
      ))}
      <Text className="mt-2 font-body text-[12px] leading-[17px] text-ink-faint">{t("food_nutrition_source")}</Text>
    </View>
  );
}
