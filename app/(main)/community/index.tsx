import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, FlatList, RefreshControl, Pressable, TextInput, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { useAppState } from "@/lib/state/AppStateContext";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { Icon } from "@/components/ui/Icon";
import { useThemeColors } from "@/lib/theme/useThemeColors";
import { shadows } from "@/lib/shadows";
import { PostCard } from "@/components/community/PostCard";
import { DailyQuestionCard } from "@/components/community/DailyQuestionCard";
import { logWarn } from "@/lib/log";
import { useSpecialties } from "@/lib/community/useSpecialties";
import { specialtyLabel } from "@/lib/community/specialties";
import {
  fetchGroups, fetchExperts, fetchTopics, fetchTips, fetchFeed, fetchNewestPostAt, FEED_PAGE_SIZE,
  CommunityGroup, CommunityExpert, CommunityTopic, CommunityTip, CommunityPost, FeedTab,
} from "@/lib/communityData";

/**
 * Ky ekran ka një punë të vetme: të lexosh çfarë shkruajnë prindërit dhe mjekët dhe të shkruash vetë. Gjithçka tjetër
 * (ekspertët, grupet, të ruajtura, profili) është navigim dytësor.
 *
 * Si te Facebook-u dhe Instagrami: tërhiq poshtë nga maja për ta rifreskuar, skeda "Për ty / Të ndjekurit / Ekspertët",
 * "Postime të reja ↑" kur dikush ka postuar ndërkohë, dhe kërkimi/filtri hapen te serveri (jo vetëm mes postimeve të ngarkuara).
 */

/** Sa shpesh kontrollohet për postime të reja kur ekrani është i hapur. */
const NEW_POSTS_POLL_MS = 60_000;
/** Pritja pas shkrimit të fundit, para se të nisë kërkimi. */
const SEARCH_DEBOUNCE_MS = 350;

type Filters = { tab: FeedTab; topic: string | null; specialty: string | null; query: string };
const NO_FILTERS: Filters = { tab: "all", topic: null, specialty: null, query: "" };

function FilterChip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      className={`rounded-full px-3.5 py-1.5 mr-2 ${selected ? "bg-ink" : "bg-cream-soft"}`}
    >
      <Text className={`font-bodyMedium text-xs ${selected ? "text-on-accent" : "text-ink-soft"}`}>{label}</Text>
    </Pressable>
  );
}

function tipOfDay(tips: CommunityTip[]): CommunityTip | null {
  if (tips.length === 0) return null;
  const dayIndex = Math.floor(Date.now() / 86400000);
  return tips[dayIndex % tips.length];
}

