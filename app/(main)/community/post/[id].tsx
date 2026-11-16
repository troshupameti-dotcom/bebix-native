import { useCallback, useRef, useState, type ComponentRef } from "react";
import { View, Text, ScrollView, Pressable, TextInput, ActivityIndicator, Alert, RefreshControl } from "react-native";
import { KeyboardSafeView } from "@/lib/ui/keyboard";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useFocusEffect, useRouter } from "expo-router";
import { MessageCircle } from "lucide-react-native";
import { useAppState } from "@/lib/state/AppStateContext";
import { haptics } from "@/lib/haptics";
import { useCurrentUserId } from "@/lib/hooks/useCurrentUserId";
import { Icon } from "@/components/ui/Icon";
import { Avatar, PostCard } from "@/components/community/PostCard";
import { ExpertBadge } from "@/components/community/ExpertBadge";
import { timeAgoLabel } from "@/lib/i18n/timeAgo";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { useThemeColors } from "@/lib/theme/useThemeColors";
import { ModerationSheet, type ModerationTarget } from "@/components/community/ModerationSheet";
import { BackButton, goBackOr } from "@/components/ui/BackButton";
import { logWarn } from "@/lib/log";
import {
  fetchPost, fetchComments, addComment, deleteComment,
  CommunityPost, CommunityComment,
} from "@/lib/communityData";
import { friendlyError } from "@/lib/errors/userMessage";

const MAX_COMMENT = 1000;

/** Përgjigjet e mjekëve dalin të parat; mes tyre dhe mes të tjerave ruhet radha e kohës. */
export function expertsFirst(list: CommunityComment[]): CommunityComment[] {
  return [...list.filter((c) => c.expert), ...list.filter((c) => !c.expert)];
}

