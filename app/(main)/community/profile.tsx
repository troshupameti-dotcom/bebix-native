import { useCallback, useState } from "react";
import { View, Text, ScrollView, Pressable, ActivityIndicator, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { useAppState } from "@/lib/state/AppStateContext";
import { Icon } from "@/components/ui/Icon";
import { Avatar, PostCard } from "@/components/community/PostCard";
import {
  getCurrentUserId, fetchPostsByAuthor, fetchExpertByUserId, deletePost,
  CommunityExpert, CommunityPost,
} from "@/lib/communityData";

export default function MyProfileScreen() {
  const router = useRouter();
  const { state } = useAppState();
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
      console.warn("My profile load error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  function handleDelete(postId: string) {
    Alert.alert("Fshi postimin", "A je i sigurt?", [
      { text: "Anulo", style: "cancel" },
      {
        text: "Fshi",
        style: "destructive",
        onPress: async () => {
          setPosts((prev) => prev.filter((p) => p.id !== postId));
          try {
            await deletePost(postId);
          } catch {
            load();
          }
        },
      },
    ]);
  }

  const name = state.profile.parentName || "Ti";
  const initial = name.trim().charAt(0).toUpperCase() || "T";
  const totalLikes = posts.reduce((sum, p) => sum + p.likeCount, 0);
  const totalComments = posts.reduce((sum, p) => sum + p.commentCount, 0);

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-cream items-center justify-center">
        <ActivityIndicator color="#6E7452" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      <View className="flex-row items-center px-5 pt-2 mb-2">
        <Pressable onPress={() => router.back()} className="w-9 h-9 items-center justify-center -ml-2">
          <Text className="font-bodySemibold text-xl text-ink">←</Text>
        </Pressable>
        <Text className="font-bodySemibold text-base text-ink">Profili Im</Text>
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
              <Text className="font-bodySemibold text-[11px] text-olive ml-1.5">{expert.kind} i verifikuar</Text>
            </View>
          ) : (
            <Pressable onPress={() => router.push("/more/doctor-registration")}>
              <Text className="font-bodyMedium text-xs text-olive mb-2">Bëhu ekspert i verifikuar →</Text>
            </Pressable>
          )}

          <View className="flex-row mt-3">
            <View className="items-center mx-4">
              <Text className="font-bodySemibold text-base text-ink">{posts.length}</Text>
              <Text className="font-body text-[11px] text-ink-faint">Postime</Text>
            </View>
            <View className="items-center mx-4">
              <Text className="font-bodySemibold text-base text-ink">{totalLikes}</Text>
              <Text className="font-body text-[11px] text-ink-faint">M'ndihmoi</Text>
            </View>
            <View className="items-center mx-4">
              <Text className="font-bodySemibold text-base text-ink">{totalComments}</Text>
              <Text className="font-body text-[11px] text-ink-faint">Komente</Text>
            </View>
          </View>
        </View>

        <View className="px-5 mb-3">
          <Text className="font-bodySemibold text-sm text-ink">Postimet e mia</Text>
        </View>

        {posts.length === 0 ? (
          <View className="px-5">
            <Text className="font-body text-xs text-ink-faint mb-4">Ende nuk ke postuar asgjë.</Text>
            <Pressable onPress={() => router.push("/community/new")} className="bg-olive px-5 py-3 rounded-full self-start">
              <Text className="font-bodySemibold text-xs text-white">Posto diçka</Text>
            </Pressable>
          </View>
        ) : (
          posts.map((p) => (
            <View key={p.id}>
              <PostCard post={p} onOpen={() => router.push(`/community/post/${p.id}`)} />
              <Pressable onPress={() => handleDelete(p.id)} className="self-end mr-9 -mt-3 mb-2">
                <Text className="font-bodyMedium text-[11px] text-orange">Fshij postimin</Text>
              </Pressable>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}