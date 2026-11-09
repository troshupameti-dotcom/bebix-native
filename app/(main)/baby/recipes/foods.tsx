import { useMemo, useState } from "react";
import { View, Text, TextInput, Pressable, FlatList, ScrollView, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { ChevronRight, Search, ShieldCheck, X } from "lucide-react-native";
import { BackButton } from "@/components/ui/BackButton";
import { Chip } from "@/components/stories/StoryParts";
import { CATEGORY_LABEL, CATEGORY_TONE, FoodAvatar, likingEmoji } from "@/components/recipes/FoodParts";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { useThemeColors } from "@/lib/theme/useThemeColors";
import { useTones } from "@/lib/theme/tone";
import { haptics } from "@/lib/haptics";
import { useFoods } from "@/lib/recipes/foods";
import { useCareAccess, useFoodTries } from "@/lib/recipes/foodTries";
import { allergenProgress, summarizeTries, triedFoodsCount } from "@/lib/recipes/firstFoods";
import { useRecipeChild } from "@/lib/recipes/useRecipeChild";
import { normalize } from "@/lib/recipes/catalog";
import { FOOD_CATEGORIES, type Food, type FoodCategory } from "@/lib/recipes/types";

const GAP = 10;
const MIN_TILE = 104;
const MAX_CONTENT = 1100;

/**
 * "Ushqimet e para 🥕": rrjeta me ushqimet; çdo ushqim i provuar ngjyroset. Numëruesi rritet vetëm (pa seri, pa
 * krahasime). Prekja hap si ta servirësh sipas moshës dhe recetat me të. Gjyshërit shohin udhëzuesin, por provat vetëm
 * kur prindërit ndajnë kujdesin.
 */
export default function FirstFoods() {
  const { t } = useTranslation();
  const c = useThemeColors();
  const tones = useTones();
  const { width } = useWindowDimensions();
  const foods = useFoods();
  const { tries } = useFoodTries();
  const access = useCareAccess();
  const child = useRecipeChild();
  const [category, setCategory] = useState<FoodCategory | null>(null);
  const [query, setQuery] = useState("");

  const padH = Math.max(20, Math.round((width - MAX_CONTENT) / 2));
  const inner = width - padH * 2;
  const columns = Math.max(3, Math.min(8, Math.floor((inner + GAP) / (MIN_TILE + GAP))));
  const tile = Math.floor((inner - GAP * (columns - 1)) / columns);

  const visibleTries = useMemo(() => (access.canSee ? tries : []), [access.canSee, tries]);
  const summary = useMemo(() => summarizeTries(visibleTries), [visibleTries]);
  const tried = triedFoodsCount(visibleTries);
  const introduced = useMemo(() => allergenProgress(visibleTries, foods).filter((p) => p.status === "introduced").length, [visibleTries, foods]);
  const list = useMemo(() => {
    const words = normalize(query).split(" ").filter(Boolean);
    return foods.filter((f) => (!category || f.category === category) && words.every((w) => normalize(f.name).includes(w)));
  }, [foods, category, query]);

  const open = (food: Food) => {
    haptics.tap();
    router.push({ pathname: "/(main)/baby/recipes/food/[key]", params: { key: food.foodKey } });
  };

  const header = (
    <View>
      <Text accessibilityRole="header" className="font-display text-[28px] leading-[35px] text-ink">
        {t("foods_title")}
      </Text>
      <Text className="mt-1 font-body text-[14px] leading-5 text-ink-soft">{t("foods_sub")}</Text>

      {access.canSee ? (
        <View className="mt-4 flex-row items-center rounded-3xl p-4" style={{ gap: 14, backgroundColor: tones.green.tintBg }}>
          <Text className="font-display text-[40px] leading-[46px]" style={{ color: tones.green.ink }}>
            {tried}
          </Text>
          <View className="flex-1">
            <Text className="font-bodySemibold text-[15px]" style={{ color: tones.green.ink }}>
              {tried === 1 ? t("foods_tried_one") : t("foods_tried_many")}
            </Text>
            <Text className="mt-0.5 font-body text-[13px] leading-[18px]" style={{ color: tones.green.ink }}>
              {t("foods_tried_hint")}
            </Text>
          </View>
        </View>
      ) : (
        <Text className="mt-3 rounded-2xl bg-cream-soft p-3.5 font-body text-[13px] leading-[19px] text-ink-soft">{t("foods_viewer_note")}</Text>
      )}

      <Pressable
        onPress={() => {
          haptics.tap();
          router.push("/(main)/baby/recipes/allergens");
        }}
        accessibilityRole="button"
        className="mt-3 flex-row items-center rounded-2xl border border-cream-line bg-surface px-4 py-3 active:opacity-80"
        style={{ gap: 12 }}
      >
        <ShieldCheck size={20} color={tones.purple.tint} />
        <View className="flex-1">
          <Text className="font-bodySemibold text-[15px] text-ink">{t("foods_plan_title")}</Text>
          <Text className="font-body text-[12.5px] text-ink-soft">{access.canSee ? t("foods_plan_progress", { n: introduced, total: 9 }) : t("foods_plan_sub")}</Text>
        </View>
        <ChevronRight size={18} color={c.inkFaint} />
      </Pressable>

      <View className="mt-4 flex-row items-center gap-2 rounded-2xl border border-ink/10 bg-surface px-3.5" style={{ minHeight: 46 }}>
        <Search size={16} color={c.inkFaint} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t("foods_search_ph")}
          placeholderTextColor={c.inkFaint}
          accessibilityLabel={t("foods_search_ph")}
          autoCorrect={false}
          className="flex-1 py-2.5 font-body text-[14.5px] text-ink"
        />
        {query ? (
          <Pressable onPress={() => setQuery("")} accessibilityRole="button" accessibilityLabel={t("recipes_clear_search")} hitSlop={10}>
            <X size={16} color={c.inkSoft} />
          </Pressable>
        ) : null}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4 mt-3" style={{ marginHorizontal: -padH }} contentContainerStyle={{ paddingHorizontal: padH, gap: 8 }}>
        <Chip label={t("recipes_all")} selected={!category} onPress={() => setCategory(null)} />
        {FOOD_CATEGORIES.map((k) => (
          <Chip key={k} label={t(CATEGORY_LABEL[k])} selected={category === k} onPress={() => setCategory(category === k ? null : k)} />
        ))}
      </ScrollView>
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top", "left", "right"]}>
      <View className="px-4 pb-1 pt-2">
        <BackButton fallback="/(main)/baby/recipes" />
      </View>
      <FlatList
        key={columns}
        data={list}
        numColumns={columns}
        keyExtractor={(f) => f.foodKey}
        ListHeaderComponent={header}
        ListEmptyComponent={<Text className="py-10 text-center font-body text-[14px] text-ink-soft">{t("foods_empty")}</Text>}
        columnWrapperStyle={columns > 1 ? { gap: GAP } : undefined}
        contentContainerStyle={{ paddingHorizontal: padH, paddingBottom: 32, gap: GAP }}
        renderItem={({ item }) => {
          const s = summary.get(item.foodKey);
          const tone = tones[CATEGORY_TONE[item.category]];
          const later = child.months != null && item.ageFromMonths > child.months;
          const status = s ? `${t(s.count === 1 ? "foods_times_one" : "foods_times", { n: s.count })} ${likingEmoji(s.lastLiking)}`.trim() : later ? t("foods_from_months", { n: item.ageFromMonths }) : "";
          return (
            <Pressable
              onPress={() => open(item)}
              accessibilityRole="button"
              accessibilityLabel={[item.name, s ? t("foods_a11y_tried", { n: s.count }) : later ? t("foods_from_months", { n: item.ageFromMonths }) : ""].filter(Boolean).join(", ")}
              className="items-center rounded-2xl px-1.5 py-3 active:opacity-80"
              style={{ width: tile, gap: 6, backgroundColor: s ? tone.tintBg : c.surface, borderWidth: s ? 0 : 1, borderColor: c.creamLine, opacity: later && !s ? 0.6 : 1 }}
            >
              <FoodAvatar food={item} size={44} />
              <Text numberOfLines={2} className="text-center font-bodyMedium text-[13px] leading-[17px] text-ink">
                {item.name}
              </Text>
              <Text numberOfLines={1} className="font-body text-[11.5px]" style={{ color: s ? tone.ink : c.inkFaint, minHeight: 15 }}>
                {status}
              </Text>
            </Pressable>
          );
        }}
      />
    </SafeAreaView>
  );
}
