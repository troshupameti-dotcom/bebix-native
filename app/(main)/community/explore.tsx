import { useCallback, useState } from "react";
import { View, Text, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Icon } from "@/components/ui/Icon";
import { shadows } from "@/lib/shadows";
import {
  fetchExperts, fetchGroups,
  toggleFollowExpert as apiToggleFollowExpert, toggleJoinGroup as apiToggleJoinGroup,
  CommunityExpert, CommunityGroup,
} from "@/lib/communityData";

type Tab = "experts" | "groups";

function ExpertRow({ expert, onOpen, onToggleFollow }: { expert: CommunityExpert; onOpen: () => void; onToggleFollow: () => void }) {
  const bg = expert.accent === "olive" ? "bg-olive-bg" : "bg-orange-bg";
  const fg = expert.accent === "olive" ? "#6E7452" : "#C9702E";
  return (
    <Pressable onPress={onOpen} style={shadows.soft} className="bg-surface rounded-xl2 p-4 mb-3 flex-row items-center">
      <View className={`w-12 h-12 rounded-full items-center justify-center mr-3 ${bg}`}>
        <Icon name={expert.icon} size={22} color={fg} />
      </View>
      <View className="flex-1">
        <View className="flex-row items-center">
          <Text className="font-bodySemibold text-sm text-ink" numberOfLines={1}>{expert.name}</Text>
          <Icon name="check" size={12} color="#6E7452" />
        </View>
        <Text className="font-body text-xs text-ink-faint mb-0.5">{expert.kind}</Text>
        <Text className="font-bodyMedium text-[11px] text-ink-soft">⭐ {expert.rating} ({expert.reviewCount})</Text>
      </View>
      <Pressable onPress={onToggleFollow} className={`px-3 py-1.5 rounded-full ${expert.followed ? "bg-cream-soft" : "bg-olive"}`}>
        <Text className={`font-bodySemibold text-[11px] ${expert.followed ? "text-ink-soft" : "text-white"}`}>
          {expert.followed ? "Ndjekur" : "Ndiq"}
        </Text>
      </Pressable>
    </Pressable>
  );
}

function GroupRow({ group, onOpen, onToggleJoin }: { group: CommunityGroup; onOpen: () => void; onToggleJoin: () => void }) {
  const bg = group.accent === "olive" ? "bg-olive-bg" : "bg-orange-bg";
  const fg = group.accent === "olive" ? "#6E7452" : "#C9702E";
  return (
    <Pressable onPress={onOpen} style={shadows.soft} className="bg-surface rounded-xl2 p-4 mb-3 flex-row items-center">
      <View className={`w-12 h-12 rounded-full items-center justify-center mr-3 ${bg}`}>
        <Icon name={group.icon} size={22} color={fg} />
      </View>
      <View className="flex-1">
        <Text className="font-bodySemibold text-sm text-ink" numberOfLines={1}>{group.name}</Text>
        <Text className="font-body text-xs text-ink-faint">{group.memberCount.toLocaleString()} anëtarë</Text>
      </View>
      <Pressable onPress={onToggleJoin} className={`px-3 py-1.5 rounded-full ${group.joined ? "bg-cream-soft" : "bg-olive"}`}>
        <Text className={`font-bodySemibold text-[11px] ${group.joined ? "text-ink-soft" : "text-white"}`}>
          {group.joined ? "Anëtar ✓" : "Bashkohu"}
        </Text>
      </Pressable>
    </Pressable>
  );
}

export default function ExploreScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("experts");
  const [loading, setLoading] = useState(true);
  const [experts, setExperts] = useState<CommunityExpert[]>([]);
  const [groups, setGroups] = useState<CommunityGroup[]>([]);

  const load = useCallback(async () => {
    try {
      const [e, g] = await Promise.all([fetchExperts(), fetchGroups()]);
      setExperts(e); setGroups(g);
    } catch (err) {
      console.warn("Explore load error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function handleFollow(e: CommunityExpert) {
    setExperts((prev) => prev.map((x) => (x.id === e.id ? { ...x, followed: !x.followed } : x)));
    try { await apiToggleFollowExpert(e.id, e.followed); }
    catch { setExperts((prev) => prev.map((x) => (x.id === e.id ? { ...x, followed: e.followed } : x))); }
  }

  async function handleJoin(g: CommunityGroup) {
    setGroups((prev) => prev.map((x) => (x.id === g.id ? { ...x, joined: !x.joined, memberCount: x.memberCount + (x.joined ? -1 : 1) } : x)));
    try { await apiToggleJoinGroup(g.id, g.joined); }
    catch { setGroups((prev) => prev.map((x) => (x.id === g.id ? { ...x, joined: g.joined, memberCount: g.memberCount } : x))); }
  }

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
        <Text className="font-display text-xl text-ink ml-1">Ekspertë & Grupe</Text>
      </View>

      <View className="flex-row px-5 mb-4">
        <Pressable onPress={() => setTab("experts")} style={shadows.soft} className={`flex-1 py-2.5 rounded-full mr-2 items-center ${tab === "experts" ? "bg-olive" : "bg-surface"}`}>
          <Text className={`font-bodySemibold text-xs ${tab === "experts" ? "text-white" : "text-ink"}`}>Ekspertë ({experts.length})</Text>
        </Pressable>
        <Pressable onPress={() => setTab("groups")} style={shadows.soft} className={`flex-1 py-2.5 rounded-full items-center ${tab === "groups" ? "bg-olive" : "bg-surface"}`}>
          <Text className={`font-bodySemibold text-xs ${tab === "groups" ? "text-white" : "text-ink"}`}>Grupe ({groups.length})</Text>
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}>
        {tab === "experts" ? (
          experts.length === 0 ? (
            <Text className="font-body text-xs text-ink-faint">Ende s'ka ekspertë.</Text>
          ) : (
            experts.map((e) => (
              <ExpertRow key={e.id} expert={e} onOpen={() => router.push(`/community/expert/${e.id}`)} onToggleFollow={() => handleFollow(e)} />
            ))
          )
        ) : groups.length === 0 ? (
          <Text className="font-body text-xs text-ink-faint">Ende s'ka grupe.</Text>
        ) : (
          groups.map((g) => (
            <GroupRow key={g.id} group={g} onOpen={() => router.push(`/community/group/${g.id}`)} onToggleJoin={() => handleJoin(g)} />
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}