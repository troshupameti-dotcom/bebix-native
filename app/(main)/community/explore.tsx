import { useCallback, useMemo, useState } from "react";
import { View, Text, ScrollView, Pressable, ActivityIndicator, RefreshControl, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Icon } from "@/components/ui/Icon";
import { shadows } from "@/lib/shadows";
import { BackButton } from "@/components/ui/BackButton";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { useThemeColors } from "@/lib/theme/useThemeColors";
import { logWarn } from "@/lib/log";
import { useSpecialties } from "@/lib/community/useSpecialties";
import { specialtyEmoji, specialtyLabel, type Specialty } from "@/lib/community/specialties";
import {
  fetchExperts, fetchGroups,
  toggleFollowExpert as apiToggleFollowExpert, toggleJoinGroup as apiToggleJoinGroup,
  CommunityExpert, CommunityGroup,
} from "@/lib/communityData";

type Tab = "experts" | "groups";

function ExpertRow({
  expert, dept, emoji, onOpen, onToggleFollow,
}: { expert: CommunityExpert; dept: string; emoji: string | null; onOpen: () => void; onToggleFollow: () => void }) {
  const { t } = useTranslation();
  const bg = expert.accent === "olive" ? "bg-olive-bg" : "bg-orange-bg";
  const fg = expert.accent === "olive" ? "#6E7452" : "#C9702E";
  return (
    <Pressable onPress={onOpen} style={shadows.soft} className="bg-surface rounded-xl2 p-4 mb-3 flex-row items-center">
      <View className={`w-12 h-12 rounded-full items-center justify-center mr-3 ${bg}`}>
        {emoji ? <Text className="text-xl">{emoji}</Text> : <Icon name={expert.icon} size={22} color={fg} />}
      </View>
      <View className="flex-1">
        <View className="flex-row items-center">
          <Text className="font-bodySemibold text-sm text-ink" numberOfLines={1}>{expert.name}</Text>
          <Icon name="check" size={12} color="#6E7452" />
        </View>
        <Text className="font-body text-xs text-ink-faint mb-0.5" numberOfLines={1}>{dept}</Text>
        {expert.reviewCount > 0 && (
          <Text className="font-bodyMedium text-[11px] text-ink-soft">
            {expert.rating.toFixed(1)} · {t("cexplore_reviews", { n: expert.reviewCount })}
          </Text>
        )}
      </View>
      <Pressable onPress={onToggleFollow} className={`px-3 py-1.5 rounded-full ${expert.followed ? "bg-cream-soft" : "bg-olive"}`}>
        <Text className={`font-bodySemibold text-[11px] ${expert.followed ? "text-ink-soft" : "text-on-accent"}`}>
          {expert.followed ? t("cexp_following") : t("cexp_follow")}
        </Text>
      </Pressable>
    </Pressable>
  );
}

function GroupRow({ group, onOpen, onToggleJoin }: { group: CommunityGroup; onOpen: () => void; onToggleJoin: () => void }) {
  const { t } = useTranslation();
  const bg = group.accent === "olive" ? "bg-olive-bg" : "bg-orange-bg";
  const fg = group.accent === "olive" ? "#6E7452" : "#C9702E";
  return (
    <Pressable onPress={onOpen} style={shadows.soft} className="bg-surface rounded-xl2 p-4 mb-3 flex-row items-center">
      <View className={`w-12 h-12 rounded-full items-center justify-center mr-3 ${bg}`}>
        <Icon name={group.icon} size={22} color={fg} />
      </View>
      <View className="flex-1">
        <Text className="font-bodySemibold text-sm text-ink" numberOfLines={1}>{group.name}</Text>
        <Text className="font-body text-xs text-ink-faint">{t("cexp_members", { n: group.memberCount.toLocaleString() })}</Text>
      </View>
      <Pressable onPress={onToggleJoin} className={`px-3 py-1.5 rounded-full ${group.joined ? "bg-cream-soft" : "bg-olive"}`}>
        <Text className={`font-bodySemibold text-[11px] ${group.joined ? "text-ink-soft" : "text-on-accent"}`}>
          {group.joined ? t("cexplore_joined") : t("cexplore_join")}
        </Text>
      </Pressable>
    </Pressable>
  );
}

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      className={`rounded-full px-3.5 py-1.5 mr-2 ${selected ? "bg-ink" : "bg-cream-soft"}`}
    >
      <Text className={`font-bodyMedium text-xs ${selected ? "text-on-accent" : "text-ink-soft"}`}>{label}</Text>
    </Pressable>
  );
}

/** Emri i repartit të ekspertit; ekspertët e vjetër (pa reparte) mbajnë tekstin e lirë të specializimit. */
function deptOf(expert: CommunityExpert, language: string, list: Specialty[]): string {
  return specialtyLabel(expert.specialty, language, list) ?? expert.kind;
}

