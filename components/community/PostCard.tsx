import { useState } from "react";
import { View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { BadgeCheck, Bookmark, Ellipsis, Heart, Info, MessageCircle, Send } from "lucide-react-native";
import { haptics } from "@/lib/haptics";
import { useCurrentUserId } from "@/lib/hooks/useCurrentUserId";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { useThemeColors } from "@/lib/theme/useThemeColors";
import { useTones } from "@/lib/theme/tone";
import { timeAgoLabel } from "@/lib/i18n/timeAgo";
import { sharePost } from "@/lib/community/share";
import { useSpecialties } from "@/lib/community/useSpecialties";
import { specialtyLabel } from "@/lib/community/specialties";
import {
  CommunityPost,
  deletePost,
  toggleLike as apiToggleLike,
  toggleSave as apiToggleSave,
} from "@/lib/communityData";
import { PostMediaGrid } from "@/components/community/PostMediaGrid";
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
  /** Te detajet e postimit: videoja luhet në vend (dhe teksti del i plotë). */
  interactiveMedia?: boolean;
  /** false te faqja e vetë autorit (profili, eksperti): emri s'hap sërish të njëjtën faqe. */
  linkAuthor?: boolean;
};

/** Te feed-i teksti i gjatë pritet pas kaq rreshtash; "Lexo më shumë" hap postimin. */
const FEED_LINES = 6;
/** Mbi kaq shkronja teksti zakonisht kalon 6 rreshta: atëherë del "Lexo më shumë". */
const LONG_TEXT = 280;

/**
 * Karta e postimit: e thjeshtë dhe e lexueshme. Koka (autori, ✓ për ekspertin e verifikuar, reparti, koha, grupi),
 * teksti, fotot/videot, dhe një rresht veprimesh: "M'ndihmoi", komentet, shpërndarja, ruajtja. Pa hije të rënda dhe
 * pa ngjyra të ngulitura: ndjek temën e çelët dhe të errët.
 */
