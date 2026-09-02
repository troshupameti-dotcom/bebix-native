import { useCallback, useState } from "react";
import { View, Text, ScrollView, Pressable, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { useAppState } from "@/lib/state/AppStateContext";
import { shadows } from "@/lib/shadows";
import { Avatar, PostCard, timeAgoLabel } from "@/components/community/PostCard";
import {
  fetchPost, fetchComments, addComment, deletePost, getCurrentUserId,
  CommunityPost, CommunityComment,
} from "@/lib/communityData";

function CommentRow({ comment, isReply, onReply }: { comment: CommunityComment; isReply?: boolean; onReply: (comment: CommunityComment) => void }) {
  const initial = comment.authorName.trim().charAt(0).toUpperCase() || "?";
  return (
    <View className={`flex-row mb-4 ${isReply ? "ml-9 mt-3 mb-0" : ""}`}>
      <Avatar initial={initial} accent={isReply ? "orange" : "olive"} size={isReply ? 30 : 36} />
      <View className="flex-1 ml-2.5">
        <View style={shadows.soft} className="bg-surface rounded-xl2 px-3 py-2.5">
          <Text className="font-bodySemibold text-xs text-ink mb-0.5">{comment.authorName}</Text>
          <Text className="font-body text-xs text-ink-soft leading-5">{comment.text}</Text>
        </View>
        <View className="flex-row items-center mt-1.5 ml-1">
          <Text className="font-body text-[10px] text-ink-faint">{timeAgoLabel(comment.at)}</Text>
          <Pressable onPress={() => onReply(comment)} className="ml-3">
            <Text className="font-bodyMedium text-[10px] text-olive">Përgjigju</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

export default function PostDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { state } = useAppState();
  const [loading, setLoading] = useState(true);
  const [post, setPost] = useState<CommunityPost | null>(null);
  const [comments, setComments] = useState<CommunityComment[]>([]);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<CommunityComment | null>(null);
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [p, c, uid] = await Promise.all([fetchPost(id), fetchComments(id), getCurrentUserId()]);
      setPost(p);
      setComments(c);
      setMyUserId(uid);
    } catch (err) {
      console.warn("Post detail load error:", err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const topLevel = comments.filter((c) => c.parentId === null);
  const repliesOf = (commentId: string) => comments.filter((c) => c.parentId === commentId);

  async function handleSend() {
    if (!draft.trim() || !id || sending) return;
    setSending(true);
    try {
      await addComment({
        postId: id,
        text: draft.trim(),
        parentId: replyTo?.id ?? null,
        authorName: state.profile.parentName ?? "Ti",
      });
      setDraft("");
      setReplyTo(null);
      setComments(await fetchComments(id));
    } catch (err) {
      console.warn("Comment error:", err);
    } finally {
      setSending(false);
    }
  }

  async function handleDelete() {
    if (!id) return;
    try {
      await deletePost(id);
      router.back();
    } catch (err) {
      console.warn("Delete post error:", err);
    }
  }

  const isMyPost = post && myUserId && post.authorId === myUserId;

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-cream items-center justify-center">
        <ActivityIndicator color="#6E7452" />
      </SafeAreaView>
    );
  }

  if (!post) {
    return (
      <SafeAreaView className="flex-1 bg-cream items-center justify-center px-8">
        <Text className="font-bodySemibold text-base text-ink mb-2">Postimi s'u gjet</Text>
        <Text className="font-body text-sm text-ink-soft text-center mb-6">Ndoshta âsht fshi ose linku âsht i gabuem.</Text>
        <Pressable onPress={() => router.back()} className="bg-olive px-5 py-3 rounded-full">
          <Text className="font-bodySemibold text-sm text-white">Kthehu</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      <View className="flex-row items-center justify-between px-5 pt-2 mb-2">
        <Pressable onPress={() => router.back()} className="w-9 h-9 items-center justify-center -ml-2">
          <Text className="font-bodySemibold text-xl text-ink">←</Text>
        </Pressable>
        <Text className="font-bodySemibold text-base text-ink">Postimi</Text>
        {isMyPost ? (
          <Pressable onPress={handleDelete} className="w-9 h-9 items-center justify-center -mr-2">
            <Text className="font-bodyMedium text-xs text-orange">Fshij</Text>
          </Pressable>
        ) : (
          <View className="w-9 h-9" />
        )}
      </View>

      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={90}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
          <PostCard post={post} onOpen={() => {}} />

          <View className="px-5">
            <Text className="font-bodySemibold text-sm text-ink mb-4">
              Komente {comments.length > 0 ? `(${comments.length})` : ""}
            </Text>
            {topLevel.length === 0 ? (
              <Text className="font-body text-xs text-ink-faint mb-4">Bâhu i pari qi komenton.</Text>
            ) : (
              topLevel.map((c) => (
                <View key={c.id}>
                  <CommentRow comment={c} onReply={setReplyTo} />
                  {repliesOf(c.id).map((r) => (
                    <CommentRow key={r.id} comment={r} isReply onReply={setReplyTo} />
                  ))}
                </View>
              ))
            )}
          </View>
        </ScrollView>

        <View className="px-5 pt-2 pb-3 border-t border-cream-line bg-cream">
          {replyTo && (
            <View className="flex-row items-center justify-between mb-2 px-1">
              <Text className="font-body text-[11px] text-ink-faint">Përgjigje për {replyTo.authorName}</Text>
              <Pressable onPress={() => setReplyTo(null)}>
                <Text className="font-bodySemibold text-xs text-ink-faint">✕</Text>
              </Pressable>
            </View>
          )}
          <View style={shadows.soft} className="flex-row items-end bg-surface rounded-xl2 px-3 py-2">
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Shkruej një koment..."
              placeholderTextColor="#A79D8A"
              multiline
              className="flex-1 font-body text-sm text-ink max-h-24 py-1.5"
            />
            <Pressable
              onPress={handleSend}
              disabled={!draft.trim() || sending}
              className={`ml-2 w-9 h-9 rounded-full items-center justify-center ${draft.trim() ? "bg-olive" : "bg-cream-line"}`}
            >
              {sending ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text className={`font-bodySemibold text-base ${draft.trim() ? "text-white" : "text-ink-faint"}`}>➤</Text>
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}