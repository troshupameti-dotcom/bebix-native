import { useCallback, useState } from "react";
import { View, Text, ScrollView, Pressable, ActivityIndicator, RefreshControl, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { Icon } from "@/components/ui/Icon";
import { PostCard } from "@/components/community/PostCard";
import { fetchExpertById, fetchPostsByAuthor, toggleFollowExpert, CommunityExpert, CommunityPost } from "@/lib/communityData";
import { BackButton, goBackOr } from "@/components/ui/BackButton";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { useThemeColors } from "@/lib/theme/useThemeColors";
import { useSpecialties } from "@/lib/community/useSpecialties";
import { specialtyEmoji, specialtyLabel } from "@/lib/community/specialties";
import { logWarn } from "@/lib/log";

export default function ExpertProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t, language } = useTranslation();
  const theme = useThemeColors();
  const specialties = useSpecialties();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expert, setExpert] = useState<CommunityExpert | null>(null);
  const [posts, setPosts] = useState<CommunityPost[]>([]);

  const load = useCallback(async (quiet = false) => {
    if (!id) return;
    if (!quiet) setLoading(true);
    try {
      const e = await fetchExpertById(id);
      setExpert(e);
      setPosts(e?.userId ? await fetchPostsByAuthor(e.userId) : []);
    } catch (err) {
      logWarn("Expert profile load error:", err);
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

  async function handleFollow() {
    if (!expert) return;
    const prevFollowed = expert.followed;
    setExpert({ ...expert, followed: !prevFollowed });
    try {
      await toggleFollowExpert(expert.id, prevFollowed);
    } catch {
      setExpert({ ...expert, followed: prevFollowed });
    }
  }

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-cream items-center justify-center">
        <ActivityIndicator className="text-olive" />
      </SafeAreaView>
    );
  }

  if (!expert) {
    return (
      <SafeAreaView className="flex-1 bg-cream items-center justify-center px-8">
        <Text className="font-bodySemibold text-sm text-ink mb-2">{t("cexp_not_found")}</Text>
        <Pressable onPress={() => goBackOr("/(main)/community")} className="bg-olive px-5 py-3 rounded-full mt-2">
          <Text className="font-bodySemibold text-sm text-on-accent">{t("cpost_back")}</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const bg = expert.accent === "olive" ? "bg-olive-bg" : "bg-orange-bg";
  const fg = expert.accent === "olive" ? "#6E7452" : "#C9702E";

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      <View className="flex-row items-center px-5 pt-2 mb-2">
        <BackButton fallback="/(main)/community" />
        <Text className="font-bodySemibold text-base text-ink">{t("cexp_profile")}</Text>
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
            {expert.photoUrl ? (
              <Image source={{ uri: expert.photoUrl }} style={{ width: 80, height: 80, borderRadius: 40 }} />
            ) : expert.specialty ? (
              <Text className="text-3xl">{specialtyEmoji(expert.specialty, specialties.list)}</Text>
            ) : (
              <Icon name={expert.icon} size={32} color={fg} />
            )}
          </View>
          <View className="flex-row items-center mb-1">
            <Text className="font-bodySemibold text-lg text-ink">{expert.name}</Text>
            <Icon name="check" size={14} color="#6E7452" />
          </View>
          <Text className="font-bodySemibold text-xs text-olive mb-1">
            {specialtyLabel(expert.specialty, language, specialties.list) ?? expert.kind}
          </Text>
          {expert.experienceYears > 0 && (
            <Text className="font-body text-xs text-ink-faint mb-1">{t("cexp_years", { n: expert.experienceYears })}</Text>
          )}
          {/* Vlerësimi shfaqet vetëm kur ka vlerësime të vërteta (5.0 fillestar pa asnjë votë nuk është vlerësim). */}
          {expert.reviewCount > 0 && (
            <Text className="font-bodyMedium text-xs text-ink-soft mb-1">
              {t("cexp_rating", { rating: expert.rating.toFixed(1), n: expert.reviewCount })}
            </Text>
          )}
          <View className="h-3" />
          {!!expert.bio && (
            <Text className="font-body text-sm text-ink-soft text-center leading-5 mb-4 px-4">{expert.bio}</Text>
          )}
          <Pressable onPress={handleFollow} className={`px-6 py-2.5 rounded-full ${expert.followed ? "bg-cream-soft" : "bg-olive"}`}>
            <Text className={`font-bodySemibold text-xs ${expert.followed ? "text-ink-soft" : "text-on-accent"}`}>
              {expert.followed ? `${t("cexp_following")} ✓` : t("cexp_follow")}
            </Text>
          </Pressable>
        </View>

        <View className="px-5 mb-3">
          <Text className="font-bodySemibold text-sm text-ink">{t("cexp_posts", { n: posts.length })}</Text>
        </View>
        {posts.length === 0 ? (
          <Text className="font-body text-xs text-ink-faint px-5">{t("cexp_no_posts")}</Text>
        ) : (
          posts.map((p) => <PostCard key={p.id} post={p} onOpen={() => router.push(`/community/post/${p.id}`)} onRemoved={(id, reason) => (reason === "blocked" ? load() : setPosts((prev) => prev.filter((x) => x.id !== id)))} />)
        )}
      </ScrollView>
    </SafeAreaView>
  );
}