import { useCallback, useState } from "react";
import { View, Text, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { Icon } from "@/components/ui/Icon";
import { PostCard } from "@/components/community/PostCard";
import { fetchGroupById, fetchPostsByGroup, toggleJoinGroup, CommunityGroup, CommunityPost } from "@/lib/communityData";

export default function GroupProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [group, setGroup] = useState<CommunityGroup | null>(null);
  const [posts, setPosts] = useState<CommunityPost[]>([]);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      setGroup(await fetchGroupById(id));
      setPosts(await fetchPostsByGroup(id));
    } catch (err) {
      console.warn("Group load error:", err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

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
        <ActivityIndicator color="#6E7452" />
      </SafeAreaView>
    );
  }

  if (!group) {
    return (
      <SafeAreaView className="flex-1 bg-cream items-center justify-center px-8">
        <Text className="font-bodySemibold text-sm text-ink mb-2">Grupi s'u gjet</Text>
        <Pressable onPress={() => router.back()} className="bg-olive px-5 py-3 rounded-full mt-2">
          <Text className="font-bodySemibold text-sm text-white">Kthehu</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const bg = group.accent === "olive" ? "bg-olive-bg" : "bg-orange-bg";
  const fg = group.accent === "olive" ? "#6E7452" : "#C9702E";

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      <View className="flex-row items-center px-5 pt-2 mb-2">
        <Pressable onPress={() => router.back()} className="w-9 h-9 items-center justify-center -ml-2">
          <Text className="font-bodySemibold text-xl text-ink">←</Text>
        </Pressable>
        <Text className="font-bodySemibold text-base text-ink">Grupi</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        <View className="px-5 items-center mt-2 mb-5">
          <View className={`w-20 h-20 rounded-full items-center justify-center mb-3 ${bg}`}>
            <Icon name={group.icon} size={32} color={fg} />
          </View>
          <Text className="font-bodySemibold text-lg text-ink mb-1 text-center">{group.name}</Text>
          <Text className="font-body text-xs text-ink-faint mb-3">{group.memberCount.toLocaleString()} anëtarë</Text>
          <Text className="font-body text-sm text-ink-soft text-center leading-5 mb-4 px-4">{group.description}</Text>
          <Pressable onPress={handleJoin} className={`px-6 py-2.5 rounded-full ${group.joined ? "bg-cream-soft" : "bg-olive"}`}>
            <Text className={`font-bodySemibold text-xs ${group.joined ? "text-ink-soft" : "text-white"}`}>
              {group.joined ? "Anëtar ✓" : "Bashkohu"}
            </Text>
          </Pressable>
        </View>

        <View className="px-5 mb-3">
          <Text className="font-bodySemibold text-sm text-ink">Postimet ({posts.length})</Text>
        </View>
        {posts.length === 0 ? (
          <Text className="font-body text-xs text-ink-faint px-5">Ende s'ka postime n'këtë grup.</Text>
        ) : (
          posts.map((p) => <PostCard key={p.id} post={p} onOpen={() => router.push(`/community/post/${p.id}`)} />)
        )}
      </ScrollView>
    </SafeAreaView>
  );
}