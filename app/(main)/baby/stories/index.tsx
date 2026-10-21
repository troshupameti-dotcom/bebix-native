import { useCallback, useMemo, useState } from "react";
import { View, Text, TextInput, Pressable, FlatList, ScrollView, ActivityIndicator, RefreshControl, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Heart, Search, X } from "lucide-react-native";
import { BackButton } from "@/components/ui/BackButton";
import { CATEGORY_META, Chip, FeaturedCard, SectionTitle, StoryRow, StoryTile } from "@/components/stories/StoryParts";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { useThemeColors } from "@/lib/theme/useThemeColors";
import { useActiveChild } from "@/lib/age/useActiveChild";
import { useStoryIndex } from "@/lib/stories/useStoryIndex";
import { useStoryUserData } from "@/lib/stories/userData";
import { bandForMonths, filterStories, fitsBand } from "@/lib/stories/catalog";
import { AGE_BANDS, STORY_CATEGORIES, type AgeBand, type StoryCategory, type StoryMeta } from "@/lib/stories/types";
import type { TranslationKey } from "@/lib/i18n/translations";

const BAND_LABEL: Record<AgeBand, TranslationKey> = { "0-1": "stories_age_0_1", "1-3": "stories_age_1_3", "3-6": "stories_age_3_6" };

/**
 * Biblioteka e përrallave: kërkimi, mosha, kategoritë, të veçuarat, të lexuarat së fundmi dhe të preferuarat.
 * Lista është virtuale (FlatList), që të mbajë qindra përralla pa e rënduar telefonin.
 */
