import { useCallback, useMemo, useState } from "react";
import { View, Text, TextInput, Pressable, FlatList, ScrollView, RefreshControl, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Carrot, Clock, Heart, Search, ShieldCheck, Snowflake, X } from "lucide-react-native";
import { BackButton } from "@/components/ui/BackButton";
import { Chip, SectionTitle } from "@/components/stories/StoryParts";
import { MEAL_LABEL, RecipeCard, RecipeCover, RecipeRow, STAGE_LABEL, useRecipeText } from "@/components/recipes/RecipeParts";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { useThemeColors } from "@/lib/theme/useThemeColors";
import { haptics } from "@/lib/haptics";
import { useRecipes } from "@/lib/recipes/useRecipes";
import { useRecipeFavorites } from "@/lib/recipes/favorites";
import { useRecipeChild } from "@/lib/recipes/useRecipeChild";
import { useCareAccess, useFoodTries } from "@/lib/recipes/foodTries";
import { triedFoodsCount } from "@/lib/recipes/firstFoods";
import { useTones } from "@/lib/theme/tone";
import {
  allergyConflicts,
  bandForMonths,
  filterRecipes,
  recipeOfTheDay,
  RECIPE_AGE_BANDS,
  type RecipeAgeBand,
  type TimeFilter,
} from "@/lib/recipes/catalog";
import { MEAL_TYPES, RECIPE_STAGES, type Allergen, type FeedingStyle, type MealType, type Recipe, type RecipeStage } from "@/lib/recipes/types";
import type { TranslationKey } from "@/lib/i18n/translations";

const BAND_LABEL: Record<RecipeAgeBand, TranslationKey> = {
  "6-8": "recipes_age_6_8",
  "9-11": "recipes_age_9_11",
  "12-23": "recipes_age_12_23",
  "24-60": "recipes_age_24_60",
};
const TIME_LABEL: Record<TimeFilter, TranslationKey> = { "15": "recipes_time_15", "30": "recipes_time_30", nocook: "recipes_time_nocook" };
/** Alergjenët që dalin si "Pa [alergjen]" (ata që ka biblioteka). */
const WITHOUT: Allergen[] = ["milk", "egg", "wheat", "fish", "peanut", "sesame"];
const MAX_CONTENT = 1100;

/**
 * Recetat: lart receta e ditës për fëmijën aktiv, sipas moshës dhe alergjive, që prindi të dijë menjëherë çfarë të
 * gatuajë sot. Poshtë kërkimi, filtrat si çipa dhe seksionet. Mosha vendoset vetë nga fëmija aktiv dhe ndërrohet.
 */
