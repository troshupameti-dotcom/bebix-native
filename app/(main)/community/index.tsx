import { useMemo, useState } from "react";
import { View, Text, ScrollView, Pressable, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAppState } from "@/lib/state/AppStateContext";
import { Icon, IconName } from "@/components/ui/Icon";
import { shadows } from "@/lib/shadows";
import {
  storyCatalog,
  topicCatalog,
  expertCatalog,
  groupCatalog,
  postCatalog,
  communityTipCatalog,
  commentCatalog,
  Post,
  Expert,
  Group,
} from "@/lib/communityContent";

function timeAgoLabel(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} orë`;
  return `${Math.floor(hrs / 24)} ditë`;
}

function SectionHeader({ title, onSeeAll }: { title: string; onSeeAll?: () => void }) {
  return (
    <View className="flex-row items-center justify-between mb-3 mt-7 px-5">
      <Text className="font-display text-lg text-ink">{title}</Text>
      {onSeeAll && (
        <Pressable onPress={onSeeAll}>
          <Text className="font-bodyMedium text-sm text-olive">Shiko të gjitha</Text>
        </Pressable>
      )}
    </View>
  );
}

function Avatar({ initial, accent, size = 44 }: { initial: string; accent: "olive" | "orange"; size?: number }) {
  const bg = accent === "olive" ? "bg-olive-bg" : "bg-orange-bg";
  const fg = accent === "olive" ? "#6E7452" : "#C9702E";
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2 }} className={`items-center justify-center ${bg}`}>
      <Text style={{ color: fg, fontSize: size * 0.4 }} className="font-bodySemibold">{initial}</Text>
    </View>
  );
}

function StoryBubble({ id, name, initial, accent, seen, isOwn }: (typeof storyCatalog)[number] & { onPress: () => void }) {
  return (
    <Pressable className="items-center mr-4 w-16">
      <View
        className={`w-16 h-16 rounded-full items-center justify-center ${seen ? "bg-cream-line" : "bg-olive"}`}
        style={{ padding: 2 }}
      >
        <View className="w-full h-full rounded-full bg-cream items-center justify-center">
          <Avatar initial={initial} accent={accent} size={56} />
        </View>
        {isOwn && (
          <View className="absolute bottom-0 right-0 w-5 h-5 rounded-full bg-olive items-center justify-center border-2 border-cream">
            <Icon name="plus" size={10} color="#FFFFFF" />
          </View>
        )}
      </View>
      <Text className="font-body text-[11px] text-ink-soft mt-1" numberOfLines={1}>{isOwn ? "Ti" : name}</Text>
    </Pressable>
  );
}

function TopicChip({ label, count }: { label: string; count: number }) {
  return (
    <View style={shadows.soft} className="bg-surface rounded-full px-4 py-2 mr-2 flex-row items-center">
      <Text className="font-bodyMedium text-xs text-ink">{label}</Text>
      <Text className="font-body text-[10px] text-ink-faint ml-1.5">{count}</Text>
    </View>
  );
}

function ExpertCard({ expert }: { expert: Expert }) {
  const { toggleFollowExpert, isExpertFollowed } = useAppState();
  const followed = isExpertFollowed(expert.id);
  const bg = expert.accent === "olive" ? "bg-olive-bg" : "bg-orange-bg";
  const fg = expert.accent === "olive" ? "#6E7452" : "#C9702E";
  return (
    <View style={shadows.soft} className="w-56 bg-surface rounded-xl2 p-4 mr-3">
      <View className="flex-row items-center mb-2">
        <View className={`w-11 h-11 rounded-full items-center justify-center mr-2 ${bg}`}>
          <Icon name={expert.icon} size={20} color={fg} />
        </View>
        <View className="flex-1">
          <View className="flex-row items-center">
            <Text className="font-bodySemibold text-xs text-ink" numberOfLines={1}>{expert.name}</Text>
            <Icon name="check" size={11} color="#6E7452" />
          </View>
          <Text className="font-body text-[10px] text-ink-faint">{expert.kind}</Text>
        </View>
      </View>
      <Text className="font-body text-[11px] text-ink-soft mb-3" numberOfLines={2}>{expert.bio}</Text>
      <View className="flex-row items-center justify-between">
        <Text className="font-bodyMedium text-[11px] text-ink-soft">⭐ {expert.rating} ({expert.reviewCount})</Text>
        <Pressable onPress={() => toggleFollowExpert(expert.id)} className={`px-3 py-1.5 rounded-full ${followed ? "bg-cream-soft" : "bg-olive"}`}>
          <Text className={`font-bodySemibold text-[10px] ${followed ? "text-ink-soft" : "text-white"}`}>
            {followed ? "Ndjekur" : "Ndiq"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function GroupCard({ group }: { group: Group }) {
  const { toggleJoinGroup, isGroupJoined } = useAppState();
  const joined = isGroupJoined(group.id);
  const bg = group.accent === "olive" ? "bg-olive-bg" : "bg-orange-bg";
  const fg = group.accent === "olive" ? "#6E7452" : "#C9702E";
  return (
    <View style={shadows.soft} className="w-48 bg-surface rounded-xl2 p-4 mr-3">
      <View className={`w-11 h-11 rounded-full items-center justify-center mb-2 ${bg}`}>
        <Icon name={group.icon} size={20} color={fg} />
      </View>
      <Text className="font-bodySemibold text-xs text-ink mb-1" numberOfLines={2}>{group.name}</Text>
      <Text className="font-body text-[10px] text-ink-faint mb-3">{group.memberCount.toLocaleString()} anëtarë</Text>
      <Pressable onPress={() => toggleJoinGroup(group.id)} className={`py-1.5 rounded-full items-center ${joined ? "bg-cream-soft" : "bg-olive"}`}>
        <Text className={`font-bodySemibold text-[11px] ${joined ? "text-ink-soft" : "text-white"}`}>
          {joined ? "Anëtar ✓" : "Bashkohu"}
        </Text>
      </Pressable>
    </View>
  );
}

function PostCard({ post, onOpen }: { post: Post; onOpen: () => void }) {
  const { toggleLikePost, isPostLiked, toggleSavePost, isPostSaved } = useAppState();
  const liked = isPostLiked(post.id);
  const saved = isPostSaved(post.id);
  const bg = post.accent === "olive" ? "bg-olive-bg" : "bg-orange-bg";

  return (
    <Pressable onPress={onOpen} style={shadows.soft} className="bg-surface rounded-xl2 p-4 mb-4 mx-5">
      <View className="flex-row items-center mb-3">
        <Avatar initial={post.authorInitial} accent={post.accent} />
        <View className="flex-1 ml-2.5">
          <View className="flex-row items-center">
            <Text className="font-bodySemibold text-sm text-ink" numberOfLines={1}>{post.authorName}</Text>
            {post.authorIsExpert && <Icon name="check" size={12} color="#6E7452" />}
          </View>
          <Text className="font-body text-[11px] text-ink-faint">
            {timeAgoLabel(post.at)} {post.groupName ? `· ${post.groupName}` : ""}
          </Text>
        </View>
        <View className={`w-8 h-8 rounded-full items-center justify-center ${bg}`}>
          <Icon name={post.icon} size={16} color={post.accent === "olive" ? "#6E7452" : "#C9702E"} />
        </View>
      </View>

      <Text className="font-body text-sm text-ink leading-5 mb-1">{post.text}</Text>
      {post.tag && <Text className="font-bodyMedium text-xs text-olive mb-3">{post.tag}</Text>}

      <View className="flex-row items-center justify-between mt-2 pt-3 border-t border-cream-line">
        <Pressable onPress={() => toggleLikePost(post.id)} className="flex-row items-center">
          <Icon name="heart" size={16} color={liked ? "#C9702E" : "#A79D8A"} />
          <Text className="font-body text-xs text-ink-soft ml-1.5">{post.likeCount + (liked ? 1 : 0)}</Text>
        </Pressable>
        <Pressable onPress={onOpen} className="flex-row items-center">
          <Icon name="comment" size={16} color="#A79D8A" />
          <Text className="font-body text-xs text-ink-soft ml-1.5">{post.commentCount}</Text>
        </Pressable>
        <Pressable className="flex-row items-center">
          <Icon name="share" size={16} color="#A79D8A" />
          <Text className="font-body text-xs text-ink-soft ml-1.5">{post.shareCount}</Text>
        </Pressable>
        <Pressable onPress={() => toggleSavePost(post.id)}>
          <Icon name="bookmark" size={16} color={saved ? "#6E7452" : "#A79D8A"} />
        </Pressable>
      </View>
    </Pressable>
  );
}

export default function CommunityScreen() {
  const router = useRouter();
  const [query, setQuery] = useState("");

  const filteredPosts = useMemo(() => {
    if (!query.trim()) return postCatalog;
    const q = query.toLowerCase();
    return postCatalog.filter((p) => p.text.toLowerCase().includes(q) || p.tag?.toLowerCase().includes(q) || p.authorName.toLowerCase().includes(q));
  }, [query]);

  // "AI Recommended" — për tani, thjesht postimet me më shumë engagement;
  // rekomandim real do të kërkojë interesat/aktivitetin e ruajtur në backend.
  const aiRecommended = useMemo(() => postCatalog.slice().sort((a, b) => b.likeCount - a.likeCount).slice(0, 3), []);

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      <View className="flex-row items-center justify-between px-5 pt-2 mb-4">
        <Text className="font-display text-2xl text-ink">Komuniteti</Text>
        <Pressable
          onPress={() => router.push("/community/saved")}
          style={shadows.soft}
          className="w-10 h-10 rounded-full bg-surface items-center justify-center"
        >
          <Icon name="bookmark" size={18} color="#2C271F" />
        </Pressable>
      </View>

      {/* Search */}
      <View className="px-5 mb-4">
        <View style={shadows.soft} className="flex-row items-center bg-surface rounded-xl2 px-4 py-3">
          <Icon name="search" size={18} color="#A79D8A" />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Kërko postime, grupe, ekspertë..."
            placeholderTextColor="#A79D8A"
            className="flex-1 ml-2 font-body text-sm text-ink"
          />
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Stories */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20 }}>
          {storyCatalog.map((s) => (
            <StoryBubble key={s.id} {...s} onPress={() => {}} />
          ))}
        </ScrollView>

        {/* Trending topics */}
        <SectionHeader title="Në trend" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20 }}>
          {topicCatalog.map((t) => (
            <TopicChip key={t.id} label={t.label} count={t.postCount} />
          ))}
        </ScrollView>

        {/* Parenting tips */}
        <SectionHeader title="Këshilla për prindër" />
        <View className="px-5">
          {communityTipCatalog.map((tip) => (
            <View key={tip.id} style={shadows.soft} className="flex-row bg-olive-bg rounded-xl2 p-4 mb-3">
              <View className="w-9 h-9 rounded-full bg-surface items-center justify-center mr-3">
                <Icon name={tip.icon} size={16} color="#6E7452" />
              </View>
              <View className="flex-1">
                <Text className="font-bodySemibold text-xs text-ink mb-1">{tip.title}</Text>
                <Text className="font-body text-xs text-ink-soft leading-5">{tip.body}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Featured experts */}
        <SectionHeader title="Ekspertë të Verifikuar" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20 }}>
          {expertCatalog.map((e) => (
            <ExpertCard key={e.id} expert={e} />
          ))}
        </ScrollView>

        {/* Featured / suggested groups */}
        <SectionHeader title="Grupe të Sugjeruara" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20 }}>
          {groupCatalog.map((g) => (
            <GroupCard key={g.id} group={g} />
          ))}
        </ScrollView>

        {/* AI recommended posts */}
        <SectionHeader title="✨ Rekomanduar për ty" />
        {aiRecommended.map((p) => (
          <PostCard key={p.id} post={p} onOpen={() => router.push(`/community/post/${p.id}`)} />
        ))}

        {/* Main feed */}
        <SectionHeader title={query.trim() ? "Rezultatet" : "Feed"} />
        {filteredPosts.length === 0 ? (
          <Text className="font-body text-sm text-ink-soft px-5">S'u gjet asgjë.</Text>
        ) : (
          filteredPosts.map((p) => <PostCard key={p.id} post={p} onOpen={() => router.push(`/community/post/${p.id}`)} />)
        )}
      </ScrollView>

      {/* Floating "new post" button */}
      <Pressable
        onPress={() => router.push("/community/new")}
        style={shadows.softLg}
        className="absolute bottom-6 right-6 w-14 h-14 rounded-full bg-olive items-center justify-center"
      >
        <Icon name="plus" size={24} color="#FFFFFF" />
      </Pressable>
    </SafeAreaView>
  );
}