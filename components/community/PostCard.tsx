import { useState } from "react";
import { View, Text, Pressable } from "react-native";
import { Icon } from "@/components/ui/Icon";
import { shadows } from "@/lib/shadows";
import { haptics } from "@/lib/haptics";
import { useCurrentUserId } from "@/lib/hooks/useCurrentUserId";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { timeAgoLabel } from "@/lib/i18n/timeAgo";
import { sharePost } from "@/lib/community/share";
import {
  CommunityPost,
  deletePost,
  toggleLike as apiToggleLike,
  toggleSave as apiToggleSave,
} from "@/lib/communityData";
import { PostMediaGrid } from "@/components/community/PostMediaGrid";
import { ExpertBadge } from "@/components/community/ExpertBadge";
import { ModerationSheet, type ModerationTarget } from "@/components/community/ModerationSheet";


export function Avatar({ initial, accent, size = 44 }: { initial: string; accent: "olive" | "orange"; size?: number }) {
  const bg = accent === "olive" ? "bg-olive-bg" : "bg-orange-bg";
  const fg = accent === "olive" ? "text-olive" : "text-orange";
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2 }} className={`items-center justify-center ${bg}`}>
      <Text style={{ fontSize: size * 0.4 }} className={`font-bodySemibold ${fg}`}>{initial}</Text>
    </View>
  );
}

export type PostRemovedReason = "deleted" | "blocked";

type PostCardProps = {
  post: CommunityPost;
  onOpen: () => void;
  /**
   * Postimi u fshi (nga autori) ose autori u bllokua. Lista duhet ta heqë
   * postimin — për "blocked", duhet rifreskuar, sepse zhduken të gjitha
   * postimet e atij autori.
   */
  onRemoved?: (postId: string, reason: PostRemovedReason) => void;
  /** Te detajet e postimit: videoja luhet në vend. */
  interactiveMedia?: boolean;
};

export function PostCard({ post, onOpen, onRemoved, interactiveMedia = false }: PostCardProps) {
  const myId = useCurrentUserId();
  const { t } = useTranslation();
  const [liked, setLiked] = useState(post.liked);
  const [saved, setSaved] = useState(post.saved);
  const [likeCount, setLikeCount] = useState(post.likeCount);
  const [menu, setMenu] = useState<ModerationTarget | null>(null);
  const isMine = !!myId && myId === post.authorId;

  // Rifreskimi (tërheqja poshtë) sjell numra të rinj: kartela i ndjek, jo i mban ata që kishte kur u hap.
  const [seen, setSeen] = useState({ liked: post.liked, saved: post.saved, likeCount: post.likeCount });
  if (seen.liked !== post.liked || seen.saved !== post.saved || seen.likeCount !== post.likeCount) {
    setSeen({ liked: post.liked, saved: post.saved, likeCount: post.likeCount });
    setLiked(post.liked);
    setSaved(post.saved);
    setLikeCount(post.likeCount);
  }

  async function handleLike() {
    haptics.tap();
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
    haptics.tap();
    const next = !saved;
    setSaved(next);
    try {
      await apiToggleSave(post.id, saved);
    } catch {
      setSaved(!next);
    }
  }

  function openMenu() {
    haptics.tap();
    setMenu({ kind: "post", id: post.id, authorId: post.authorId, authorName: post.authorName, isMine });
  }

  return (
    <Pressable
      onPress={onOpen}
      style={shadows.soft}
      className={`bg-surface rounded-xl2 p-4 mb-4 mx-5 ${post.authorIsExpert ? "border-l-[3px] border-olive" : ""}`}
    >
      {post.authorIsExpert && <ExpertBadge specialty={post.authorSpecialty} />}

      <View className="flex-row items-center mb-3">
        <Avatar initial={post.authorInitial} accent={post.accent} />
        <View className="flex-1 ml-2.5">
          <Text className="font-bodySemibold text-sm text-ink" numberOfLines={1}>{post.authorName}</Text>
          <Text className="font-body text-[11px] text-ink-faint" numberOfLines={1}>
            {timeAgoLabel(post.at, t)} {post.groupName ? `· ${post.groupName}` : ""}
          </Text>
        </View>
        <Pressable
          onPress={openMenu}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={t("pc_more_actions")}
          className="ml-1 h-8 w-8 items-center justify-center"
        >
          <Text className="font-bodySemibold text-lg leading-5 text-ink-faint">⋯</Text>
        </Pressable>
      </View>

      {post.text.trim() ? <Text className="font-body text-sm text-ink leading-5 mb-2">{post.text}</Text> : null}
      <PostMediaGrid media={post.media} interactive={interactiveMedia} onPress={interactiveMedia ? undefined : onOpen} />
      {post.tag ? (
        <View className="self-start bg-cream-soft rounded-full px-2.5 py-1 mb-2">
          <Text className="font-bodyMedium text-[11px] text-ink-soft">{post.tag}</Text>
        </View>
      ) : null}
      {post.authorIsExpert ? (
        <Text className="font-body text-[10px] leading-4 text-ink-faint mb-1">{t("pc_expert_disclaimer")}</Text>
      ) : null}

      <View className="flex-row items-center justify-between mt-1 pt-3 border-t border-cream-line">
        <Pressable
          onPress={handleLike}
          accessibilityRole="button"
          accessibilityState={{ selected: liked }}
          className={`flex-row items-center px-3 py-1.5 rounded-full ${liked ? "bg-olive-bg" : "bg-cream-soft"}`}
        >
          <Icon name="heart" size={14} color={liked ? "#6E7452" : "#A79D8A"} />
          <Text className={`font-bodySemibold text-[11px] ml-1.5 ${liked ? "text-olive" : "text-ink-soft"}`}>
            {t("pc_helped")}{likeCount > 0 ? ` · ${likeCount}` : ""}
          </Text>
        </Pressable>

        <Pressable onPress={onOpen} accessibilityRole="button" accessibilityLabel={t("pc_comments")} className="flex-row items-center px-2 py-1.5">
          <Icon name="comment" size={16} color="#A79D8A" />
          <Text className="font-body text-xs text-ink-soft ml-1.5">{post.commentCount}</Text>
        </Pressable>

        <Pressable
          onPress={() => {
            haptics.tap();
            sharePost(post);
          }}
          accessibilityRole="button"
          accessibilityLabel={t("pc_share")}
          className="px-2 py-1.5"
        >
          <Icon name="share" size={16} color="#A79D8A" />
        </Pressable>

        <Pressable
          onPress={handleSave}
          accessibilityRole="button"
          accessibilityLabel={saved ? t("pc_unsave") : t("pc_save")}
          className="px-2 py-1.5"
        >
          <Icon name="bookmark" size={16} color={saved ? "#6E7452" : "#A79D8A"} />
        </Pressable>
      </View>

      <ModerationSheet
        target={menu}
        onClose={() => setMenu(null)}
        onDelete={async () => {
          await deletePost(post);
          onRemoved?.(post.id, "deleted");
        }}
        onBlocked={() => onRemoved?.(post.id, "blocked")}
      />
    </Pressable>
  );
}
