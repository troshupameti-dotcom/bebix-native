import { useCallback, useMemo, useState } from "react";
import { View, Text, ScrollView, Pressable, TextInput, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { useAppState } from "@/lib/state/AppStateContext";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { Icon } from "@/components/ui/Icon";
import { shadows } from "@/lib/shadows";
import { PostCard } from "@/components/community/PostCard";
import { TodayCard } from "@/components/community/TodayCard";
import {
  fetchGroups, fetchExperts, fetchTopics, fetchTips, fetchFeed,
  CommunityGroup, CommunityExpert, CommunityTopic, CommunityTip, CommunityPost,
} from "@/lib/communityData";
import { fetchGameRecommendations, ageInMonths, GameSuggestion } from "@/lib/aiGameRecommendations";

function SectionHeader({ title }: { title: string }) {
  return (
    <View className="mb-3 mt-6 px-5">
      <Text className="font-bodySemibold text-lg text-ink dark:text-cream">{title}</Text>
    </View>
  );
}

function TopicChip({ label, count, onPress }: { label: string; count: number; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={shadows.soft} className="bg-surface dark:bg-ink/40 rounded-full px-3.5 py-1 mr-2 flex-row items-center">
      <Text className="font-bodyMedium text-[11px] text-ink dark:text-cream">{label}</Text>
      <Text className="font-body text-[10px] text-ink-faint dark:text-cream/50 ml-1">{count}</Text>
    </Pressable>
  );
}

function ExploreBanner({
  expertsCount,
  groupsCount,
  onPress,
  t,
}: {
  expertsCount: number;
  groupsCount: number;
  onPress: () => void;
  t: (key: any, params?: Record<string, string | number>) => string;
}) {
  return (
    <Pressable onPress={onPress} style={shadows.soft} className="mx-5 bg-olive-bg rounded-xl3 p-4 flex-row items-center mb-2">
      <View className="w-11 h-11 rounded-full bg-surface items-center justify-center mr-3">
        <Icon name="shield" size={20} color="#6E7452" />
      </View>
      <View className="flex-1">
        <Text className="font-bodySemibold text-sm text-ink">{t("community_experts_groups")}</Text>
        <Text className="font-body text-xs text-ink-soft">
          {t("community_experts_groups_sub", { experts: expertsCount, groups: groupsCount })}
        </Text>
      </View>
      <Text className="font-bodySemibold text-base text-ink-faint">›</Text>
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
  const isDark = state.darkMode;
  const [query, setQuery] = useState("");

  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState<CommunityGroup[]>([]);
  const [experts, setExperts] = useState<CommunityExpert[]>([]);
  const [topics, setTopics] = useState<CommunityTopic[]>([]);
  const [tips, setTips] = useState<CommunityTip[]>([]);
  const [posts, setPosts] = useState<CommunityPost[]>([]);

  const [games, setGames] = useState<GameSuggestion[]>([]);
  const [gamesLoading, setGamesLoading] = useState(false);
  const [gamesError, setGamesError] = useState<string | null>(null);
  const babyAgeMonths = useMemo(() => ageInMonths(state.profile.babyDob), [state.profile.babyDob]);

  const loadAll = useCallback(async () => {
    try {
      const [g, e, tp, ti, p] = await Promise.all([
        fetchGroups(), fetchExperts(), fetchTopics(), fetchTips(), fetchFeed(),
      ]);
      setGroups(g); setExperts(e); setTopics(tp); setTips(ti); setPosts(p);
    } catch (err) {
      console.warn("Community load error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadGames = useCallback(async () => {
    if (babyAgeMonths === null) return;
    setGamesLoading(true);
    setGamesError(null);
    try {
      setGames(await fetchGameRecommendations(babyAgeMonths));
    } catch (err: any) {
      setGamesError(err.message ?? t("community_games_error"));
    } finally {
      setGamesLoading(false);
    }
  }, [babyAgeMonths, t]);

  useFocusEffect(useCallback(() => { loadAll(); }, [loadAll]));

  useFocusEffect(
    useCallback(() => {
      if (games.length === 0 && babyAgeMonths !== null) loadGames();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [babyAgeMonths])
  );

  const filteredPosts = useMemo(() => {
    if (!query.trim()) return posts;
    const q = query.toLowerCase();
    return posts.filter((p) => p.text.toLowerCase().includes(q) || p.tag?.toLowerCase().includes(q) || p.authorName.toLowerCase().includes(q));
  }, [posts, query]);

  const aiRecommendedPosts = useMemo(() => posts.slice().sort((a, b) => b.likeCount - a.likeCount).slice(0, 3), [posts]);
  const todayTip = useMemo(() => tipOfDay(tips), [tips]);

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-cream dark:bg-ink items-center justify-center">
        <ActivityIndicator color="#6E7452" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-cream dark:bg-ink" edges={["top"]}>
      <View className="flex-row items-center justify-between px-5 pt-2 mb-4">
        <Pressable
          onPress={() => router.push("/community/profile")}
          style={shadows.soft}
          className="w-10 h-10 rounded-full bg-olive-bg items-center justify-center"
        >
          <Text className="font-bodySemibold text-sm text-olive">
            {(state.profile.parentName || "T").trim().charAt(0).toUpperCase()}
          </Text>
        </Pressable>
        <Text className="font-display text-2xl text-ink dark:text-cream">{t("community_title")}</Text>
        <Pressable
          onPress={() => router.push("/community/saved")}
          style={shadows.soft}
          className="w-10 h-10 rounded-full bg-surface dark:bg-ink/40 items-center justify-center"
        >
          <Icon name="bookmark" size={18} color={isDark ? "#F7F1E4" : "#2C271F"} />
        </Pressable>
      </View>

      {/* Search + Topics — bashkue n'nji blloke t'ngjeshun */}
      <View className="px-5 mb-3">
        <View style={shadows.soft} className="flex-row items-center bg-surface dark:bg-ink/40 rounded-xl2 px-4 py-3 mb-2.5">
          <Icon name="search" size={18} color="#A79D8A" />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t("community_search_ph")}
            placeholderTextColor="#A79D8A"
            className="flex-1 ml-2 font-body text-sm text-ink dark:text-cream"
          />
        </View>
      </View>

      {topics.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, alignItems: "center" }}
          style={{ flexGrow: 0 }}
          className="mb-1"
        >
          {topics.map((tp) => (
            <TopicChip key={tp.id} label={tp.label} count={tp.postCount} onPress={() => setQuery(tp.label)} />
          ))}
        </ScrollView>
      )}

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        <TodayCard
          tip={todayTip}
          games={games}
          gamesLoading={gamesLoading}
          gamesError={gamesError}
          hasAge={babyAgeMonths !== null}
          onRetryGames={loadGames}
        />

        <ExploreBanner
          expertsCount={experts.length}
          groupsCount={groups.length}
          onPress={() => router.push("/community/explore")}
          t={t}
        />

        {aiRecommendedPosts.length > 0 && (
          <>
            <SectionHeader title={t("community_recommended")} />
            {aiRecommendedPosts.map((p) => (
              <PostCard key={p.id} post={p} onOpen={() => router.push(`/community/post/${p.id}`)} />
            ))}
          </>
        )}

        <SectionHeader title={query.trim() ? t("community_results") : t("community_feed")} />
        {filteredPosts.length === 0 ? (
          query.trim() ? (
            <Text className="font-body text-sm text-ink-soft dark:text-cream/60 px-5">
              {t("community_no_results", { query })}
            </Text>
          ) : (
            <View className="items-center px-10 py-8">
              <View className="w-14 h-14 rounded-full bg-olive-bg items-center justify-center mb-3">
                <Icon name="comment" size={24} color="#6E7452" />
              </View>
              <Text className="font-bodySemibold text-sm text-ink dark:text-cream mb-1">{t("community_empty_title")}</Text>
              <Text className="font-body text-xs text-ink-soft dark:text-cream/60 text-center leading-5 mb-4">
                {t("community_empty_sub")}
              </Text>
              <Pressable onPress={() => router.push("/community/new")} className="bg-olive px-5 py-2.5 rounded-full">
                <Text className="font-bodySemibold text-xs text-white">{t("community_post_btn")}</Text>
              </Pressable>
            </View>
          )
        ) : (
          filteredPosts.map((p) => <PostCard key={p.id} post={p} onOpen={() => router.push(`/community/post/${p.id}`)} />)
        )}
      </ScrollView>

      <Pressable
        onPress={() => router.push("/community/new")}
        style={shadows.softLg}
        className="absolute bottom-28 right-6 w-14 h-14 rounded-full bg-olive items-center justify-center"
      >
        <Icon name="plus" size={24} color="#FFFFFF" />
      </Pressable>
    </SafeAreaView>
  );
}