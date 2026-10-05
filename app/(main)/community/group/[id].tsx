import { useCallback, useState } from "react";
import { View, Text, ScrollView, Pressable, ActivityIndicator, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { Icon } from "@/components/ui/Icon";
import { PostCard } from "@/components/community/PostCard";
import { fetchGroupById, fetchPostsByGroup, toggleJoinGroup, CommunityGroup, CommunityPost } from "@/lib/communityData";
import { BackButton, goBackOr } from "@/components/ui/BackButton";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { useThemeColors } from "@/lib/theme/useThemeColors";
import { logWarn } from "@/lib/log";

export default function GroupProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t } = useTranslation();
  const theme = useThemeColors();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [group, setGroup] = useState<CommunityGroup | null>(null);
  const [posts, setPosts] = useState<CommunityPost[]>([]);

  const load = useCallback(async (quiet = false) => {
    if (!id) return;
    if (!quiet) setLoading(true);
    try {
      setGroup(await fetchGroupById(id));
      setPosts(await fetchPostsByGroup(id));
    } catch (err) {
      logWarn("Group load error:", err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load(true);
    setRefreshing(false);
  }, [load]);

  async function handleJoin() {
    if (!group) return;
    const prevJoined = group.joined;
    setGroup({ ...group, joined: !prevJoined, memberCount: group.memberCount + (prevJoined ? -1 : 1) });
    try {
      await toggleJoinGroup(group.id, prevJoined);
    } catch {
      setGroup({ ...group, joined: prevJoined, memberCount: group.memberCount });
    }
  }

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-cream items-center justify-center">
        <ActivityIndicator className="text-olive" />
      </SafeAreaView>
    );
  }

  if (!group) {
    return (
      <SafeAreaView className="flex-1 bg-cream items-center justify-center px-8">
        <Text className="font-bodySemibold text-sm text-ink mb-2">{t("cgrp_not_found")}</Text>
        <Pressable onPress={() => goBackOr("/(main)/community")} className="bg-olive px-5 py-3 rounded-full mt-2">
          <Text className="font-bodySemibold text-sm text-on-accent">{t("cpost_back")}</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const bg = group.accent === "olive" ? "bg-olive-bg" : "bg-orange-bg";
  const fg = group.accent === "olive" ? "#6E7452" : "#C9702E";

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      <View className="flex-row items-center px-5 pt-2 mb-2">
        <BackButton fallback="/(main)/community" />
        <Text className="font-bodySemibold text-base text-ink">{t("cgrp_title")}</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.olive} colors={[theme.olive]} progressBackgroundColor={theme.surface} />
        }
      >
        <View className="px-5 items-center mt-2 mb-5">
          <View className={`w-20 h-20 rounded-full items-center justify-center mb-3 ${bg}`}>
            <Icon name={group.icon} size={32} color={fg} />
          </View>
          <Text className="font-bodySemibold text-lg text-ink mb-1 text-center">{group.name}</Text>
          <Text className="font-body text-xs text-ink-faint mb-3">{t("cexp_members", { n: group.memberCount.toLocaleString() })}</Text>
          <Text className="font-body text-sm text-ink-soft text-center leading-5 mb-4 px-4">{group.description}</Text>
          <Pressable onPress={handleJoin} className={`px-6 py-2.5 rounded-full ${group.joined ? "bg-cream-soft" : "bg-olive"}`}>
            <Text className={`font-bodySemibold text-xs ${group.joined ? "text-ink-soft" : "text-on-accent"}`}>
              {group.joined ? `${t("cexplore_joined")} ✓` : t("cexplore_join")}
            </Text>
          </Pressable>
        </View>

        <View className="px-5 mb-3">
          <Text className="font-bodySemibold text-sm text-ink">{t("cexp_posts", { n: posts.length })}</Text>
        </View>
        {posts.length === 0 ? (
          <Text className="font-body text-xs text-ink-faint px-5">{t("cgrp_no_posts")}</Text>
        ) : (
          posts.map((p) => <PostCard key={p.id} post={p} onOpen={() => router.push(`/community/post/${p.id}`)} onRemoved={(id, reason) => (reason === "blocked" ? load() : setPosts((prev) => prev.filter((x) => x.id !== id)))} />)
        )}
      </ScrollView>
    </SafeAreaView>
  );
}