export default function StoriesLibrary() {
  const { t, lang } = useTranslation();
  const c = useThemeColors();
  const { width } = useWindowDimensions();
  const { months } = useActiveChild();
  const index = useStoryIndex();
  const user = useStoryUserData();

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<StoryCategory | null>(null);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  // Mosha e fëmijës aktiv si zgjedhje fillestare (edhe kur mosha mbërrin pas hapjes); prindi e ndërron ose e heq.
  const [chosenBand, setBand] = useState<AgeBand | null | undefined>(undefined);
  const band = chosenBand === undefined ? bandForMonths(months) : chosenBand;

  const bySlug = useMemo(() => new Map(index.stories.map((s) => [s.slug, s])), [index.stories]);
  const favoriteSet = useMemo(() => new Set(user.favorites), [user.favorites]);
  const browsing = !query.trim() && !category && !favoritesOnly;

  const results = useMemo(
    () => filterStories(index.stories, { query, category, band, only: favoritesOnly ? favoriteSet : null }),
    [index.stories, query, category, band, favoritesOnly, favoriteSet]
  );
  const featured = useMemo(() => index.stories.filter((s) => s.featured && (!band || fitsBand(s, band))), [index.stories, band]);
  const pick = (slugs: string[]) => slugs.map((s) => bySlug.get(s)).filter((s): s is StoryMeta => !!s).slice(0, 10);
  const recent = pick(user.recent);
  const favorites = pick(user.favorites);

  const open = useCallback((slug: string) => router.push({ pathname: "/(main)/baby/stories/[slug]", params: { slug } }), []);
  const countLabel = (n: number) => (n === 1 ? t("stories_count_one") : t("stories_count", { n }));
  const clearFilters = () => {
    setQuery("");
    setCategory(null);
    setFavoritesOnly(false);
    setBand(null);
  };

  const header = (
    <View>
      <View className="flex-row items-center gap-2 rounded-2xl border border-ink/10 bg-surface px-3.5" style={{ minHeight: 46 }}>
        <Search size={16} color={c.inkFaint} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t("stories_search_ph")}
          placeholderTextColor={c.inkFaint}
          accessibilityLabel={t("stories_search_ph")}
          returnKeyType="search"
          autoCorrect={false}
          className="flex-1 py-2.5 font-body text-[14.5px] text-ink"
        />
        {query ? (
          <Pressable onPress={() => setQuery("")} accessibilityRole="button" accessibilityLabel={t("stories_clear_search")} hitSlop={10}>
            <X size={16} color={c.inkSoft} />
          </Pressable>
        ) : null}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-5 mt-3" contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}>
        <Chip label={t("stories_age_all")} selected={!band} onPress={() => setBand(null)} />
        {(Object.keys(AGE_BANDS) as AgeBand[]).map((b) => (
          <Chip key={b} label={t(BAND_LABEL[b])} selected={band === b} onPress={() => setBand(band === b ? null : b)} />
        ))}
      </ScrollView>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-5 mt-2" contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}>
        <Chip
          label={t("stories_favorites")}
          icon={Heart}
          selected={favoritesOnly}
          onPress={() => {
            setFavoritesOnly(!favoritesOnly);
            setCategory(null);
          }}
        />
        {STORY_CATEGORIES.map((cat) => (
          <Chip
            key={cat}
            label={t(CATEGORY_META[cat].label)}
            icon={CATEGORY_META[cat].icon}
            selected={category === cat}
            onPress={() => {
              setCategory(category === cat ? null : cat);
              setFavoritesOnly(false);
            }}
          />
        ))}
      </ScrollView>

      {lang === "en" ? <Text className="mt-3 font-body text-xs text-ink-faint">{t("stories_language_note")}</Text> : null}

      {index.loading ? null : browsing ? (
        <>
          {featured.length ? (
            <>
              <SectionTitle title={t("stories_featured")} />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-5" contentContainerStyle={{ paddingHorizontal: 20, gap: 14 }}>
                {featured.map((s) => (
                  <FeaturedCard key={s.slug} story={s} width={Math.min(260, Math.round(width * 0.66))} onPress={open} />
                ))}
              </ScrollView>
            </>
          ) : null}
          {recent.length ? (
            <>
              <SectionTitle title={t("stories_recent")} />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-5" contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}>
                {recent.map((s) => (
                  <StoryTile key={s.slug} story={s} progress={user.progressOf(s.slug)} onPress={open} />
                ))}
              </ScrollView>
            </>
          ) : null}
          {favorites.length ? (
            <>
              <SectionTitle title={t("stories_favorites")} />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-5" contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}>
                {favorites.map((s) => (
                  <StoryTile key={s.slug} story={s} progress={user.progressOf(s.slug)} onPress={open} />
                ))}
              </ScrollView>
            </>
          ) : null}
          <SectionTitle title={t("stories_all")} sub={countLabel(results.length)} />
        </>
      ) : (
        <SectionTitle title={favoritesOnly ? t("stories_favorites") : category ? t(CATEGORY_META[category].label) : t("stories_results")} sub={countLabel(results.length)} />
      )}
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      <View className="flex-row items-center gap-3 px-4 pb-3 pt-2">
        <BackButton fallback="/(main)/baby" />
        <Text className="font-display text-xl text-ink" accessibilityRole="header">
          {t("stories_title")}
        </Text>
      </View>

      <FlatList
        data={index.loading ? [] : results}
        keyExtractor={(s) => s.slug}
        renderItem={({ item }) => <StoryRow story={item} favorite={favoriteSet.has(item.slug)} progress={user.progressOf(item.slug)} onPress={open} />}
        extraData={user}
        ListHeaderComponent={header}
        ListEmptyComponent={
          index.loading ? (
            <View className="items-center py-16">
              <ActivityIndicator color={c.inkSoft} accessibilityLabel={t("stories_loading")} />
            </View>
          ) : (
            <View className="items-center px-6 py-12">
              <Text className="text-center font-bodySemibold text-[15px] text-ink">
                {favoritesOnly && !query.trim() ? t("stories_favorites_empty_title") : t("stories_empty_title")}
              </Text>
              <Text className="mt-1.5 text-center font-body text-[13px] leading-5 text-ink-soft">
                {favoritesOnly && !query.trim() ? t("stories_favorites_empty_body") : t("stories_empty_body")}
              </Text>
              <Pressable onPress={clearFilters} accessibilityRole="button" className="mt-4 rounded-full bg-ink px-5 py-2.5" style={{ minHeight: 44, justifyContent: "center" }}>
                <Text className="font-bodyMedium text-[13px] text-cream">{t("stories_clear_filters")}</Text>
              </Pressable>
            </View>
          )
        }
        refreshControl={<RefreshControl refreshing={index.refreshing} onRefresh={index.refresh} tintColor={c.inkSoft} />}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        initialNumToRender={8}
        windowSize={7}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }}
      />
    </SafeAreaView>
  );
}