export function PostCard({ post, onOpen, onRemoved, interactiveMedia = false, linkAuthor = true }: PostCardProps) {
  const myId = useCurrentUserId();
  const router = useRouter();
  const { t, language } = useTranslation();
  const theme = useThemeColors();
  const tones = useTones();
  const specialties = useSpecialties();
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

  const text = post.text.trim();
  const clamp = !interactiveMedia && text.length > LONG_TEXT;
  const expertLabel = post.authorIsExpert
    ? specialtyLabel(post.authorSpecialty, language, specialties.list) ?? t("pc_verified_expert")
    : null;
  const meta = [expertLabel, timeAgoLabel(post.at, t), post.groupName].filter(Boolean).join(" · ");
  const like = tones.pink;
  const iconColor = theme.inkSoft;

  return (
    <Pressable
      onPress={onOpen}
      className="mx-4 mb-3 rounded-3xl border border-cream-line bg-surface px-4 pb-1.5 pt-4"
      style={({ pressed }) => ({ opacity: pressed ? 0.97 : 1 })}
    >
      {/* Koka: emri dhe fotoja hapin profilin e autorit (aty: Ndiq, Shkruaj). */}
      <View className="flex-row items-center">
        <Pressable
          onPress={() => {
            haptics.tap();
            router.push(`/community/user/${post.authorId}`);
          }}
          disabled={!linkAuthor}
          accessibilityRole={linkAuthor ? "button" : undefined}
          accessibilityLabel={post.authorIsExpert ? `${post.authorName}, ${expertLabel}` : post.authorName}
          className="flex-1 flex-row items-center"
        >
          <Avatar initial={post.authorInitial} accent={post.accent} size={42} />
          <View className="ml-3 flex-1">
            <View className="flex-row items-center">
              <Text className="flex-shrink font-bodySemibold text-[15px] text-ink" numberOfLines={1}>
                {post.authorName}
              </Text>
              {post.authorIsExpert ? (
                <BadgeCheck size={16} color={theme.surface} fill={tones.green.tint} strokeWidth={2.2} style={{ marginLeft: 4 }} />
              ) : null}
            </View>
            <Text className="mt-0.5 font-body text-[12.5px] text-ink-faint" numberOfLines={1}>
              {meta}
            </Text>
          </View>
        </Pressable>
        <Pressable
          onPress={openMenu}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={t("pc_more_actions")}
          className="-mr-1 ml-2 h-9 w-9 items-center justify-center rounded-full"
        >
          <Ellipsis size={20} color={theme.inkFaint} strokeWidth={2.2} />
        </Pressable>
      </View>

      {/* Teksti: i madh dhe i lexueshëm; te feed-i i gjati pritet me "Lexo më shumë". */}
      {text ? (
        <View className="mt-3">
          <Text className="font-body text-[15px] leading-[22px] text-ink" numberOfLines={clamp ? FEED_LINES : undefined}>
            {text}
          </Text>
          {clamp ? (
            <Text onPress={onOpen} accessibilityRole="link" className="mt-1 font-bodySemibold text-[14px] text-ink-soft">
              {t("pc_read_more")}
            </Text>
          ) : null}
        </View>
      ) : null}

      {post.tag ? (
        <View className="mt-2.5 self-start rounded-full bg-cream-soft px-3 py-1">
          <Text className="font-bodyMedium text-[12px] text-ink-soft">{`#${post.tag}`}</Text>
        </View>
      ) : null}

      {post.media.length ? (
        <View className="mt-3">
          <PostMediaGrid media={post.media} interactive={interactiveMedia} onPress={interactiveMedia ? undefined : onOpen} />
        </View>
      ) : null}

      {post.authorIsExpert ? (
        <View className="mt-1 flex-row items-center">
          <Info size={12} color={theme.inkFaint} strokeWidth={2} />
          <Text className="ml-1.5 flex-1 font-body text-[11.5px] leading-4 text-ink-faint">{t("pc_expert_disclaimer")}</Text>
        </View>
      ) : null}

      {/* Veprimet: një rresht i qetë, me zona prekjeje ≥ 40pt. */}
      <View className="mt-2 flex-row items-center">
        <Pressable
          onPress={handleLike}
          accessibilityRole="button"
          accessibilityLabel={likeCount > 0 ? `${t("pc_helped")}, ${likeCount}` : t("pc_helped")}
          accessibilityState={{ selected: liked }}
          className="-ml-2 h-10 flex-row items-center rounded-full px-2.5"
          style={liked ? { backgroundColor: like.tintBg } : undefined}
        >
          <Heart size={19} color={liked ? like.tint : iconColor} fill={liked ? like.tint : "transparent"} strokeWidth={2} />
          <Text className="ml-1.5 font-bodySemibold text-[13px]" style={{ color: liked ? like.tint : iconColor }}>
            {t("pc_helped")}
            {likeCount > 0 ? ` · ${likeCount}` : ""}
          </Text>
        </Pressable>

        <Pressable
          onPress={onOpen}
          accessibilityRole="button"
          accessibilityLabel={`${t("pc_comments")}, ${post.commentCount}`}
          className="ml-1 h-10 flex-row items-center rounded-full px-2.5"
        >
          <MessageCircle size={19} color={iconColor} strokeWidth={2} />
          {post.commentCount > 0 ? (
            <Text className="ml-1.5 font-bodySemibold text-[13px]" style={{ color: iconColor }}>
              {post.commentCount}
            </Text>
          ) : null}
        </Pressable>

        <View className="flex-1" />

        <Pressable
          onPress={() => {
            haptics.tap();
            sharePost(post);
          }}
          accessibilityRole="button"
          accessibilityLabel={t("pc_share")}
          className="h-10 w-10 items-center justify-center rounded-full"
        >
          <Send size={18} color={iconColor} strokeWidth={2} />
        </Pressable>

        <Pressable
          onPress={handleSave}
          accessibilityRole="button"
          accessibilityLabel={saved ? t("pc_unsave") : t("pc_save")}
          accessibilityState={{ selected: saved }}
          className="-mr-2 h-10 w-10 items-center justify-center rounded-full"
        >
          <Bookmark size={19} color={saved ? theme.ink : iconColor} fill={saved ? theme.ink : "transparent"} strokeWidth={2} />
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
