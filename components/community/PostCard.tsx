import { useState } from "react";
import { View, Text, Pressable } from "react-native";
import { Icon } from "@/components/ui/Icon";
import { shadows } from "@/lib/shadows";
import { CommunityPost, toggleLike as apiToggleLike, toggleSave as apiToggleSave } from "@/lib/communityData";

export function timeAgoLabel(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "tani";
  if (mins < 60) return `${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} orë`;
  return `${Math.floor(hrs / 24)} ditë`;
}

export function Avatar({ initial, accent, size = 44 }: { initial: string; accent: "olive" | "orange"; size?: number }) {
  const bg = accent === "olive" ? "bg-olive-bg" : "bg-orange-bg";
  const fg = accent === "olive" ? "#6E7452" : "#C9702E";
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2 }} className={`items-center justify-center ${bg}`}>
      <Text style={{ color: fg, fontSize: size * 0.4 }} className="font-bodySemibold">{initial}</Text>
    </View>
  );
}

export function PostCard({ post, onOpen }: { post: CommunityPost; onOpen: () => void }) {
  const [liked, setLiked] = useState(post.liked);
  const [saved, setSaved] = useState(post.saved);
  const [likeCount, setLikeCount] = useState(post.likeCount);
  const bg = post.accent === "olive" ? "bg-olive-bg" : "bg-orange-bg";

  async function handleLike() {
    const next = !liked;
    setLiked(next);
    setLikeCount((c) => c + (next ? 1 : -1));
    try {
      await apiToggleLike(post.id, liked);
    } catch {
      setLiked(!next);
      setLikeCount((c) => c + (next ? -1 : 1));
    }
  }

  async function handleSave() {
    const next = !saved;
    setSaved(next);
    try {
      await apiToggleSave(post.id, saved);
    } catch {
      setSaved(!next);
    }
  }

  return (
    <Pressable
      onPress={onOpen}
      style={shadows.soft}
      className={`bg-surface rounded-xl2 p-4 mb-4 mx-5 ${post.authorIsExpert ? "border-l-[3px] border-olive" : ""}`}
    >
      {post.authorIsExpert && (
        <View className="flex-row items-center bg-olive-bg self-start rounded-full px-2.5 py-1 mb-3">
          <Icon name="shield" size={11} color="#6E7452" />
          <Text className="font-bodySemibold text-[10px] text-olive ml-1">Përgjigje nga ekspert i verifikuar</Text>
        </View>
      )}

      <View className="flex-row items-center mb-3">
        <Avatar initial={post.authorInitial} accent={post.accent} />
        <View className="flex-1 ml-2.5">
          <Text className="font-bodySemibold text-sm text-ink" numberOfLines={1}>{post.authorName}</Text>
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
        <Pressable
          onPress={handleLike}
          className={`flex-row items-center px-3 py-1.5 rounded-full ${liked ? "bg-olive-bg" : "bg-cream-soft"}`}
        >
          <Icon name="heart" size={14} color={liked ? "#6E7452" : "#A79D8A"} />
          <Text className={`font-bodySemibold text-[11px] ml-1.5 ${liked ? "text-olive" : "text-ink-soft"}`}>
            M'ndihmoi{likeCount > 0 ? ` · ${likeCount}` : ""}
          </Text>
        </Pressable>

        <Pressable onPress={onOpen} className="flex-row items-center">
          <Icon name="comment" size={16} color="#A79D8A" />
          <Text className="font-body text-xs text-ink-soft ml-1.5">{post.commentCount}</Text>
        </Pressable>

        <Pressable onPress={handleSave}>
          <Icon name="bookmark" size={16} color={saved ? "#6E7452" : "#A79D8A"} />
        </Pressable>
      </View>
    </Pressable>
  );
}