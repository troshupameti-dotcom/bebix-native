import { useMemo, useState } from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { Info, Lightbulb, RefreshCw, ShieldAlert, ShieldCheck, Utensils } from "lucide-react-native";
import { BackButton } from "@/components/ui/BackButton";
import { AllergyWarning, RecipeRow, useRecipeText } from "@/components/recipes/RecipeParts";
import { CATEGORY_LABEL, FoodAvatar, FoodTrySheet, NUTRIENT_LABEL, ReactionCard, RISK_LABEL, likingEmoji, useFoodDate } from "@/components/recipes/FoodParts";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { useThemeColors } from "@/lib/theme/useThemeColors";
import { useTones } from "@/lib/theme/tone";
import { haptics } from "@/lib/haptics";
import { useFoods, findFood } from "@/lib/recipes/foods";
import { removeFoodTry, useCareAccess, useFoodTries } from "@/lib/recipes/foodTries";
import { alternativeRecipe, allergenProgress, recipesWithFood, serveKeyFor } from "@/lib/recipes/firstFoods";
import { useRecipes } from "@/lib/recipes/useRecipes";
import { useRecipeChild } from "@/lib/recipes/useRecipeChild";
import { useRecipeFavorites } from "@/lib/recipes/favorites";
import { allergyConflicts } from "@/lib/recipes/catalog";
import type { ServeByAge } from "@/lib/recipes/types";
import type { TranslationKey } from "@/lib/i18n/translations";

const SERVE: { key: keyof ServeByAge; label: TranslationKey }[] = [
  { key: "6-8", label: "recipes_serve_6_8" },
  { key: "9-11", label: "recipes_serve_9_11" },
  { key: "12+", label: "recipes_serve_12" },
];
const MAX_RECIPES = 6;

/**
 * Një ushqim: si ta servirësh sipas moshës (grupi i fëmijës i theksuar), rreziku i mbytjes, këshilla, recetat me të dhe
 * provat ("E provoi 5 herë"). Kur e fundit u refuzua: "Provoje sërish pas disa ditësh, në formë tjetër" me një recetë
 * tjetër. Gjyshërit shohin udhëzuesin; provat vetëm kur prindërit ndajnë kujdesin.
 */
