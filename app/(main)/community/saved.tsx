import { useCallback, useState } from "react";
import { View, Text, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Icon } from "@/components/ui/Icon";
import { PostCard } from "@/components/community/PostCard";
import { fetchSavedPosts, CommunityPost } from "@/lib/communityData";

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
        <ActivityIndicator color="#6E7452" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      <View className="flex-row items-center px-5 pt-2 mb-4">
        <Pressable onPress={() => router.back()} className="w-9 h-9 items-center justify-center -ml-2">
          <Text className="font-bodySemibold text-xl text-ink">←</Text>
        </Pressable>
        <Text className="font-display text-2xl text-ink ml-1">Postime të Ruajtura</Text>
      </View>

      {posts.length === 0 ? (
        <View className="flex-1 items-center justify-center px-10">
          <View className="w-16 h-16 rounded-full bg-olive-bg items-center justify-center mb-4">
            <Icon name="bookmark" size={26} color="#6E7452" />
          </View>
          <Text className="font-bodySemibold text-sm text-ink mb-1">Ende s'ke ruajtë asgjë</Text>
          <Text className="font-body text-xs text-ink-soft text-center leading-5">
            Kur shef një postim interesant, shtyp ikonën e bookmark-ut me e ruejt këtu.
          </Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: 4, paddingBottom: 40 }}>
          {posts.map((p) => (
            <PostCard key={p.id} post={p} onOpen={() => router.push(`/community/post/${p.id}`)} />
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}