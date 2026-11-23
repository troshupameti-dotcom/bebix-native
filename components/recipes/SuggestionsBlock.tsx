import { useMemo } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import { SectionTitle } from "@/components/stories/StoryParts";
import { RecipeCard } from "@/components/recipes/RecipeParts";
import { FoodPhoto } from "@/components/recipes/FoodParts";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { haptics } from "@/lib/haptics";
import { suggestFor } from "@/lib/recipes/suggestions";
import type { Allergen, Food, FoodTry, Recipe } from "@/lib/recipes/types";

const FOOD_TILE = 104;
const CARD = 150;

/**
 * "Sugjerime për Anën": ushqime të reja për këtë javë, receta me ushqimet që i njeh dhe receta me një ushqim të ri.
 * Sipas moshës dhe provave (`food_tries`); pa prova, vetëm ushqimet e reja dhe recetat me një ushqim. S'del para 6 muajsh.
 */
export function SuggestionsBlock({
  recipes,
  foods,
  tries,
  months,
  allergens,
  name,
  padH,
  favorites,
  onOpen,
}: {
  recipes: Recipe[];
  foods: Food[];
  tries: FoodTry[];
  months: number | null;
  allergens: Allergen[];
  name: string | null;
  padH: number;
  favorites: Set<string>;
  onOpen: (slug: string) => void;
}) {
  const { t } = useTranslation();
  const s = useMemo(() => suggestFor({ recipes, foods, tries, months, allergens }), [recipes, foods, tries, months, allergens]);
  if (!s.newFoods.length && !s.familiar.length && !s.oneNew.length) return null;

  const bleed = { marginHorizontal: -padH };
  const row = { paddingHorizontal: padH, gap: 12, paddingBottom: 6 };
  const openFood = (food: Food) => {
    haptics.tap();
    router.push({ pathname: "/(main)/recipes/food/[key]", params: { key: food.foodKey } });
  };

  return (
    <View>
      <SectionTitle title={name ? t("sugg_title_name", { name }) : t("sugg_title")} sub={t("sugg_sub")} />

      {s.newFoods.length ? (
        <>
          <Text className="mb-2 font-bodyMedium text-[13.5px] text-ink-soft">{t("sugg_new_foods")}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={bleed} contentContainerStyle={row}>
            {s.newFoods.map((food) => (
              <Pressable
                key={food.foodKey}
                onPress={() => openFood(food)}
                accessibilityRole="button"
                accessibilityLabel={`${food.name}, ${t("foods_from_months", { n: food.ageFromMonths })}`}
                style={{ width: FOOD_TILE }}
                className="active:opacity-80"
              >
                <View className="overflow-hidden rounded-2xl">
                  <FoodPhoto food={food} width={FOOD_TILE} height={FOOD_TILE} />
                </View>
                <Text className="mt-1.5 font-bodySemibold text-[13.5px] text-ink" numberOfLines={1}>
                  {food.name}
                </Text>
                <Text className="font-body text-[12px] text-ink-faint">{t("foods_from_months", { n: food.ageFromMonths })}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </>
      ) : null}

      {s.familiar.length ? (
        <>
          <Text className="mb-2 mt-4 font-bodyMedium text-[13.5px] text-ink-soft">{t("sugg_familiar", { n: s.triedCount })}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={bleed} contentContainerStyle={row}>
            {s.familiar.map((r) => (
              <RecipeCard key={r.slug} recipe={r} width={CARD} favorite={favorites.has(r.slug)} conflict={false} onPress={onOpen} />
            ))}
          </ScrollView>
        </>
      ) : null}

      {s.oneNew.length ? (
        <>
          <Text className="mb-2 mt-4 font-bodyMedium text-[13.5px] text-ink-soft">{t("sugg_one_new")}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={bleed} contentContainerStyle={row}>
            {s.oneNew.map(({ recipe, food }) => (
              <View key={recipe.slug} style={{ width: CARD }}>
                <RecipeCard recipe={recipe} width={CARD} favorite={favorites.has(recipe.slug)} conflict={false} onPress={onOpen} />
                <Text className="mt-0.5 font-bodyMedium text-[12px] text-olive" numberOfLines={1}>
                  {t("sugg_new_label", { food: food.name.toLocaleLowerCase("sq") })}
                </Text>
              </View>
            ))}
          </ScrollView>
        </>
      ) : null}
    </View>
  );
}