export default function FoodDetail() {
  const { key } = useLocalSearchParams<{ key: string }>();
  const { t } = useTranslation();
  const c = useThemeColors();
  const tones = useTones();
  const text = useRecipeText();
  const date = useFoodDate();
  const foods = useFoods();
  const index = useRecipes();
  const { tries } = useFoodTries();
  const access = useCareAccess();
  const child = useRecipeChild();
  const favs = useRecipeFavorites();
  const [logging, setLogging] = useState(false);

  const food = useMemo(() => foods.find((f) => f.foodKey === key) ?? findFood(String(key ?? "")), [foods, key]);
  const mine = useMemo(() => (access.canSee && food ? tries.filter((x) => x.foodKey === food.foodKey) : []), [access.canSee, food, tries]);

  if (!food) {
    return (
      <SafeAreaView className="flex-1 bg-cream" edges={["top", "bottom"]}>
        <View className="px-4 pt-2">
          <BackButton fallback="/(main)/baby/recipes/foods" />
        </View>
        <Text className="mt-10 px-8 text-center font-bodySemibold text-[15px] text-ink">{t("foods_not_found")}</Text>
      </SafeAreaView>
    );
  }

  const months = child.months;
  const myServe = serveKeyFor(months);
  const last = mine[0] ?? null;
  const lastRefused = last?.liking === "refused";
  const reaction = mine.find((x) => x.reaction) ?? null;
  const withFood = recipesWithFood(index.recipes, food.foodKey, months).slice(0, MAX_RECIPES);
  const alternative = lastRefused ? alternativeRecipe(index.recipes, food.foodKey, months, last?.recipeSlug ?? null) : null;
  const conflicts = food.allergen && child.allergens.includes(food.allergen) ? [food.allergen] : [];
  const later = months != null && food.ageFromMonths > months;
  const planStep = food.allergen && access.canSee ? (allergenProgress(tries, foods).find((p) => p.allergen === food.allergen)?.nextStep ?? null) : null;
  const riskTone = food.chokingRisk === "high" ? tones.orange : food.chokingRisk === "medium" ? tones.amber : tones.green;

  const openRecipe = (slug: string) => {
    haptics.tap();
    router.push({ pathname: "/(main)/baby/recipes/[slug]", params: { slug } });
  };

  const box = (icon: React.ReactNode, title: string, body: React.ReactNode, bg?: string) => (
    <View className="mt-5 rounded-2xl p-4" style={{ backgroundColor: bg ?? c.surface, borderWidth: bg ? 0 : 1, borderColor: c.creamLine }}>
      <View className="mb-2 flex-row items-center" style={{ gap: 8 }}>
        {icon}
        <Text className="font-bodySemibold text-[15px] text-ink" accessibilityRole="header">
          {title}
        </Text>
      </View>
      {body}
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top", "bottom", "left", "right"]}>
      <View className="px-4 pb-2 pt-2">
        <BackButton fallback="/(main)/baby/recipes/foods" />
      </View>
      <ScrollView className="flex-1" contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 28, alignItems: "center" }}>
        <View style={{ width: "100%", maxWidth: 760 }}>
          <View className="flex-row items-center" style={{ gap: 14 }}>
            <FoodAvatar food={food} size={64} />
            <View className="flex-1">
              <Text accessibilityRole="header" className="font-display text-[28px] leading-[34px] text-ink">
                {food.name}
              </Text>
              <Text className="font-body text-[13.5px] text-ink-soft">{t(CATEGORY_LABEL[food.category])}</Text>
            </View>
          </View>

          <View className="mt-4 flex-row flex-wrap" style={{ gap: 6 }}>
            <Badge label={t("foods_from_months", { n: food.ageFromMonths })} bg={c.creamSoft} color={c.inkSoft} />
            <Badge label={t(RISK_LABEL[food.chokingRisk])} bg={riskTone.tintBg} color={riskTone.ink} />
            {food.allergen ? <Badge label={t("foods_allergen_badge", { allergen: text.allergen(food.allergen) })} bg={tones.purple.tintBg} color={tones.purple.ink} /> : null}
            {food.nutrients.map((n) => (
              <Badge key={n} label={t(NUTRIENT_LABEL[n])} bg={c.creamSoft} color={c.inkSoft} />
            ))}
          </View>

          {conflicts.length ? (
            <View className="mt-4">
              <AllergyWarning conflicts={conflicts} />
            </View>
          ) : null}
          {later ? <Text className="mt-4 rounded-2xl bg-cream-soft p-3.5 font-body text-[14px] leading-5 text-ink-soft">{t("foods_wait_age", { n: food.ageFromMonths })}</Text> : null}

          {/* Provat: vetëm prindërit, ose gjyshërit kur prindërit ndajnë kujdesin. */}
          {access.canSee ? (
            <View className="mt-5 rounded-2xl border border-cream-line bg-surface p-4">
              <Text className="font-bodySemibold text-[17px] text-ink">
                {mine.length ? t(mine.length === 1 ? "foods_times_one_long" : "foods_times_long", { n: mine.length }) : t("foods_not_tried")}
              </Text>
              <Text className="mt-1 font-body text-[13px] leading-[19px] text-ink-soft">{t("foods_times_hint")}</Text>
              {mine.length ? (
                <View className="mt-3" style={{ gap: 2 }}>
                  {mine.map((x) => (
                    <View key={x.id} className="flex-row items-center border-t border-cream-line py-2" style={{ gap: 10 }}>
                      <Text className="w-7 text-center" style={{ fontSize: 18 }}>
                        {likingEmoji(x.liking) || "·"}
                      </Text>
                      <Text className="flex-1 font-body text-[14px] text-ink">
                        {date(x.triedAt)}
                        {x.reaction ? <Text style={{ color: tones.orange.ink }}>{` · ${t("foods_reaction_short")}`}</Text> : null}
                      </Text>
                      {access.canWrite ? (
                        <Pressable
                          onPress={() => {
                            haptics.tap();
                            removeFoodTry(x.id);
                          }}
                          accessibilityRole="button"
                          accessibilityLabel={t("foods_remove_try_a11y", { date: date(x.triedAt) })}
                          hitSlop={8}
                          className="justify-center px-2"
                          style={{ minHeight: 36 }}
                        >
                          <Text className="font-bodyMedium text-[12.5px] text-ink-faint">{t("foods_remove_try")}</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          ) : null}

          {reaction && access.canSee ? (
            <View className="mt-4">
              <Text className="mb-2 font-bodyMedium text-[13.5px] text-ink-soft">{t("foods_reaction_on", { date: date(reaction.triedAt) })}</Text>
              <ReactionCard allergens={food.allergen ? [food.allergen] : []} canWrite={access.canWrite} />
            </View>
          ) : null}

          {/* E refuzoi: butë, me një recetë tjetër. */}
          {lastRefused && !reaction ? (
            <View className="mt-4 rounded-2xl p-4" style={{ backgroundColor: tones.blue.tintBg }}>
              <View className="flex-row items-center" style={{ gap: 8 }}>
                <RefreshCw size={16} color={tones.blue.tint} />
                <Text className="font-bodySemibold text-[15px]" style={{ color: tones.blue.ink }}>
                  {t("foods_retry_title")}
                </Text>
              </View>
              <Text className="mt-1.5 font-body text-[14px] leading-5" style={{ color: tones.blue.ink }}>
                {t("foods_retry_body")}
              </Text>
              {alternative ? (
                <View className="mt-3">
                  <Text className="mb-1.5 font-bodyMedium text-[12.5px]" style={{ color: tones.blue.ink }}>
                    {t("foods_retry_recipe")}
                  </Text>
                  <RecipeRow recipe={alternative} favorite={favs.isFavorite(alternative.slug)} conflicts={allergyConflicts(alternative, child.allergens)} onPress={openRecipe} />
                </View>
              ) : null}
            </View>
          ) : null}

          {box(
            <Utensils size={17} color={c.olive} />,
            t("recipes_serve"),
            <View style={{ gap: 10 }}>
              {SERVE.filter((g) => food.serveByAge[g.key]).map((g) => {
                const own = myServe === g.key;
                return (
                  <View key={g.key} className={`rounded-xl px-3 py-2.5 ${own ? "bg-cream-soft" : ""}`}>
                    <Text className={`font-bodySemibold text-[13px] ${own ? "text-olive" : "text-ink-soft"}`}>{t(g.label)}</Text>
                    <Text className="mt-0.5 font-body text-[15px] leading-[22px] text-ink">{food.serveByAge[g.key]}</Text>
                  </View>
                );
              })}
            </View>
          )}

          {food.chokingRisk !== "low"
            ? box(
                <ShieldAlert size={17} color={tones.orange.tint} />,
                t("recipes_choking_title"),
                <Text className="font-body text-[14.5px] leading-[21px]" style={{ color: tones.orange.ink }}>
                  {t(food.chokingRisk === "high" ? "foods_choking_high" : "foods_choking_medium")}
                </Text>,
                tones.orange.tintBg
              )
            : null}

          {food.tip ? box(<Lightbulb size={17} color={c.olive} />, t("foods_tip_title"), <Text className="font-body text-[15px] leading-[22px] text-ink">{food.tip}</Text>) : null}

          {food.allergen ? (
            <Pressable
              onPress={() => {
                haptics.tap();
                router.push("/(main)/baby/recipes/allergens");
              }}
              accessibilityRole="button"
              className="mt-5 flex-row items-start rounded-2xl p-4 active:opacity-80"
              style={{ gap: 10, backgroundColor: tones.purple.tintBg }}
            >
              <ShieldCheck size={18} color={tones.purple.tint} />
              <View className="flex-1">
                <Text className="font-bodySemibold text-[15px]" style={{ color: tones.purple.ink }}>
                  {t("foods_plan_title")}
                </Text>
                <Text className="mt-1 font-body text-[13.5px] leading-5" style={{ color: tones.purple.ink }}>
                  {t("recipes_allergen_note")}
                </Text>
              </View>
            </Pressable>
          ) : null}

          {withFood.length ? (
            <>
              <Text className="mb-2 mt-7 font-bodySemibold text-[17px] text-ink" accessibilityRole="header">
                {t("foods_recipes_with")}
              </Text>
              <View style={{ gap: 8 }}>
                {withFood.map((r) => (
                  <RecipeRow key={r.slug} recipe={r} favorite={favs.isFavorite(r.slug)} conflicts={allergyConflicts(r, child.allergens)} onPress={openRecipe} />
                ))}
              </View>
            </>
          ) : null}

          <View className="mt-6 flex-row" style={{ gap: 8 }}>
            <Info size={14} color={c.inkFaint} style={{ marginTop: 2 }} />
            <Text className="flex-1 font-body text-[12.5px] leading-[18px] text-ink-faint">{t("recipes_guidance_note")}</Text>
          </View>
        </View>
      </ScrollView>

      {access.canWrite ? (
        <View className="border-t border-ink/10 px-4 pb-2 pt-3">
          <Pressable
            onPress={() => {
              haptics.tap();
              setLogging(true);
            }}
            accessibilityRole="button"
            className="items-center justify-center rounded-full bg-ink"
            style={{ minHeight: 50 }}
          >
            <Text className="font-bodySemibold text-[15px] text-cream">{t("foods_log_try")}</Text>
          </Pressable>
        </View>
      ) : null}
      <FoodTrySheet food={food} visible={logging} onClose={() => setLogging(false)} step={planStep} />
    </SafeAreaView>
  );
}

function Badge({ label, bg, color }: { label: string; bg: string; color: string }) {
  return (
    <View className="rounded-full px-3 py-1.5" style={{ backgroundColor: bg }}>
      <Text className="font-bodyMedium text-[12.5px]" style={{ color }}>
        {label}
      </Text>
    </View>
  );
}
