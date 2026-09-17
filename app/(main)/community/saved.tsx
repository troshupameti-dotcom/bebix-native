import { useCallback, useState } from "react";
import { View, Text, ScrollView, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Icon } from "@/components/ui/Icon";
import { PostCard } from "@/components/community/PostCard";
import { fetchSavedPosts, CommunityPost } from "@/lib/communityData";
import { BackButton } from "@/components/ui/BackButton";

export default function SavedPostsScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [posts, setPosts] = useState<CommunityPost[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setPosts(await fetchSavedPosts());
    } catch (err) {
      console.warn("Saved posts load error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

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
        <Text className="font-display text-xl text-ink ml-1">Postime të ruajtura</Text>
      </View>

      {posts.length === 0 ? (
        <View className="flex-1 items-center justify-center px-10">
          <View className="w-16 h-16 rounded-full bg-olive-bg items-center justify-center mb-4">
            <Icon name="bookmark" size={26} color="#6E7452" />
          </View>
          <Text className="font-bodySemibold text-sm text-ink mb-1">Ende nuk ke ruajtur asgjë</Text>
          <Text className="font-body text-xs text-ink-soft text-center leading-5">
            Kur gjen një postim që do ta lexosh sërish, shtyp ikonën e faqeshënuesit.
          </Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: 4, paddingBottom: 40 }}>
          {posts.map((p) => (
            <PostCard key={p.id} post={p} onOpen={() => router.push(`/community/post/${p.id}`)} onRemoved={(id, reason) => (reason === "blocked" ? load() : setPosts((prev) => prev.filter((x) => x.id !== id)))} />
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}