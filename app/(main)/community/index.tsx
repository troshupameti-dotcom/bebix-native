import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, FlatList, RefreshControl, Pressable, TextInput, ActivityIndicator, useWindowDimensions } from "react-native";
import { CloudOff, MessagesSquare, SearchX, Sprout, UserPlus } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useTabDoubleTap } from "@/lib/navigation/useTabDoubleTap";
import { useAppState } from "@/lib/state/AppStateContext";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { Icon } from "@/components/ui/Icon";
import { useThemeColors } from "@/lib/theme/useThemeColors";
import { shadows } from "@/lib/shadows";
import { PostCard } from "@/components/community/PostCard";
import { SuggestedGroupsCard } from "@/components/community/SuggestedGroupsCard";
import { ComposerPrompt, FeedEmpty, FeedSkeleton } from "@/components/community/FeedParts";
import { useCurrentUserId } from "@/lib/hooks/useCurrentUserId";
import { logWarn } from "@/lib/log";
import { useSpecialties } from "@/lib/community/useSpecialties";
import { specialtyLabel } from "@/lib/community/specialties";
import { fetchInbox, setMyCommunityName } from "@/lib/community/messages";
import { useActiveChild } from "@/lib/age/useActiveChild";
import { hasFeature } from "@/lib/age/stageConfig";
import { useScreenshotMode } from "@/lib/demo/screenshotMode";
import { DEMO_PARENT_NAME } from "@/lib/demo/communityDemo";
import {
  fetchGroups, fetchExperts, fetchTopics, fetchTips, fetchFeed, fetchNewestPostAt, fetchAgeGroup, FEED_PAGE_SIZE,
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
/** Pas kaq pikash rrëshqitjeje fusha "Ndaj diçka…" ka dalë nga ekrani: atëherë del butoni rrethor i shkrimit. */
const FAB_AFTER = 260;
/** Pritja pas shkrimit të fundit, para se të nisë kërkimi. */
const SEARCH_DEBOUNCE_MS = 350;

type Filters = { tab: FeedTab; topic: string | null; specialty: string | null; query: string; ageGroupId: string | null };
const NO_FILTERS: Filters = { tab: "all", topic: null, specialty: null, query: "", ageGroupId: null };

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
  const { width: winWidth } = useWindowDimensions();
  const specialties = useSpecialties();
  const listRef = useRef<FlatList<CommunityPost>>(null);
  const myId = useCurrentUserId();
  const [scrolled, setScrolled] = useState(false);

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
  // Inbox-i: shfaqet vetëm kur migrimi është në server; pika kur ka të palexuara.
  const [inbox, setInbox] = useState<{ available: boolean; unread: boolean }>({ available: false, unread: false });
  useEffect(() => {
    let alive = true;
    void fetchInbox()
      .then((r) => alive && setInbox({ available: r.available, unread: r.rows.some((x) => x.unread) }))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [questionKey]);
  // Emri im publik (për profilin dhe bisedat), sipas emrit te profili.
  const parentName = state.profile.parentName ?? "";
  useEffect(() => {
    if (inbox.available && parentName.trim()) void setMyCommunityName(parentName).catch(() => {});
  }, [inbox.available, parentName]);

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
      const page = await fetchFeed({ tab: f.tab, topic: f.topic, query: f.query, specialty: f.specialty, ageGroupId: f.ageGroupId });
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

  // Feed-i sipas moshës: skeda e dytë, pas "Të gjitha" (që hapet e para). Kur ndërrohet fëmija, kalon te grupi i tij.
  // Pa grup (13+ vjeç, ose grupi s'ekziston në server): skeda s'shfaqet.
  const { stage, ageGroupKey } = useActiveChild();
  const ageFeedKey = hasFeature(stage, "communityAgeFeed") ? ageGroupKey : null;
  const [ageGroup, setAgeGroup] = useState<CommunityGroup | null>(null);
  useEffect(() => {
    let alive = true;
    void (ageFeedKey ? fetchAgeGroup(ageFeedKey) : Promise.resolve(null))
      .catch(() => null)
      .then((g) => {
        if (!alive) return;
        setAgeGroup(g);
        const f = filtersRef.current;
        if (g && f.tab === "age" && f.ageGroupId !== g.id) changeFilters({ ageGroupId: g.id });
        else if (!g && f.tab === "age") changeFilters({ tab: "all", ageGroupId: null });
      });
    return () => {
      alive = false;
    };
  }, [ageFeedKey, changeFilters]);

  // Hapur nga `#tema` e një postimi në një ekran tjetër (profili, postimi): feed-i me atë temë.
  const { topic: topicParam } = useLocalSearchParams<{ topic?: string }>();
  useEffect(() => {
    if (topicParam && topicParam !== filtersRef.current.topic) {
      changeFilters({ tab: "all", topic: topicParam, specialty: null, ageGroupId: null });
    }
  }, [topicParam, changeFilters]);

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
      const next = await fetchFeed({
        before: list[list.length - 1].at, tab: f.tab, topic: f.topic, query: f.query, specialty: f.specialty, ageGroupId: f.ageGroupId,
      });
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

  // Tab-i i Komunitetit: një prekje të kthen te faqja ashtu siç ishte; dy prekje të çojnë në krye dhe e rifreskojnë.
  useTabDoubleTap(() => {
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
    void onRefresh();
  });

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

  // Mënyra e fotografimit (Cilësimet, vetëm në zhvillim) ndërron burimin e postimeve: lista ngarkohet nga e para.
  const shots = useScreenshotMode();
  const lastShots = useRef(shots);
  useEffect(() => {
    if (lastShots.current === shots) return;
    lastShots.current = shots;
    void reload({ reset: true, spinner: true });
  }, [shots, reload]);

  const myInitial = ((shots ? DEMO_PARENT_NAME : state.profile.parentName) || "T").trim().charAt(0).toUpperCase();

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
    const ageGroupId = next === "age" ? ageGroup?.id ?? null : null;
    changeFilters(next === "experts" ? { tab: next, ageGroupId } : { tab: next, specialty: null, ageGroupId });
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

  // Në telefonat e ngushtë (≤ 340 pt) emrat e skedave dalin më të vegjël, që të mos priten ("Për mos…").
  const tabFont = winWidth <= 340 ? "text-[12.5px]" : "text-[14px]";
  const tabs: { key: FeedTab; label: string }[] = [
    { key: "all", label: ageGroup ? t("community_tab_all") : t("community_tab_foryou") },
    ...(ageGroup ? [{ key: "age" as FeedTab, label: t("community_tab_age") }] : []),
    { key: "following", label: t("community_tab_following") },
    { key: "experts", label: t("community_tab_experts") },
  ];

  const header = (
    <View>
      {/* Vetëm te "Për ty", pa filtra. */}
      {(tab === "all" || tab === "age") && !filtering ? (
        <View className="mt-3">
          {/* Shkrimi nis aty ku nis leximi. */}
          <ComposerPrompt
            initial={myInitial}
            userId={myId}
            placeholder={t("community_composer_ph")}
            photoLabel={t("community_composer_photo")}
            onPress={() => router.push("/community/new")}
          />
          {/* Grupe për bebin tënd: sugjerim sipas moshës dhe kohës së lindjes. */}
          <SuggestedGroupsCard refreshKey={questionKey} />
        </View>
      ) : null}

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
    <FeedSkeleton />
  ) : failed ? (
    <FeedEmpty icon={CloudOff} title={t("community_load_failed_title")} sub={t("community_load_failed_sub")} action={t("community_retry")} onAction={() => void reload({ reset: true, spinner: true })} />
  ) : filtering ? (
    <FeedEmpty
      icon={SearchX}
      title={t("community_no_results", { query: query.trim() || topic || specialtyLabel(specialty, language, specialties.list) || "" })}
      sub={t("community_no_results_sub")}
      action={t("community_clear_filters")}
      onAction={() => {
        setQueryInput("");
        changeFilters({ query: "", topic: null, specialty: null });
      }}
    />
  ) : tab === "age" ? (
    <FeedEmpty icon={Sprout} title={t("community_age_empty_title")} sub={t("community_age_empty_sub")} action={t("community_see_all")} onAction={() => pickTab("all")} />
  ) : tab === "following" ? (
    <FeedEmpty icon={UserPlus} title={t("community_following_empty_title")} sub={t("community_following_empty_sub")} action={t("community_find_experts")} onAction={() => router.push("/community/explore")} />
  ) : (
    <FeedEmpty icon={MessagesSquare} title={t("community_empty_title")} sub={t("community_empty_sub")} action={t("community_post_btn")} onAction={() => router.push("/community/new")} />
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
          {inbox.available ? (
            <Pressable
              onPress={() => router.push("/community/inbox")}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel={inbox.unread ? t("dm_inbox_unread_a11y") : t("dm_inbox")}
              className="w-10 h-10 items-center justify-center"
            >
              <Icon name="send" size={20} color={theme.inkSoft} />
              {inbox.unread ? <View className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full bg-orange" /> : null}
            </Pressable>
          ) : null}
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
              {myInitial}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Kërkimi lart, nën titull: gjithmonë i dukshëm, edhe kur rrjedha zbret poshtë. I hollë (rreth 38 pt), që të mos
          zërë vend; pa mbushjen e brendshme të Android-it, që e bënte më të trashë se te iPhone. */}
      <View className="pb-2">
        <View className="px-5">
          <View className="flex-row items-center bg-surface border border-cream-line rounded-xl px-3" style={{ height: 38 }}>
            <Icon name="search" size={16} color={theme.inkFaint} />
            <TextInput
              value={queryInput}
              onChangeText={setQueryInput}
              placeholder={t("community_search_ph")}
              placeholderTextColor={theme.inkFaint}
              returnKeyType="search"
              autoCorrect={false}
              className="flex-1 ml-2 font-body text-[13.5px] text-ink"
              style={{ paddingVertical: 0 }}
            />
            {queryInput.length > 0 && (
              <Pressable onPress={() => { setQueryInput(""); changeFilters({ query: "" }); }} hitSlop={8} accessibilityLabel={t("community_clear_search")}>
                <Icon name="close" size={16} color={theme.inkFaint} />
              </Pressable>
            )}
          </View>
        </View>
      </View>

      {/* Skedat rrinë të ngulura: duken gjithmonë, edhe kur rrjedha ka zbritur poshtë. Vija nën skedën e zgjedhur. */}
      <View className="flex-row border-b border-cream-line px-3" accessibilityRole="tablist">
        {tabs.map((tb) => {
          const on = tab === tb.key;
          return (
            <Pressable key={tb.key} onPress={() => pickTab(tb.key)} accessibilityRole="tab" accessibilityState={{ selected: on }} className="flex-1 items-center pt-1" style={{ minHeight: 44 }}>
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} className={`py-2 ${tabFont} ${on ? "font-bodySemibold text-ink" : "font-bodyMedium text-ink-faint"}`}>
                {tb.label}
              </Text>
              <View className={`h-[3px] w-8 rounded-full ${on ? "bg-olive" : ""}`} />
            </Pressable>
          );
        })}
      </View>

      <FlatList
        ref={listRef}
        data={feedLoading || failed ? [] : posts}
        keyExtractor={(p) => p.id}
        renderItem={({ item }) => (
          <PostCard
            post={item}
            onOpen={() => router.push(`/community/post/${item.id}`)}
            onRemoved={removePost}
            onTagPress={(tag) => {
              listRef.current?.scrollToOffset({ offset: 0, animated: true });
              changeFilters({ tab: "all", topic: tag, specialty: null, ageGroupId: null });
            }}
          />
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
        onScroll={(e) => {
          const past = e.nativeEvent.contentOffset.y > FAB_AFTER;
          if (past !== scrolled) setScrolled(past);
        }}
        scrollEventThrottle={64}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 96 }}
        initialNumToRender={6}
        windowSize={7}
      />

      {newPosts && (
        <View pointerEvents="box-none" className="absolute top-40 left-0 right-0 items-center">
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

      {/* Butoni rrethor del vetëm kur fusha "Ndaj diçka…" s'duket (ke zbritur poshtë, ose skeda s'e ka). */}
      {scrolled || filtering || (tab !== "all" && tab !== "age") ? (
        <Pressable
          onPress={() => router.push("/community/new")}
          style={shadows.softLg}
          accessibilityRole="button"
          accessibilityLabel={t("community_post_btn")}
          className="absolute bottom-4 right-5 w-14 h-14 rounded-full bg-olive items-center justify-center"
        >
          <Icon name="plus" size={24} color={theme.onAccent} />
        </Pressable>
      ) : null}
    </SafeAreaView>
  );
}