export default function ExploreScreen() {
  const router = useRouter();
  const { t, language } = useTranslation();
  const theme = useThemeColors();
  const specialties = useSpecialties();
  const [tab, setTab] = useState<Tab>("experts");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [experts, setExperts] = useState<CommunityExpert[]>([]);
  const [groups, setGroups] = useState<CommunityGroup[]>([]);
  const [dept, setDept] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    try {
      const [e, g] = await Promise.all([fetchExperts(), fetchGroups()]);
      setExperts(e); setGroups(g);
    } catch (err) {
      logWarn("Explore load error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

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

  // Repartet që kanë ekspertë (chip-et s'tregojnë reparte bosh).
  const departments = useMemo(() => {
    const present = new Set(experts.map((e) => e.specialty).filter((x): x is string => !!x));
    return specialties.list.filter((s) => present.has(s.key));
  }, [experts, specialties.list]);

  const q = search.trim().toLowerCase();
  const visible = useMemo(
    () =>
      experts.filter((e) => {
        if (dept && e.specialty !== dept) return false;
        if (!q) return true;
        return e.name.toLowerCase().includes(q) || deptOf(e, language, specialties.list).toLowerCase().includes(q);
      }),
    [experts, dept, q, language, specialties.list]
  );

  // Pa filtër: ekspertët ndahen në seksione sipas repartit (si "reparte" te një spital); me filtër: listë e thjeshtë.
  const sections = useMemo(() => {
    if (dept || q) return null;
    const order = new Map(specialties.list.map((s, i) => [s.key, i]));
    const map = new Map<string, { title: string; emoji: string | null; items: CommunityExpert[]; rank: number }>();
    for (const e of visible) {
      const id = e.specialty ?? `kind:${e.kind}`;
      const entry = map.get(id) ?? {
        title: deptOf(e, language, specialties.list),
        emoji: e.specialty ? specialtyEmoji(e.specialty, specialties.list) : null,
        items: [],
        rank: e.specialty ? (order.get(e.specialty) ?? 500) : 1000,
      };
      entry.items.push(e);
      map.set(id, entry);
    }
    return [...map.values()].sort((a, b) => a.rank - b.rank || a.title.localeCompare(b.title));
  }, [visible, dept, q, language, specialties.list]);

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-cream items-center justify-center">
        <ActivityIndicator className="text-olive" />
      </SafeAreaView>
    );
  }

  const renderExpert = (e: CommunityExpert) => (
    <ExpertRow
      key={e.id}
      expert={e}
      dept={deptOf(e, language, specialties.list)}
      emoji={e.specialty ? specialtyEmoji(e.specialty, specialties.list) : null}
      onOpen={() => router.push(`/community/expert/${e.id}`)}
      onToggleFollow={() => handleFollow(e)}
    />
  );

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      <View className="flex-row items-center px-5 pt-2 mb-4">
        <BackButton fallback="/(main)/community" />
        <Text className="font-display text-xl text-ink ml-1">{t("community_experts_groups")}</Text>
      </View>

      <View className="flex-row mx-5 mb-4 bg-cream-soft rounded-full p-1">
        <Pressable onPress={() => setTab("experts")} className={`flex-1 py-2 rounded-full items-center ${tab === "experts" ? "bg-ink" : ""}`}>
          <Text className={`font-bodyMedium text-xs ${tab === "experts" ? "text-on-accent" : "text-ink-soft"}`}>{t("cexplore_tab_experts", { n: experts.length })}</Text>
        </Pressable>
        <Pressable onPress={() => setTab("groups")} className={`flex-1 py-2 rounded-full items-center ${tab === "groups" ? "bg-ink" : ""}`}>
          <Text className={`font-bodyMedium text-xs ${tab === "groups" ? "text-on-accent" : "text-ink-soft"}`}>{t("cexplore_tab_groups", { n: groups.length })}</Text>
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.olive} colors={[theme.olive]} progressBackgroundColor={theme.surface} />
        }
      >
        {tab === "experts" ? (
          <>
            {experts.length > 0 && (
              <>
                <View className="flex-row items-center bg-surface border border-cream-line rounded-xl2 px-3.5 py-2.5 mb-3">
                  <Icon name="search" size={18} color={theme.inkFaint} />
                  <TextInput
                    value={search}
                    onChangeText={setSearch}
                    placeholder={t("cexplore_search_ph")}
                    placeholderTextColor={theme.inkFaint}
                    autoCorrect={false}
                    className="flex-1 ml-2 font-body text-sm text-ink"
                  />
                  {search.length > 0 && (
                    <Pressable onPress={() => setSearch("")} hitSlop={8} accessibilityLabel={t("community_clear_search")}>
                      <Icon name="close" size={16} color={theme.inkFaint} />
                    </Pressable>
                  )}
                </View>
                {departments.length > 1 && (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-3 -mx-5" contentContainerStyle={{ paddingHorizontal: 20 }}>
                    <Chip label={t("cexplore_dept_all")} selected={dept === null} onPress={() => setDept(null)} />
                    {departments.map((s) => (
                      <Chip
                        key={s.key}
                        label={`${s.emoji} ${language === "en" ? s.labelEn : s.label}`}
                        selected={dept === s.key}
                        onPress={() => setDept(dept === s.key ? null : s.key)}
                      />
                    ))}
                  </ScrollView>
                )}
              </>
            )}

            {experts.length === 0 ? (
              <Text className="font-body text-xs text-ink-faint">{t("cexplore_no_experts")}</Text>
            ) : visible.length === 0 ? (
              <Text className="font-body text-xs text-ink-faint">{t("cexplore_no_match")}</Text>
            ) : sections ? (
              sections.map((s) => (
                <View key={s.title} className="mb-2">
                  <Text className="font-bodySemibold text-xs text-ink-soft mb-2 mt-1">
                    {s.emoji ? `${s.emoji} ` : ""}{s.title} · {s.items.length}
                  </Text>
                  {s.items.map(renderExpert)}
                </View>
              ))
            ) : (
              visible.map(renderExpert)
            )}
          </>
        ) : groups.length === 0 ? (
          <Text className="font-body text-xs text-ink-faint">{t("cexplore_no_groups")}</Text>
        ) : (
          groups.map((g) => (
            <GroupRow key={g.id} group={g} onOpen={() => router.push(`/community/group/${g.id}`)} onToggleJoin={() => handleJoin(g)} />
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
