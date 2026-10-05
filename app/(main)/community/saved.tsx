import { useCallback, useState } from "react";
import { View, Text, ScrollView, ActivityIndicator, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Icon } from "@/components/ui/Icon";
import { PostCard } from "@/components/community/PostCard";
import { fetchSavedPosts, CommunityPost } from "@/lib/communityData";
import { BackButton } from "@/components/ui/BackButton";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { useThemeColors } from "@/lib/theme/useThemeColors";
import { logWarn } from "@/lib/log";

export default function SavedPostsScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const theme = useThemeColors();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [posts, setPosts] = useState<CommunityPost[]>([]);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      setPosts(await fetchSavedPosts());
    } catch (err) {
      logWarn("Saved posts load error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load(true);
    setRefreshing(false);
  }, [load]);

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-cream items-center justify-center">
        <ActivityIndicator className="text-olive" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      <View className="flex-row items-center px-5 pt-2 mb-4">
        <BackButton fallback="/(main)/community" />
        <Text className="font-display text-xl text-ink ml-1">{t("community_saved_title")}</Text>
      </View>

      {posts.length === 0 ? (
        <View className="flex-1 items-center justify-center px-10">
          <View className="w-16 h-16 rounded-full bg-olive-bg items-center justify-center mb-4">
            <Icon name="bookmark" size={26} color="#6E7452" />
          </View>
          <Text className="font-bodySemibold text-sm text-ink mb-1">{t("csaved_empty_title")}</Text>
          <Text className="font-body text-xs text-ink-soft text-center leading-5">
            {t("csaved_empty_body")}
          </Text>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingTop: 4, paddingBottom: 40 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.olive} colors={[theme.olive]} progressBackgroundColor={theme.surface} />
          }
        >
          {posts.map((p) => (
            <PostCard key={p.id} post={p} onOpen={() => router.push(`/community/post/${p.id}`)} onRemoved={(id, reason) => (reason === "blocked" ? load() : setPosts((prev) => prev.filter((x) => x.id !== id)))} />
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}