function CommentRow({
  comment,
  isReply,
  onReply,
  onMore,
  onAuthor,
  t,
}: {
  comment: CommunityComment;
  isReply?: boolean;
  onReply: (comment: CommunityComment) => void;
  onMore: (comment: CommunityComment) => void;
  onAuthor: (comment: CommunityComment) => void;
  t: (key: any, params?: Record<string, string | number>) => string;
}) {
  const initial = comment.authorName.trim().charAt(0).toUpperCase() || "?";
  return (
    <View className={`flex-row ${isReply ? "ml-11 mt-3" : "mt-4"}`}>
      <Pressable onPress={() => onAuthor(comment)} accessibilityRole="button" accessibilityLabel={comment.authorName}>
        <Avatar initial={initial} accent="olive" size={isReply ? 30 : 36} userId={comment.authorId} />
      </Pressable>
      <View className="ml-2.5 flex-1">
        <Pressable
          onLongPress={() => {
            haptics.select();
            onMore(comment);
          }}
          delayLongPress={350}
          className={`rounded-2xl px-3.5 py-2.5 ${comment.expert ? "border border-olive bg-olive-bg" : "bg-surface border border-cream-line"}`}
        >
          {/* Përgjigjet e mjekëve dhe të ekspertëve dallohen me reparte, jo vetëm me emër. */}
          {comment.expert ? <ExpertBadge specialty={comment.expert.specialty} kind={comment.expert.kind} compact /> : null}
          <Text onPress={() => onAuthor(comment)} className="mb-0.5 font-bodySemibold text-[13.5px] text-ink">
            {comment.authorName}
          </Text>
          <Text className="font-body text-[14.5px] leading-[21px] text-ink">{comment.text}</Text>
        </Pressable>
        <View className="ml-1 mt-1 flex-row items-center">
          <Text className="font-body text-[12px] text-ink-faint">{timeAgoLabel(comment.at, t)}</Text>
          <Pressable onPress={() => onReply(comment)} hitSlop={10} accessibilityRole="button" className="ml-4 justify-center" style={{ minHeight: 28 }}>
            <Text className="font-bodySemibold text-[12.5px] text-olive">{t("cpost_reply")}</Text>
          </Pressable>
          <Pressable onPress={() => onMore(comment)} hitSlop={10} accessibilityRole="button" accessibilityLabel={t("cpost_more_comment")} className="ml-4 justify-center" style={{ minHeight: 28 }}>
            <Text className="font-bodySemibold text-[15px] leading-4 text-ink-faint">⋯</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

export default function PostDetailScreen() {
  const { t } = useTranslation();
  const theme = useThemeColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state } = useAppState();
  const myId = useCurrentUserId();
  const router = useRouter();
  const inputRef = useRef<ComponentRef<typeof TextInput>>(null);
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [post, setPost] = useState<CommunityPost | null>(null);
  const [comments, setComments] = useState<CommunityComment[]>([]);
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<CommunityComment | null>(null);
  const [sending, setSending] = useState(false);
  const [commentMenu, setCommentMenu] = useState<ModerationTarget | null>(null);

  const load = useCallback(async (quiet = false) => {
    if (!id) return;
    if (!quiet) setLoading(true);
    try {
      const [p, c] = await Promise.all([fetchPost(id), fetchComments(id)]);
      setPost(p);
      setComments(c);
    } catch (err) {
      logWarn("Post detail load error:", err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Tërhiq poshtë për komentet e reja (si te Facebook-u): rifreskon postimin dhe komentet pa e fshehur ekranin.
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load(true);
    setRefreshing(false);
  }, [load]);

  const topLevel = expertsFirst(comments.filter((c) => c.parentId === null));
  const repliesOf = (commentId: string) => comments.filter((c) => c.parentId === commentId);
  const canSend = draft.trim().length > 0 && !sending;

  async function handleSend() {
    if (!canSend || !id) return;
    setSending(true);
    try {
      await addComment({
        postId: id,
        text: draft.trim(),
        parentId: replyTo?.id ?? null,
        authorName: state.profile.parentName ?? "",
      });
      haptics.tap();
      const wasReply = !!replyTo;
      setDraft("");
      setReplyTo(null);
      setComments(await fetchComments(id));
      // Komenti i ri del në fund: lista zbret aty, që ta shohësh të dërguar.
      if (!wasReply) setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 150);
    } catch (err) {
      Alert.alert(t("mod_error_title"), friendlyError(err, t, "cpost_comment_failed"));
    } finally {
      setSending(false);
    }
  }

  function startReply(c: CommunityComment) {
    setReplyTo(c);
    inputRef.current?.focus();
  }
  const openAuthor = (c: CommunityComment) => router.push(`/community/user/${c.authorId}`);
  const myInitial = (state.profile.parentName || "T").trim().charAt(0).toUpperCase();

  function openCommentMenu(c: CommunityComment) {
    setCommentMenu({ kind: "comment", id: c.id, authorId: c.authorId, authorName: c.authorName, isMine: c.authorId === myId });
  }

  if (loading && !post) {
    return (
      <SafeAreaView className="flex-1 bg-cream items-center justify-center">
        <ActivityIndicator className="text-olive" />
      </SafeAreaView>
    );
  }

  if (!post) {
    return (
      <SafeAreaView className="flex-1 bg-cream items-center justify-center px-8">
        <Text className="font-bodySemibold text-base text-ink mb-2">{t("cpost_not_found")}</Text>
        <Text className="font-body text-sm text-ink-soft text-center mb-6">{t("cpost_not_found_body")}</Text>
        <Pressable onPress={() => goBackOr("/(main)/community")} className="bg-olive px-5 py-3 rounded-full">
          <Text className="font-bodySemibold text-sm text-on-accent">{t("cpost_back")}</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      <View className="flex-row items-center px-5 pt-2 mb-2">
        <BackButton fallback="/(main)/community" className="mr-3" />
        <Text className="font-display text-xl text-ink">{t("cpost_title")}</Text>
      </View>

      <KeyboardSafeView>
        <ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 24 }}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.olive} colors={[theme.olive]} progressBackgroundColor={theme.surface} />
          }
        >
          <PostCard
            post={post}
            // Te detajet, ikona e komentit hap fushën e shkrimit.
            onOpen={() => inputRef.current?.focus()}
            interactiveMedia
            // Postimi u fshi ose autori u bllokua: s'ka më çfarë të shihet këtu.
            onRemoved={() => goBackOr("/(main)/community")}
          />

          <View className="px-4">
            <Text className="mt-1 font-bodySemibold text-[16px] text-ink" accessibilityRole="header">
              {t("cpost_comments")}
              {comments.length > 0 ? ` · ${comments.length}` : ""}
            </Text>
            {topLevel.length === 0 ? (
              <Pressable onPress={() => inputRef.current?.focus()} accessibilityRole="button" className="mt-3 items-center rounded-3xl border border-cream-line bg-surface px-6 py-7 active:opacity-80">
                <View className="mb-3 h-12 w-12 items-center justify-center rounded-full bg-cream-soft">
                  <MessageCircle size={22} color={theme.olive} strokeWidth={1.8} />
                </View>
                <Text className="text-center font-bodySemibold text-[14.5px] text-ink">{t("cpost_first_comment")}</Text>
                <Text className="mt-1 text-center font-body text-[13px] leading-5 text-ink-soft">{t("cpost_first_comment_sub")}</Text>
              </Pressable>
            ) : (
              topLevel.map((c) => (
                <View key={c.id}>
                  <CommentRow comment={c} onReply={startReply} onMore={openCommentMenu} onAuthor={openAuthor} t={t} />
                  {repliesOf(c.id).map((r) => (
                    <CommentRow key={r.id} comment={r} isReply onReply={startReply} onMore={openCommentMenu} onAuthor={openAuthor} t={t} />
                  ))}
                </View>
              ))
            )}
          </View>
        </ScrollView>

        <View className="border-t border-cream-line bg-cream px-4 pb-3 pt-2">
          {replyTo && (
            <View className="mb-2 flex-row items-center justify-between rounded-full bg-cream-soft py-1.5 pl-3.5 pr-2">
              <Text numberOfLines={1} className="flex-1 font-bodyMedium text-[12.5px] text-ink-soft">
                {t("cpost_reply_to", { name: replyTo.authorName })}
              </Text>
              <Pressable onPress={() => setReplyTo(null)} hitSlop={10} accessibilityRole="button" accessibilityLabel={t("cpost_cancel_reply")} className="h-7 w-7 items-center justify-center">
                <Icon name="close" size={14} color={theme.inkSoft} />
              </Pressable>
            </View>
          )}
          <View className="flex-row items-end" style={{ gap: 8 }}>
            <View className="mb-1">
              <Avatar initial={myInitial} accent="olive" size={34} userId={myId} />
            </View>
            <View className="flex-1 flex-row items-end rounded-3xl border border-cream-line bg-surface py-1 pl-4 pr-1.5">
              <TextInput
                ref={inputRef}
                value={draft}
                onChangeText={setDraft}
                placeholder={replyTo ? t("cpost_ph_reply") : t("cpost_ph_comment")}
                placeholderTextColor={theme.inkFaint}
                multiline
                maxLength={MAX_COMMENT}
                className="max-h-28 flex-1 py-2 font-body text-[15px] text-ink"
              />
              <Pressable
                onPress={handleSend}
                disabled={!canSend}
                accessibilityRole="button"
                accessibilityLabel={t("cpost_send")}
                className={`mb-0.5 ml-2 h-9 w-9 items-center justify-center rounded-full ${canSend ? "bg-olive" : "bg-cream-soft"}`}
              >
                {sending ? <ActivityIndicator className="text-on-accent" size="small" /> : <Icon name="send" size={16} color={canSend ? theme.onAccent : theme.inkFaint} />}
              </Pressable>
            </View>
          </View>
        </View>
      </KeyboardSafeView>

      <ModerationSheet
        target={commentMenu}
        onClose={() => setCommentMenu(null)}
        onDelete={async () => {
          if (!commentMenu) return;
          await deleteComment(commentMenu.id);
          setComments((prev) => prev.filter((c) => c.id !== commentMenu.id && c.parentId !== commentMenu.id));
        }}
        onBlocked={() => void load()}
      />
    </SafeAreaView>
  );
}
