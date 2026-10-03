import { useCallback, useMemo, useState } from "react";
import { View, Text, ScrollView, Pressable, TextInput, ActivityIndicator, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { useAppState } from "@/lib/state/AppStateContext";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { Icon } from "@/components/ui/Icon";
import { useThemeColors } from "@/lib/theme/useThemeColors";
import { shadows } from "@/lib/shadows";
import { PostCard } from "@/components/community/PostCard";
import { logWarn } from "@/lib/log";
import {
  fetchGroups, fetchExperts, fetchTopics, fetchTips, fetchFeed, FEED_PAGE_SIZE,
  CommunityGroup, CommunityExpert, CommunityTopic, CommunityTip, CommunityPost,
} from "@/lib/communityData";

/**
 * Ky ekran ka një punë të vetme: të lexosh çfarë shkruajnë prindërit e tjerë
 * dhe të shkruash vetë. Gjithçka tjetër (ekspertët, grupet, të ruajturat,
 * profili) është navigim dytësor dhe rri jashtë rrjedhës së leximit.
 */

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
  const { t } = useTranslation();
  const theme = useThemeColors();
  const [query, setQuery] = useState("");
  const [topic, setTopic] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState<CommunityGroup[]>([]);
  const [experts, setExperts] = useState<CommunityExpert[]>([]);
  const [topics, setTopics] = useState<CommunityTopic[]>([]);
  const [tips, setTips] = useState<CommunityTip[]>([]);
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const loadAll = useCallback(async () => {
    try {
      const [g, e, tp, ti, p] = await Promise.all([
        fetchGroups(), fetchExperts(), fetchTopics(), fetchTips(), fetchFeed(),
      ]);
      setGroups(g); setExperts(e); setTopics(tp); setTips(ti);
      // Kthimi te ekrani rifreskon faqen e parë, por s'i hedh postimet më
      // të vjetra që prindi kishte ngarkuar tashmë duke zbritur poshtë.
      setPosts((prev) => {
        if (p.length < FEED_PAGE_SIZE) return p;
        const oldest = new Date(p[p.length - 1].at).getTime();
        return [...p, ...prev.filter((x) => new Date(x.at).getTime() < oldest)];
      });
      setHasMore((prev) => (p.length < FEED_PAGE_SIZE ? false : prev));
    } catch (err) {
      logWarn("Community load error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || posts.length === 0) return;
    setLoadingMore(true);
    try {
      const next = await fetchFeed({ before: posts[posts.length - 1].at });
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
  }, [hasMore, loadingMore, posts]);

  // Faqja tjetër nis pak para fundit, që leximi të mos ndalet.
  const onScroll = useCallback(
    ({ nativeEvent }: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
      if (layoutMeasurement.height + contentOffset.y >= contentSize.height - 600) void loadMore();
    },
    [loadMore]
  );

  useFocusEffect(useCallback(() => { loadAll(); }, [loadAll]));

  const visiblePosts = useMemo(() => {
    const q = query.trim().toLowerCase();
    return posts.filter((p) => {
      if (topic && p.tag !== topic) return false;
      if (!q) return true;
      return (
        p.text.toLowerCase().includes(q) ||
        p.tag?.toLowerCase().includes(q) ||
        p.authorName.toLowerCase().includes(q)
      );
    });
  }, [posts, query, topic]);

  const filtering = query.trim().length > 0 || topic !== null;
  const todayTip = useMemo(() => tipOfDay(tips), [tips]);

  const removePost = useCallback(
    (id: string, reason: "deleted" | "blocked") => {
      if (reason === "deleted") {
        setPosts((prev) => prev.filter((x) => x.id !== id));
        return;
      }
      // I bllokuari zhduket edhe nga postimet e vjetra të ngarkuara më parë,
      // jo vetëm nga faqja e parë që rilexohet.
      setPosts((prev) => {
        const author = prev.find((x) => x.id === id)?.authorId;
        return prev.filter((x) => x.authorId !== author);
      });
      void loadAll();
    },
    [loadAll]
  );

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-cream items-center justify-center">
        <ActivityIndicator className="text-olive" />
      </SafeAreaView>
    );
  }

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

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 96 }}
        onScroll={onScroll}
        scrollEventThrottle={250}
      >
        <View className="px-5">
          <View className="flex-row items-center bg-surface border border-cream-line rounded-xl2 px-3.5 py-2.5">
            <Icon name="search" size={18} color={theme.inkFaint} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={t("community_search_ph")}
              placeholderClassName="text-ink-faint"
              returnKeyType="search"
              className="flex-1 ml-2 font-body text-sm text-ink"
            />
            {query.length > 0 && (
              <Pressable onPress={() => setQuery("")} hitSlop={8} accessibilityLabel={t("community_clear_search")}>
                <Icon name="close" size={16} color={theme.inkFaint} />
              </Pressable>
            )}
          </View>
        </View>

        {topics.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 20 }}
            className="mt-3"
          >
            <FilterChip label={t("community_all")} selected={topic === null} onPress={() => setTopic(null)} />
            {topics.map((tp) => (
              <FilterChip
                key={tp.id}
                label={tp.label}
                selected={topic === tp.label}
                onPress={() => setTopic(topic === tp.label ? null : tp.label)}
              />
            ))}
          </ScrollView>
        )}

        {/* Këshilla e ditës — përmbajtje e redaksisë, jo e gjeneruar */}
        {todayTip && !filtering && (
          <View style={shadows.soft} className="mx-5 mt-4 bg-surface rounded-xl2 p-4">
            <Text className="font-bodyMedium text-[10px] tracking-wide text-ink-faint mb-2">
              {t("community_tip_label").toUpperCase()}
            </Text>
            <Text className="font-bodySemibold text-sm text-ink mb-1">{todayTip.title}</Text>
            <Text className="font-body text-xs text-ink-soft leading-5">{todayTip.body}</Text>
          </View>
        )}

        <View className="mt-5">
          {visiblePosts.length === 0 ? (
            filtering ? (
              <Text className="font-body text-sm text-ink-soft px-5">
                {t("community_no_results", { query: topic ?? query })}
              </Text>
            ) : (
              <View className="items-center px-10 py-8">
                <Text className="font-bodySemibold text-sm text-ink mb-1">{t("community_empty_title")}</Text>
                <Text className="font-body text-xs text-ink-soft text-center leading-5 mb-4">
                  {t("community_empty_sub")}
                </Text>
                <Pressable onPress={() => router.push("/community/new")} className="bg-olive px-5 py-2.5 rounded-full">
                  <Text className="font-bodySemibold text-xs text-on-accent">{t("community_post_btn")}</Text>
                </Pressable>
              </View>
            )
          ) : (
            visiblePosts.map((p) => (
              <PostCard
                key={p.id}
                post={p}
                onOpen={() => router.push(`/community/post/${p.id}`)}
                onRemoved={removePost}
              />
            ))
          )}
          {loadingMore && <ActivityIndicator className="text-olive my-4" />}
        </View>

        {/* Navigim dytësor, në fund: aty ku e kërkon kush e kërkon */}
        <Pressable
          onPress={() => router.push("/community/explore")}
          className="mx-5 mt-2 py-4 border-t border-cream-line flex-row items-center"
        >
          <View className="flex-1">
            <Text className="font-bodyMedium text-sm text-ink">{t("community_experts_groups")}</Text>
            <Text className="font-body text-xs text-ink-faint mt-0.5">
              {t("community_experts_groups_sub", { experts: experts.length, groups: groups.length })}
            </Text>
          </View>
          <Icon name="chevronRight" size={18} color={theme.inkFaint} />
        </Pressable>
      </ScrollView>

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
