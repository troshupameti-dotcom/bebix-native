import { useCallback, useState } from "react";
import { View, Text, ScrollView, Pressable, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator, Alert, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useFocusEffect } from "expo-router";
import { useAppState } from "@/lib/state/AppStateContext";
import { shadows } from "@/lib/shadows";
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

function CommentRow({
  comment,
  isReply,
  onReply,
  onMore,
  t,
}: {
  comment: CommunityComment;
  isReply?: boolean;
  onReply: (comment: CommunityComment) => void;
  onMore: (comment: CommunityComment) => void;
  t: (key: any, params?: Record<string, string | number>) => string;
}) {
  const initial = comment.authorName.trim().charAt(0).toUpperCase() || "?";
  return (
    <View className={`flex-row mb-4 ${isReply ? "ml-9 mt-3 mb-0" : ""}`}>
      <Avatar initial={initial} accent="olive" size={isReply ? 30 : 36} />
      <View className="flex-1 ml-2.5">
        <Pressable
          onLongPress={() => {
            haptics.select();
            onMore(comment);
          }}
          delayLongPress={350}
          style={shadows.soft}
          className={`bg-surface rounded-xl2 px-3 py-2.5 ${comment.expert ? "border-l-[3px] border-olive" : ""}`}
        >
          {/* Përgjigjet e mjekëve dhe të ekspertëve dallohen me reparte, jo vetëm me emër. */}
          {comment.expert ? <ExpertBadge specialty={comment.expert.specialty} kind={comment.expert.kind} compact /> : null}
          <Text className="font-bodySemibold text-xs text-ink mb-0.5">{comment.authorName}</Text>
          <Text className="font-body text-xs text-ink-soft leading-5">{comment.text}</Text>
        </Pressable>
        <View className="flex-row items-center mt-1.5 ml-1">
          <Text className="font-body text-[10px] text-ink-faint">{timeAgoLabel(comment.at, t)}</Text>
          <Pressable onPress={() => onReply(comment)} hitSlop={8} className="ml-3">
            <Text className="font-bodyMedium text-[10px] text-olive">{t("cpost_reply")}</Text>
          </Pressable>
          <Pressable
            onPress={() => onMore(comment)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t("cpost_more_comment")}
            className="ml-3"
          >
            <Text className="font-bodySemibold text-xs leading-3 text-ink-faint">⋯</Text>
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

  const topLevel = comments.filter((c) => c.parentId === null);
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
      setDraft("");
      setReplyTo(null);
      setComments(await fetchComments(id));
    } catch (err) {
      Alert.alert(t("mod_error_title"), friendlyError(err, t, "cpost_comment_failed"));
    } finally {
      setSending(false);
    }
  }

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

      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={90}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 24 }}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.olive} colors={[theme.olive]} progressBackgroundColor={theme.surface} />
          }
        >
          <PostCard
            post={post}
            onOpen={() => {}}
            interactiveMedia
            // Postimi u fshi ose autori u bllokua: s'ka më çfarë të shihet këtu.
            onRemoved={() => goBackOr("/(main)/community")}
          />

          <View className="px-5">
            <Text className="font-bodySemibold text-sm text-ink mb-4">
              {t("cpost_comments")} {comments.length > 0 ? `(${comments.length})` : ""}
            </Text>
            {topLevel.length === 0 ? (
              <Text className="font-body text-xs text-ink-faint mb-4">{t("cpost_first_comment")}</Text>
            ) : (
              topLevel.map((c) => (
                <View key={c.id}>
                  <CommentRow comment={c} onReply={setReplyTo} onMore={openCommentMenu} t={t} />
                  {repliesOf(c.id).map((r) => (
                    <CommentRow key={r.id} comment={r} isReply onReply={setReplyTo} onMore={openCommentMenu} t={t} />
                  ))}
                </View>
              ))
            )}
          </View>
        </ScrollView>

        <View className="px-5 pt-2 pb-3 border-t border-cream-line bg-cream">
          {replyTo && (
            <View className="flex-row items-center justify-between mb-2 px-1">
              <Text className="font-body text-[11px] text-ink-faint">{t("cpost_reply_to", { name: replyTo.authorName })}</Text>
              <Pressable onPress={() => setReplyTo(null)} hitSlop={10} accessibilityRole="button" accessibilityLabel={t("cpost_cancel_reply")}>
                <Icon name="close" size={14} color="#7A7062" />
              </Pressable>
            </View>
          )}
          <View style={shadows.soft} className="flex-row items-end bg-surface rounded-xl2 px-3 py-2">
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder={replyTo ? t("cpost_ph_reply") : t("cpost_ph_comment")}
              placeholderClassName="text-ink-faint"
              multiline
              maxLength={MAX_COMMENT}
              className="flex-1 font-body text-sm text-ink max-h-24 py-1.5"
            />
            <Pressable
              onPress={handleSend}
              disabled={!canSend}
              accessibilityRole="button"
              accessibilityLabel={t("cpost_send")}
              className={`ml-2 w-9 h-9 rounded-full items-center justify-center ${canSend ? "bg-olive" : "bg-cream-line"}`}
            >
              {sending ? (
                <ActivityIndicator className="text-on-accent" size="small" />
              ) : (
                <Icon name="send" size={16} color={canSend ? "#FFFFFF" : "#7A7062"} />
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>

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
