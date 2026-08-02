import { useMemo, useState } from "react";
import { View, Text, ScrollView, Pressable, TextInput, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAppState } from "@/lib/state/AppStateContext";
import { Icon } from "@/components/ui/Icon";
import { shadows } from "@/lib/shadows";
import { postCatalog, commentCatalog, Comment } from "@/lib/communityContent";

function timeAgoLabel(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} orë`;
  return `${Math.floor(hrs / 24)} ditë`;
}

function Avatar({ initial, accent, size = 40 }: { initial: string; accent: "olive" | "orange"; size?: number }) {
  const bg = accent === "olive" ? "bg-olive-bg" : "bg-orange-bg";
  const fg = accent === "olive" ? "#6E7452" : "#C9702E";
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2 }} className={`items-center justify-center ${bg}`}>
      <Text style={{ color: fg, fontSize: size * 0.4 }} className="font-bodySemibold">{initial}</Text>
    </View>
  );
}

export default function PostDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { toggleLikePost, isPostLiked, toggleSavePost, isPostSaved } = useAppState();
  const [draft, setDraft] = useState("");
  // Komentet e reja mbahen vetëm brenda këtij sesioni (s'ka backend ende
  // për t'i ruajtur/shfaqur te përdorues të tjerë).
  const [localComments, setLocalComments] = useState<Comment[]>([]);

  const post = postCatalog.find((p) => p.id === id);
  const baseComments = useMemo(() => commentCatalog.filter((c) => c.postId === id), [id]);
  const allComments = [...baseComments, ...localComments];
  const topLevel = allComments.filter((c) => !c.parentId);
  const repliesOf = (cid: string) => allComments.filter((c) => c.parentId === cid);

  if (!post) {
    return (
      <SafeAreaView className="flex-1 bg-cream items-center justify-center px-8">
        <Text className="font-body text-sm text-ink-soft">Postimi s'u gjet.</Text>
      </SafeAreaView>
    );
  }

  const liked = isPostLiked(post.id);
  const saved = isPostSaved(post.id);

  const submitComment = () => {
    if (!draft.trim()) return;
    setLocalComments((prev) => [
      ...prev,
      { id: `local-${Date.now()}`, postId: post.id, author: "Ti", text: draft.trim(), at: new Date().toISOString(), parentId: null },
    ]);
    setDraft("");
  };

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      <View className="flex-row items-center px-5 pt-2 mb-3">
        <Pressable onPress={() => router.back()} style={shadows.soft} className="w-10 h-10 rounded-full bg-surface items-center justify-center mr-3">
          <Icon name="chevronLeft" size={18} color="#2C271F" />
        </Pressable>
        <Text className="font-display text-lg text-ink">Postimi</Text>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1">
        <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
          <View className="mx-5 bg-surface rounded-xl2 p-4 mb-2" style={shadows.soft}>
            <View className="flex-row items-center mb-3">
              <Avatar initial={post.authorInitial} accent={post.accent} />
              <View className="flex-1 ml-2.5">
                <View className="flex-row items-center">
                  <Text className="font-bodySemibold text-sm text-ink">{post.authorName}</Text>
                  {post.authorIsExpert && <Icon name="check" size={12} color="#6E7452" />}
                </View>
                <Text className="font-body text-[11px] text-ink-faint">
                  {timeAgoLabel(post.at)} {post.groupName ? `· ${post.groupName}` : ""}
                </Text>
              </View>
            </View>
            <Text className="font-body text-sm text-ink leading-5 mb-1">{post.text}</Text>
            {post.tag && <Text className="font-bodyMedium text-xs text-olive mb-3">{post.tag}</Text>}

            <View className="flex-row items-center justify-between mt-2 pt-3 border-t border-cream-line">
              <Pressable onPress={() => toggleLikePost(post.id)} className="flex-row items-center">
                <Icon name="heart" size={17} color={liked ? "#C9702E" : "#A79D8A"} />
                <Text className="font-body text-xs text-ink-soft ml-1.5">{post.likeCount + (liked ? 1 : 0)}</Text>
              </Pressable>
              <View className="flex-row items-center">
                <Icon name="comment" size={17} color="#A79D8A" />
                <Text className="font-body text-xs text-ink-soft ml-1.5">{allComments.length}</Text>
              </View>
              <Pressable className="flex-row items-center">
                <Icon name="share" size={17} color="#A79D8A" />
                <Text className="font-body text-xs text-ink-soft ml-1.5">{post.shareCount}</Text>
              </Pressable>
              <Pressable onPress={() => toggleSavePost(post.id)}>
                <Icon name="bookmark" size={17} color={saved ? "#6E7452" : "#A79D8A"} />
              </Pressable>
            </View>
          </View>

          {/* Comments */}
          <View className="px-5 mt-4">
            <Text className="font-bodySemibold text-sm text-ink mb-3">Komentet ({allComments.length})</Text>
            {topLevel.length === 0 ? (
              <Text className="font-body text-sm text-ink-soft">Bëhu i pari që komenton.</Text>
            ) : (
              topLevel.map((c) => (
                <View key={c.id} className="mb-4">
                  <View className="flex-row">
                    <Avatar initial={c.author[0]} accent="olive" size={32} />
                    <View className="flex-1 ml-2.5 bg-surface rounded-xl2 p-3" style={shadows.soft}>
                      <Text className="font-bodySemibold text-xs text-ink mb-0.5">{c.author}</Text>
                      <Text className="font-body text-sm text-ink-soft leading-5">{c.text}</Text>
                      <Text className="font-body text-[10px] text-ink-faint mt-1">{timeAgoLabel(c.at)}</Text>
                    </View>
                  </View>
                  {repliesOf(c.id).map((r) => (
                    <View key={r.id} className="flex-row ml-10 mt-2">
                      <Avatar initial={r.author[0]} accent="orange" size={26} />
                      <View className="flex-1 ml-2 bg-cream-soft rounded-xl2 p-3">
                        <Text className="font-bodySemibold text-xs text-ink mb-0.5">{r.author}</Text>
                        <Text className="font-body text-xs text-ink-soft leading-5">{r.text}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              ))
            )}
          </View>
        </ScrollView>

        {/* Comment input */}
        <View className="flex-row items-center px-5 py-3 border-t border-cream-line bg-cream">
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Shkruaj një koment..."
            placeholderTextColor="#A79D8A"
            className="flex-1 bg-surface rounded-full px-4 py-2.5 font-body text-sm text-ink mr-2"
          />
          <Pressable onPress={submitComment} className="w-10 h-10 rounded-full bg-olive items-center justify-center">
            <Icon name="send" size={16} color="#FFFFFF" />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}