export default function RecipesLibrary() {
  const { t } = useTranslation();
  const c = useThemeColors();
  const { width } = useWindowDimensions();
  const index = useRecipes();
  const favs = useRecipeFavorites();
  const child = useRecipeChild();
  const text = useRecipeText();
  const tones = useTones();
  const { tries } = useFoodTries();
  const access = useCareAccess();
  const tried = access.canSee ? triedFoodsCount(tries) : 0;
  const padH = Math.max(20, Math.round((width - MAX_CONTENT) / 2));

  const [query, setQuery] = useState("");
  const [chosenBand, setBand] = useState<RecipeAgeBand | null | undefined>(undefined);
  const band = chosenBand === undefined ? bandForMonths(child.months) : chosenBand;
  const [meal, setMeal] = useState<MealType | null>(null);
  const [time, setTime] = useState<TimeFilter | null>(null);
  const [stage, setStage] = useState<RecipeStage | null>(null);
  const [style, setStyle] = useState<FeedingStyle | null>(null);
  const [without, setWithout] = useState<Allergen[]>([]);
  const [avoidChild, setAvoidChild] = useState(false);
  const [freezer, setFreezer] = useState(false);
  const [seasonal, setSeasonal] = useState(false);
  const [albanian, setAlbanian] = useState(false);
  const [favoritesOnly, setFavoritesOnly] = useState(false);

  const favoriteSet = useMemo(() => new Set(favs.favorites), [favs.favorites]);
  const bySlug = useMemo(() => new Map(index.recipes.map((r) => [r.slug, r])), [index.recipes]);
  const excluded = useMemo(() => [...new Set([...without, ...(avoidChild ? child.allergens : [])])], [without, avoidChild, child.allergens]);
  const filtering = !!(query.trim() || meal || time || stage || style || excluded.length || freezer || seasonal || albanian || favoritesOnly);

  const results = useMemo(
    () =>
      filterRecipes(index.recipes, {
        query, band, meal, time, stage, style, without: excluded, freezer, seasonal, albanian,
        only: favoritesOnly ? favoriteSet : null,
        childAllergens: child.allergens,
      }),
    [index.recipes, query, band, meal, time, stage, style, excluded, freezer, seasonal, albanian, favoritesOnly, favoriteSet, child.allergens]
  );
  const forAge = useMemo(() => filterRecipes(index.recipes, { band, childAllergens: child.allergens }), [index.recipes, band, child.allergens]);
  const today = useMemo(
    () => (chosenBand === undefined ? recipeOfTheDay(index.recipes, child.months, child.allergens) : recipeOfTheDay(forAge, null, child.allergens)),
    [index.recipes, forAge, chosenBand, child.months, child.allergens]
  );
  const safe = (r: Recipe) => !allergyConflicts(r, child.allergens).length;
  const sections: { key: string; title: string; list: Recipe[] }[] = [
    { key: "fav", title: t("recipes_favorites"), list: favs.favorites.map((s) => bySlug.get(s)).filter((r): r is Recipe => !!r) },
    { key: "quick", title: t("recipes_quick"), list: forAge.filter((r) => r.prepMinutes + r.cookMinutes <= 15 && safe(r)) },
    { key: "batch", title: t("recipes_batch"), list: forAge.filter((r) => r.freezerFriendly && safe(r)) },
    { key: "albanian", title: t("recipes_albanian_kitchen"), list: forAge.filter((r) => r.isAlbanian && safe(r)) },
    { key: "iron", title: t("recipes_iron"), list: forAge.filter((r) => r.nutrients.includes("iron") && safe(r)) },
  ].filter((s) => s.list.length > 0);

  const open = useCallback((slug: string) => {
    haptics.tap();
    router.push({ pathname: "/(main)/baby/recipes/[slug]", params: { slug } });
  }, []);
  const bleed = { marginHorizontal: -padH };
  const rowPad = { paddingHorizontal: padH, gap: 8 };
  const countLabel = (n: number) => (n === 1 ? t("recipes_count_one") : t("recipes_count", { n }));
  const toggleWithout = (a: Allergen) => setWithout((prev) => (prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]));
  const clearFilters = () => {
    setQuery("");
    setMeal(null);
    setTime(null);
    setStage(null);
    setStyle(null);
    setWithout([]);
    setAvoidChild(false);
    setFreezer(false);
    setSeasonal(false);
    setAlbanian(false);
    setFavoritesOnly(false);
  };
  const ageLabel = band ? t(BAND_LABEL[band]) : t("recipes_age_all");
  const forLabel = child.name ? t("recipes_for", { name: child.name, age: ageLabel }) : t("recipes_for_age", { age: ageLabel });

  const header = (
    <View>
      <Text className="font-bodySemibold text-[15px] text-ink" accessibilityRole="header">
        {forLabel}
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-2" style={bleed} contentContainerStyle={rowPad}>
        <Chip label={t("recipes_age_all")} selected={!band} onPress={() => setBand(null)} />
        {(Object.keys(RECIPE_AGE_BANDS) as RecipeAgeBand[]).map((b) => (
          <Chip key={b} label={t(BAND_LABEL[b])} selected={band === b} onPress={() => setBand(band === b ? null : b)} />
        ))}
      </ScrollView>

      <View className="mt-3 flex-row items-center gap-2 rounded-2xl border border-ink/10 bg-surface px-3.5" style={{ minHeight: 46 }}>
        <Search size={16} color={c.inkFaint} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t("recipes_search_ph")}
          placeholderTextColor={c.inkFaint}
          accessibilityLabel={t("recipes_search_ph")}
          returnKeyType="search"
          autoCorrect={false}
          className="flex-1 py-2.5 font-body text-[14.5px] text-ink"
          style={{ width: "100%" }}
        />
        {query ? (
          <Pressable onPress={() => setQuery("")} accessibilityRole="button" accessibilityLabel={t("recipes_clear_search")} hitSlop={10}>
            <X size={16} color={c.inkSoft} />
          </Pressable>
        ) : null}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-3" style={bleed} contentContainerStyle={rowPad}>
        {MEAL_TYPES.map((m) => (
          <Chip key={m} label={t(MEAL_LABEL[m])} selected={meal === m} onPress={() => setMeal(meal === m ? null : m)} />
        ))}
        {(Object.keys(TIME_LABEL) as TimeFilter[]).map((k) => (
          <Chip key={k} label={t(TIME_LABEL[k])} icon={Clock} selected={time === k} onPress={() => setTime(time === k ? null : k)} />
        ))}
      </ScrollView>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-2" style={bleed} contentContainerStyle={rowPad}>
        <Chip label={t("recipes_favorites")} icon={Heart} selected={favoritesOnly} onPress={() => setFavoritesOnly(!favoritesOnly)} />
        {child.allergens.length ? (
          <Chip
            label={child.name ? t("recipes_avoid_child", { name: child.name }) : t("recipes_avoid_child_noname")}
            selected={avoidChild}
            onPress={() => setAvoidChild(!avoidChild)}
          />
        ) : null}
        {WITHOUT.map((a) => (
          <Chip key={a} label={t("recipes_without", { allergen: text.allergen(a) })} selected={without.includes(a)} onPress={() => toggleWithout(a)} />
        ))}
        <Chip label={t("recipes_freezer")} icon={Snowflake} selected={freezer} onPress={() => setFreezer(!freezer)} />
        <Chip label={t("recipes_seasonal")} selected={seasonal} onPress={() => setSeasonal(!seasonal)} />
        <Chip label={t("recipes_albanian")} selected={albanian} onPress={() => setAlbanian(!albanian)} />
      </ScrollView>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-2" style={bleed} contentContainerStyle={rowPad}>
        {RECIPE_STAGES.map((s) => (
          <Chip key={s} label={t(STAGE_LABEL[s])} selected={stage === s} onPress={() => setStage(stage === s ? null : s)} />
        ))}
        <Chip label={t("recipes_style_puree")} selected={style === "puree"} onPress={() => setStyle(style === "puree" ? null : "puree")} />
        <Chip label={t("recipes_style_blw")} selected={style === "blw"} onPress={() => setStyle(style === "blw" ? null : "blw")} />
      </ScrollView>

      {filtering ? (
        <SectionTitle title={favoritesOnly ? t("recipes_favorites") : t("recipes_results")} sub={countLabel(results.length)} />
      ) : (
        <>
          {today ? (
            <>
              <SectionTitle title={t("recipes_today")} />
              <Pressable onPress={() => open(today.slug)} accessibilityRole="button" accessibilityLabel={`${t("recipes_today")}: ${today.title}`} className="overflow-hidden rounded-3xl border border-cream-line bg-surface active:opacity-90">
                <RecipeCover recipe={today} style={{ width: "100%", height: Math.min(220, Math.round((width - padH * 2) * 0.5)) }} radius={0} />
                <View className="p-4">
                  <Text className="font-display text-[22px] leading-7 text-ink">{today.title}</Text>
                  <Text className="mt-1 font-body text-[13.5px] leading-5 text-ink-soft" numberOfLines={2}>
                    {today.summary}
                  </Text>
                  <Text className="mt-2 font-bodyMedium text-[12.5px] text-ink-faint">
                    {text.age(today)} · {text.time(today)}
                  </Text>
                </View>
              </Pressable>
            </>
          ) : null}
          {/* Ushqimet e para dhe plani i alergjenëve (Faza B). */}
          <View className="mt-4 flex-row" style={{ gap: 10 }}>
            <GuideTile
              icon={<Carrot size={20} color={tones.orange.tint} />}
              title={t("foods_title")}
              sub={tried ? (tried === 1 ? t("foods_tile_tried_one") : t("foods_tile_tried", { n: tried })) : t("foods_tile_sub")}
              onPress={() => {
                haptics.tap();
                router.push("/(main)/baby/recipes/foods");
              }}
            />
            <GuideTile
              icon={<ShieldCheck size={20} color={tones.purple.tint} />}
              title={t("foods_plan_title")}
              sub={t("foods_plan_tile_sub")}
              onPress={() => {
                haptics.tap();
                router.push("/(main)/baby/recipes/allergens");
              }}
            />
          </View>
          {sections.map((s) => (
            <View key={s.key}>
              <SectionTitle title={s.title} />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={bleed} contentContainerStyle={{ paddingHorizontal: padH, gap: 14, paddingBottom: 6 }}>
                {s.list.slice(0, 12).map((r) => (
                  <RecipeCard key={r.slug} recipe={r} width={150} favorite={favoriteSet.has(r.slug)} conflict={!safe(r)} onPress={open} />
                ))}
              </ScrollView>
            </View>
          ))}
          <SectionTitle title={t("recipes_all")} sub={countLabel(results.length)} />
        </>
      )}
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top", "left", "right"]}>
      <View className="flex-row items-center gap-3 pb-3 pt-2" style={{ paddingHorizontal: Math.max(16, padH - 4) }}>
        <BackButton fallback="/(main)/baby" />
        <View className="flex-1">
          <Text className="font-display text-xl text-ink" accessibilityRole="header">
            {t("recipes_title")}
          </Text>
          <Text className="font-body text-xs text-ink-soft" numberOfLines={1}>
            {t("recipes_sub")}
          </Text>
        </View>
      </View>

      <FlatList
        data={results}
        keyExtractor={(r) => r.slug}
        renderItem={({ item }) => <RecipeRow recipe={item} favorite={favoriteSet.has(item.slug)} conflicts={allergyConflicts(item, child.allergens)} onPress={open} />}
        extraData={favs.favorites}
        ListHeaderComponent={header}
        ListHeaderComponentStyle={{ marginBottom: 4 }}
        ListEmptyComponent={
          <View className="items-center px-6 py-12">
            <Text className="text-center font-bodySemibold text-[15px] text-ink">{favoritesOnly && !query.trim() ? t("recipes_favorites_empty_title") : t("recipes_empty_title")}</Text>
            <Text className="mt-1.5 text-center font-body text-[13px] leading-5 text-ink-soft">
              {favoritesOnly && !query.trim() ? t("recipes_favorites_empty_body") : t("recipes_empty_body")}
            </Text>
            <Pressable onPress={clearFilters} accessibilityRole="button" className="mt-4 justify-center rounded-full bg-ink px-5" style={{ minHeight: 44 }}>
              <Text className="font-bodyMedium text-[13px] text-cream">{t("recipes_clear_filters")}</Text>
            </Pressable>
          </View>
        }
        refreshControl={<RefreshControl refreshing={index.refreshing} onRefresh={index.refresh} tintColor={c.inkSoft} />}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        initialNumToRender={8}
        windowSize={7}
        contentContainerStyle={{ paddingHorizontal: padH, paddingBottom: 32 }}
      />
    </SafeAreaView>
  );
}

function GuideTile({ icon, title, sub, onPress }: { icon: React.ReactNode; title: string; sub: string; onPress: () => void }) {
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
