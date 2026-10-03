import { useCallback, useState } from "react";
import { View, Text, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { useAppState } from "@/lib/state/AppStateContext";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { Icon } from "@/components/ui/Icon";
import { Avatar, PostCard } from "@/components/community/PostCard";
import { BackButton } from "@/components/ui/BackButton";
import { getCurrentUserId, fetchPostsByAuthor, fetchExpertByUserId, CommunityExpert, CommunityPost } from "@/lib/communityData";
import { logWarn } from "@/lib/log";

export default function MyProfileScreen() {
  const router = useRouter();
  const { state } = useAppState();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [expert, setExpert] = useState<CommunityExpert | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const uid = await getCurrentUserId();
      if (!uid) { setPosts([]); setExpert(null); return; }
      const [p, e] = await Promise.all([fetchPostsByAuthor(uid), fetchExpertByUserId(uid)]);
      setPosts(p);
      setExpert(e);
    } catch (err) {
      logWarn("My profile load error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const name = state.profile.parentName || "Ti";
  const initial = name.trim().charAt(0).toUpperCase() || "T";
  const totalLikes = posts.reduce((sum, p) => sum + p.likeCount, 0);
  const totalComments = posts.reduce((sum, p) => sum + p.commentCount, 0);

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-cream items-center justify-center">
        <ActivityIndicator className="text-olive" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      <View className="flex-row items-center px-5 pt-2 mb-2">
        <BackButton fallback="/(main)/community" />
        <Text className="font-display text-xl text-ink ml-1">{t("community_profile_title")}</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        <View className="px-5 items-center mt-2 mb-5">
          <Avatar initial={initial} accent="olive" size={72} />
          <View className="flex-row items-center mt-3 mb-1">
            <Text className="font-bodySemibold text-lg text-ink">{name}</Text>
            {expert && <Icon name="check" size={14} color="#6E7452" />}
          </View>

          {expert ? (
            <View className="flex-row items-center bg-olive-bg rounded-full px-3 py-1 mb-2">
              <Icon name="shield" size={12} color="#6E7452" />
              <Text className="font-bodySemibold text-[11px] text-olive ml-1.5">{t("cprof_verified_kind", { kind: expert.kind })}</Text>
            </View>
          ) : (
            <Pressable onPress={() => router.push("/more/doctor-registration")}>
              <Text className="font-bodyMedium text-xs text-olive mb-2">{t("cprof_become_expert")}</Text>
            </Pressable>
          )}

          <View className="flex-row mt-3">
            <View className="items-center mx-4">
              <Text className="font-bodySemibold text-base text-ink">{posts.length}</Text>
              <Text className="font-body text-[11px] text-ink-faint">{t("cprof_posts")}</Text>
            </View>
            <View className="items-center mx-4">
              <Text className="font-bodySemibold text-base text-ink">{totalLikes}</Text>
              <Text className="font-body text-[11px] text-ink-faint">{t("cprof_helped")}</Text>
            </View>
            <View className="items-center mx-4">
              <Text className="font-bodySemibold text-base text-ink">{totalComments}</Text>
              <Text className="font-body text-[11px] text-ink-faint">{t("cprof_comments")}</Text>
            </View>
          </View>
        </View>

        <View className="px-5 mb-3">
          <Text className="font-bodySemibold text-sm text-ink">{t("cprof_my_posts")}</Text>
        </View>

        {posts.length === 0 ? (
          <View className="px-5">
            <Text className="font-body text-xs text-ink-faint mb-4">{t("cprof_empty")}</Text>
            <Pressable onPress={() => router.push("/community/new")} className="bg-olive px-5 py-3 rounded-full self-start">
              <Text className="font-bodySemibold text-xs text-on-accent">{t("cprof_post_something")}</Text>
            </Pressable>
          </View>
        ) : (
          posts.map((p) => (
            <PostCard key={p.id} post={p} onOpen={() => router.push(`/community/post/${p.id}`)} onRemoved={(id, reason) => (reason === "blocked" ? load() : setPosts((prev) => prev.filter((x) => x.id !== id)))} />
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}