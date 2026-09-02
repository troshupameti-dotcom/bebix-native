import { useCallback, useState } from "react";
import { View, Text, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { Icon } from "@/components/ui/Icon";
import { PostCard } from "@/components/community/PostCard";
import { fetchExpertById, fetchPostsByAuthor, toggleFollowExpert, CommunityExpert, CommunityPost } from "@/lib/communityData";

export default function ExpertProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [expert, setExpert] = useState<CommunityExpert | null>(null);
  const [posts, setPosts] = useState<CommunityPost[]>([]);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const e = await fetchExpertById(id);
      setExpert(e);
      setPosts(e?.userId ? await fetchPostsByAuthor(e.userId) : []);
    } catch (err) {
      console.warn("Expert profile load error:", err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

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
        <ActivityIndicator color="#6E7452" />
      </SafeAreaView>
    );
  }

  if (!expert) {
    return (
      <SafeAreaView className="flex-1 bg-cream items-center justify-center px-8">
        <Text className="font-bodySemibold text-sm text-ink mb-2">Eksperti s'u gjet</Text>
        <Pressable onPress={() => router.back()} className="bg-olive px-5 py-3 rounded-full mt-2">
          <Text className="font-bodySemibold text-sm text-white">Kthehu</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const bg = expert.accent === "olive" ? "bg-olive-bg" : "bg-orange-bg";
  const fg = expert.accent === "olive" ? "#6E7452" : "#C9702E";

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      <View className="flex-row items-center px-5 pt-2 mb-2">
        <Pressable onPress={() => router.back()} className="w-9 h-9 items-center justify-center -ml-2">
          <Text className="font-bodySemibold text-xl text-ink">←</Text>
        </Pressable>
        <Text className="font-bodySemibold text-base text-ink">Profili</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        <View className="px-5 items-center mt-2 mb-5">
          <View className={`w-20 h-20 rounded-full items-center justify-center mb-3 ${bg}`}>
            <Icon name={expert.icon} size={32} color={fg} />
          </View>
          <View className="flex-row items-center mb-1">
            <Text className="font-bodySemibold text-lg text-ink">{expert.name}</Text>
            <Icon name="check" size={14} color="#6E7452" />
          </View>
          <Text className="font-body text-xs text-ink-faint mb-1">{expert.kind} · {expert.experienceYears} vite përvojë</Text>
          <Text className="font-bodyMedium text-xs text-ink-soft mb-4">⭐ {expert.rating} ({expert.reviewCount} vlerësime)</Text>
          {!!expert.bio && (
            <Text className="font-body text-sm text-ink-soft text-center leading-5 mb-4 px-4">{expert.bio}</Text>
          )}
          <Pressable onPress={handleFollow} className={`px-6 py-2.5 rounded-full ${expert.followed ? "bg-cream-soft" : "bg-olive"}`}>
            <Text className={`font-bodySemibold text-xs ${expert.followed ? "text-ink-soft" : "text-white"}`}>
              {expert.followed ? "Ndjekur ✓" : "Ndiq"}
            </Text>
          </Pressable>
        </View>

        <View className="px-5 mb-3">
          <Text className="font-bodySemibold text-sm text-ink">Postimet ({posts.length})</Text>
        </View>
        {posts.length === 0 ? (
          <Text className="font-body text-xs text-ink-faint px-5">Ende s'ka postime.</Text>
        ) : (
          posts.map((p) => <PostCard key={p.id} post={p} onOpen={() => router.push(`/community/post/${p.id}`)} />)
        )}
      </ScrollView>
    </SafeAreaView>
  );
}