import { useCallback, useState } from "react";
import { View, Text, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Icon } from "@/components/ui/Icon";
import { shadows } from "@/lib/shadows";
import { BackButton } from "@/components/ui/BackButton";
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
        {expert.reviewCount > 0 && (
          <Text className="font-bodyMedium text-[11px] text-ink-soft">
            {expert.rating.toFixed(1)} · {expert.reviewCount} vlerësime
          </Text>
        )}
      </View>
      <Pressable onPress={onToggleFollow} className={`px-3 py-1.5 rounded-full ${expert.followed ? "bg-cream-soft" : "bg-olive"}`}>
        <Text className={`font-bodySemibold text-[11px] ${expert.followed ? "text-ink-soft" : "text-on-accent"}`}>
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
        <Text className={`font-bodySemibold text-[11px] ${group.joined ? "text-ink-soft" : "text-on-accent"}`}>
          {group.joined ? "Anëtar" : "Bashkohu"}
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
        <ActivityIndicator className="text-olive" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      <View className="flex-row items-center px-5 pt-2 mb-4">
        <BackButton fallback="/(main)/community" />
        <Text className="font-display text-xl text-ink ml-1">Ekspertë dhe grupe</Text>
      </View>

      <View className="flex-row mx-5 mb-4 bg-cream-soft rounded-full p-1">
        <Pressable onPress={() => setTab("experts")} className={`flex-1 py-2 rounded-full items-center ${tab === "experts" ? "bg-ink" : ""}`}>
          <Text className={`font-bodyMedium text-xs ${tab === "experts" ? "text-on-accent" : "text-ink-soft"}`}>Ekspertë ({experts.length})</Text>
        </Pressable>
        <Pressable onPress={() => setTab("groups")} className={`flex-1 py-2 rounded-full items-center ${tab === "groups" ? "bg-ink" : ""}`}>
          <Text className={`font-bodyMedium text-xs ${tab === "groups" ? "text-on-accent" : "text-ink-soft"}`}>Grupe ({groups.length})</Text>
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}>
        {tab === "experts" ? (
          experts.length === 0 ? (
            <Text className="font-body text-xs text-ink-faint">Ende nuk ka ekspertë.</Text>
          ) : (
            experts.map((e) => (
              <ExpertRow key={e.id} expert={e} onOpen={() => router.push(`/community/expert/${e.id}`)} onToggleFollow={() => handleFollow(e)} />
            ))
          )
        ) : groups.length === 0 ? (
          <Text className="font-body text-xs text-ink-faint">Ende nuk ka grupe.</Text>
        ) : (
          groups.map((g) => (
            <GroupRow key={g.id} group={g} onOpen={() => router.push(`/community/group/${g.id}`)} onToggleJoin={() => handleJoin(g)} />
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}