export default function CommunityScreen() {
  const router = useRouter();
  const { state } = useAppState();
  const { t, language } = useTranslation();
  const theme = useThemeColors();
  const specialties = useSpecialties();
  const listRef = useRef<FlatList<CommunityPost>>(null);

  const [filters, setFiltersState] = useState<Filters>(NO_FILTERS);
  const { tab, topic, specialty, query } = filters;
  const [queryInput, setQueryInput] = useState("");

  const [groups, setGroups] = useState<CommunityGroup[]>([]);
  const [experts, setExperts] = useState<CommunityExpert[]>([]);
  const [topics, setTopics] = useState<CommunityTopic[]>([]);
  const [tips, setTips] = useState<CommunityTip[]>([]);
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [feedLoading, setFeedLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [failed, setFailed] = useState(false);
  const [newPosts, setNewPosts] = useState(false);
  // Rifreskon "Pyetjen e ditës" bashkë me rrjedhën (tërhiqje poshtë, kthim te skeda).
  const [questionKey, setQuestionKey] = useState(0);

  // Filtrat aktualë, të lexueshëm nga funksionet e qëndrueshme (pa i rikrijuar sa herë shkruan një shkronjë).
  // Ndryshohen vetëm nga `changeFilters`, ndaj ky ref është gjithmonë i njëjtë me gjendjen `filters`.
  const filtersRef = useRef<Filters>(NO_FILTERS);
  // Çdo ngarkim ka numrin e vet: përgjigjja e vonuar e një filtri të vjetër nuk e mbulon atë të ri.
  const seq = useRef(0);
  const postsRef = useRef<CommunityPost[]>([]);
  useEffect(() => {
    postsRef.current = posts;
  }, [posts]);

  const loadStatic = useCallback(async () => {
    try {
      const [g, e, tp, ti] = await Promise.all([fetchGroups(), fetchExperts(), fetchTopics(), fetchTips()]);
      setGroups(g); setExperts(e); setTopics(tp); setTips(ti);
    } catch (err) {
      logWarn("Community static load error:", err);
    }
  }, []);

  /**
   * Faqja e parë e rrjedhës.
   *  - `reset`: zëvendëson listën (filtër i ri, ose tërheqje poshtë), jo bashkim me ato të vjetrat të ngarkuara më parë.
   *  - `spinner`: fsheh listën dhe tregon rrotën gjatë ngarkimit (filtër i ri).
   */
  const reload = useCallback(async ({ reset, spinner }: { reset: boolean; spinner: boolean }) => {
    const mine = ++seq.current;
    if (spinner) setFeedLoading(true);
    try {
      const f = filtersRef.current;
      const page = await fetchFeed({ tab: f.tab, topic: f.topic, query: f.query, specialty: f.specialty });
      if (mine !== seq.current) return;
      setFailed(false);
      setNewPosts(false);
      setPosts((prev) => {
        // Kthimi te ekrani rifreskon faqen e parë, por s'i hedh postimet më të vjetra që prindi kishte ngarkuar tashmë.
        if (reset || page.length < FEED_PAGE_SIZE) return page;
        const oldest = new Date(page[page.length - 1].at).getTime();
        return [...page, ...prev.filter((x) => new Date(x.at).getTime() < oldest)];
      });
      setHasMore((prev) => (reset ? page.length >= FEED_PAGE_SIZE : page.length < FEED_PAGE_SIZE ? false : prev));
    } catch (err) {
      if (mine !== seq.current) return;
      logWarn("Community feed load error:", err);
      // Nëse ka tashmë postime në ekran, mbeten; gabimi tregohet vetëm kur s'ka çfarë të shihet.
      if (reset || postsRef.current.length === 0) setFailed(true);
    } finally {
      if (mine === seq.current) setFeedLoading(false);
    }
  }, []);

  // Filtër i ri (skedë, temë, reparte, kërkim) -> faqe e re e rrjedhës.
  const changeFilters = useCallback(
    (patch: Partial<Filters>) => {
      const next = { ...filtersRef.current, ...patch };
      filtersRef.current = next;
      setFiltersState(next);
      void reload({ reset: true, spinner: true });
    },
    [reload]
  );

  // Kërkimi nis pak pas shkrimit të fundit.
  useEffect(() => {
    const id = setTimeout(() => {
      if (queryInput.trim() !== filtersRef.current.query) changeFilters({ query: queryInput.trim() });
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [queryInput, changeFilters]);

  const loadMore = useCallback(async () => {
    const list = postsRef.current;
    if (feedLoading || loadingMore || !hasMore || list.length === 0) return;
    const mine = seq.current;
    setLoadingMore(true);
    try {
      const f = filtersRef.current;
      const next = await fetchFeed({ before: list[list.length - 1].at, tab: f.tab, topic: f.topic, query: f.query, specialty: f.specialty });
      if (mine !== seq.current) return;
      setPosts((prev) => {
        const seen = new Set(prev.map((x) => x.id));
        return [...prev, ...next.filter((x) => !seen.has(x.id))];
      });
      if (next.length < FEED_PAGE_SIZE) setHasMore(false);
    } catch (err) {
      logWarn("Community load more error:", err);
    } finally {
      setLoadingMore(false);
    }
  }, [feedLoading, hasMore, loadingMore]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setQuestionKey((k) => k + 1);
    await Promise.all([loadStatic(), reload({ reset: true, spinner: false })]);
    setRefreshing(false);
  }, [loadStatic, reload]);

  // Postime të reja: kontrollohet pak herë, vetëm kur skeda "Për ty" është pa filtra, dhe vetëm për kohën e postimit më të ri.
  const checkNewPosts = useCallback(async () => {
    const f = filtersRef.current;
    if (f.tab !== "all" || f.topic || f.query || f.specialty) return;
    const top = postsRef.current[0]?.at;
    if (!top) return;
    try {
      const newest = await fetchNewestPostAt();
      if (newest && new Date(newest).getTime() > new Date(top).getTime()) setNewPosts(true);
    } catch {
      // pa internet: asgjë për t'u treguar
    }
  }, []);

  const firstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      // Hapja e parë ngarkon faqen e parë me rrotë; kthimi nga "Shkruaj postim", nga një postim, etj. e rifreskon qetësisht.
      void reload(firstFocus.current ? { reset: true, spinner: true } : { reset: false, spinner: false });
      // Grupet, ekspertët, temat dhe këshillat (numrat, "ndjekur") rifreskohen sa herë kthehesh këtu.
      void loadStatic();
      setQuestionKey((k) => k + 1);
      firstFocus.current = false;
      const id = setInterval(() => void checkNewPosts(), NEW_POSTS_POLL_MS);
      return () => clearInterval(id);
    }, [reload, loadStatic, checkNewPosts])
  );

  const showNewPosts = useCallback(() => {
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
    setNewPosts(false);
    void reload({ reset: true, spinner: false });
  }, [reload]);

  function pickTab(next: FeedTab) {
    if (next === tab) {
      listRef.current?.scrollToOffset({ offset: 0, animated: true });
      return;
    }
    changeFilters(next === "experts" ? { tab: next } : { tab: next, specialty: null });
  }

  const removePost = useCallback(
    (id: string, reason: "deleted" | "blocked") => {
      if (reason === "deleted") {
        setPosts((prev) => prev.filter((x) => x.id !== id));
        return;
      }
      // I bllokuari zhduket edhe nga postimet e vjetra të ngarkuara më parë, jo vetëm nga faqja e parë që rilexohet.
      setPosts((prev) => {
        const author = prev.find((x) => x.id === id)?.authorId;
        return prev.filter((x) => x.authorId !== author);
      });
      void reload({ reset: false, spinner: false });
    },
    [reload]
  );

  const filtering = query.trim().length > 0 || topic !== null || specialty !== null;
  const todayTip = useMemo(() => (tab === "all" && !filtering ? tipOfDay(tips) : null), [tips, tab, filtering]);

  // Repartet që kanë të paktën një ekspert (filtri sipas repartit nuk tregon reparte bosh); vetëm kur migrimi është aplikuar.
  const departments = useMemo(() => {
    if (!specialties.fromDb) return [];
    const present = new Set(experts.map((e) => e.specialty).filter((x): x is string => !!x));
    return specialties.list.filter((s) => present.has(s.key));
  }, [experts, specialties]);

  const tabs: { key: FeedTab; label: string }[] = [
    { key: "all", label: t("community_tab_foryou") },
    { key: "following", label: t("community_tab_following") },
    { key: "experts", label: t("community_tab_experts") },
  ];

  const header = (
    <View>
      {/* Pyetja e ditës: arsye për të hyrë pa shkruar postim të gjatë (vetëm te "Për ty", pa filtra). */}
      {tab === "all" && !filtering ? (
        <View className="-mt-4 mb-3">
          <DailyQuestionCard refreshKey={questionKey} />
        </View>
      ) : null}

      <View className="px-5">
        <View className="flex-row items-center bg-surface border border-cream-line rounded-xl2 px-3.5 py-2.5">
          <Icon name="search" size={18} color={theme.inkFaint} />
          <TextInput
            value={queryInput}
            onChangeText={setQueryInput}
            placeholder={t("community_search_ph")}
            placeholderTextColor={theme.inkFaint}
            returnKeyType="search"
            autoCorrect={false}
            className="flex-1 ml-2 font-body text-sm text-ink"
          />
          {queryInput.length > 0 && (
            <Pressable onPress={() => { setQueryInput(""); changeFilters({ query: "" }); }} hitSlop={8} accessibilityLabel={t("community_clear_search")}>
              <Icon name="close" size={16} color={theme.inkFaint} />
            </Pressable>
          )}
        </View>
      </View>

      <View className="flex-row mx-5 mt-3 bg-cream-soft rounded-full p-1" accessibilityRole="tablist">
        {tabs.map((tb) => (
          <Pressable
            key={tb.key}
            onPress={() => pickTab(tb.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === tb.key }}
            className={`flex-1 py-2 rounded-full items-center ${tab === tb.key ? "bg-ink" : ""}`}
          >
            <Text className={`font-bodyMedium text-xs ${tab === tb.key ? "text-on-accent" : "text-ink-soft"}`}>{tb.label}</Text>
          </Pressable>
        ))}
      </View>

      {tab === "experts" && departments.length > 0 && (
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={departments}
          keyExtractor={(s) => s.key}
          contentContainerStyle={{ paddingHorizontal: 20 }}
          className="mt-3"
          ListHeaderComponent={<FilterChip label={t("community_all_depts")} selected={specialty === null} onPress={() => changeFilters({ specialty: null })} />}
          renderItem={({ item }) => (
            <FilterChip
              label={`${item.emoji} ${language === "en" ? item.labelEn : item.label}`}
              selected={specialty === item.key}
              onPress={() => changeFilters({ specialty: specialty === item.key ? null : item.key })}
            />
          )}
        />
      )}

      {topics.length > 0 && (
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={topics}
          keyExtractor={(tp) => tp.id}
          contentContainerStyle={{ paddingHorizontal: 20 }}
          className="mt-3"
          ListHeaderComponent={<FilterChip label={t("community_all")} selected={topic === null} onPress={() => changeFilters({ topic: null })} />}
          renderItem={({ item }) => (
            <FilterChip label={item.label} selected={topic === item.label} onPress={() => changeFilters({ topic: topic === item.label ? null : item.label })} />
          )}
        />
      )}

      {/* Këshilla e ditës — përmbajtje e redaksisë, jo e gjeneruar */}
      {todayTip && (
        <View style={shadows.soft} className="mx-5 mt-4 bg-surface rounded-xl2 p-4">
          <Text className="font-bodyMedium text-[10px] tracking-wide text-ink-faint mb-2">{t("community_tip_label").toUpperCase()}</Text>
          <Text className="font-bodySemibold text-sm text-ink mb-1">{todayTip.title}</Text>
          <Text className="font-body text-xs text-ink-soft leading-5">{todayTip.body}</Text>
        </View>
      )}

      <View className="h-4" />
    </View>
  );

  const empty = feedLoading ? (
    <ActivityIndicator className="text-olive my-10" />
  ) : failed ? (
    <View className="items-center px-10 py-8">
      <Text className="font-bodySemibold text-sm text-ink mb-1">{t("community_load_failed_title")}</Text>
      <Text className="font-body text-xs text-ink-soft text-center leading-5 mb-4">{t("community_load_failed_sub")}</Text>
      <Pressable onPress={() => void reload({ reset: true, spinner: true })} className="bg-olive px-5 py-2.5 rounded-full">
        <Text className="font-bodySemibold text-xs text-on-accent">{t("community_retry")}</Text>
      </Pressable>
    </View>
  ) : filtering ? (
    <Text className="font-body text-sm text-ink-soft px-5">
      {t("community_no_results", {
        query: query.trim() || topic || specialtyLabel(specialty, language, specialties.list) || "",
      })}
    </Text>
  ) : tab === "following" ? (
    <View className="items-center px-10 py-8">
      <Text className="font-bodySemibold text-sm text-ink mb-1">{t("community_following_empty_title")}</Text>
      <Text className="font-body text-xs text-ink-soft text-center leading-5 mb-4">{t("community_following_empty_sub")}</Text>
      <Pressable onPress={() => router.push("/community/explore")} className="bg-olive px-5 py-2.5 rounded-full">
        <Text className="font-bodySemibold text-xs text-on-accent">{t("community_find_experts")}</Text>
      </Pressable>
    </View>
  ) : (
    <View className="items-center px-10 py-8">
      <Text className="font-bodySemibold text-sm text-ink mb-1">{t("community_empty_title")}</Text>
      <Text className="font-body text-xs text-ink-soft text-center leading-5 mb-4">{t("community_empty_sub")}</Text>
      <Pressable onPress={() => router.push("/community/new")} className="bg-olive px-5 py-2.5 rounded-full">
        <Text className="font-bodySemibold text-xs text-on-accent">{t("community_post_btn")}</Text>
      </Pressable>
    </View>
  );

  const footer = (
    <View>
      {loadingMore && <ActivityIndicator className="text-olive my-4" />}
      {!hasMore && !feedLoading && posts.length > FEED_PAGE_SIZE / 2 && (
        <Text className="font-body text-xs text-ink-faint text-center my-4">{t("community_caught_up")}</Text>
      )}
      {/* Navigim dytësor, në fund: aty ku e kërkon kush e kërkon */}
      <Pressable onPress={() => router.push("/community/explore")} className="mx-5 mt-2 py-4 border-t border-cream-line flex-row items-center">
        <View className="flex-1">
          <Text className="font-bodyMedium text-sm text-ink">{t("community_experts_groups")}</Text>
          <Text className="font-body text-xs text-ink-faint mt-0.5">
            {t("community_experts_groups_sub", { experts: experts.length, groups: groups.length })}
          </Text>
        </View>
        <Icon name="chevronRight" size={18} color={theme.inkFaint} />
      </Pressable>
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      {/* Titulli dhe dy hyrje të qeta: të ruajturat, profili im */}
      <View className="flex-row items-center justify-between px-5 pt-2 pb-3">
        <Text className="font-display text-2xl text-ink">{t("community_title")}</Text>
        <View className="flex-row items-center">
          <Pressable
            onPress={() => router.push("/community/saved")}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={t("community_saved_title")}
            className="w-10 h-10 items-center justify-center"
          >
            <Icon name="bookmark" size={20} color={theme.inkSoft} />
          </Pressable>
          <Pressable
            onPress={() => router.push("/community/profile")}
            accessibilityRole="button"
            accessibilityLabel={t("community_profile_title")}
            className="w-9 h-9 rounded-full bg-olive-bg items-center justify-center ml-1"
          >
            <Text className="font-bodySemibold text-sm text-olive">
              {(state.profile.parentName || "T").trim().charAt(0).toUpperCase()}
            </Text>
          </Pressable>
        </View>
      </View>

      <FlatList
        ref={listRef}
        data={feedLoading || failed ? [] : posts}
        keyExtractor={(p) => p.id}
        renderItem={({ item }) => (
          <PostCard post={item} onOpen={() => router.push(`/community/post/${item.id}`)} onRemoved={removePost} />
        )}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        ListFooterComponent={footer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.olive}
            colors={[theme.olive]}
            progressBackgroundColor={theme.surface}
          />
        }
        onEndReached={() => void loadMore()}
        onEndReachedThreshold={0.6}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 96 }}
        initialNumToRender={6}
        windowSize={7}
      />

      {newPosts && (
        <View pointerEvents="box-none" className="absolute top-24 left-0 right-0 items-center">
          <Pressable
            onPress={showNewPosts}
            style={shadows.softLg}
            accessibilityRole="button"
            className="flex-row items-center bg-ink rounded-full px-4 py-2"
          >
            <Text className="font-bodySemibold text-xs text-on-accent">↑ {t("community_new_posts")}</Text>
          </Pressable>
        </View>
      )}

      <Pressable
        onPress={() => router.push("/community/new")}
        style={shadows.softLg}
        accessibilityRole="button"
        accessibilityLabel={t("community_post_btn")}
        className="absolute bottom-4 right-5 w-14 h-14 rounded-full bg-olive items-center justify-center"
      >
        <Icon name="plus" size={24} color={theme.onAccent} />
      </Pressable>
    </SafeAreaView>
  );
}
