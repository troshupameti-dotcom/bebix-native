import { useCallback, useState } from "react";
import { View, Text, ScrollView, Pressable, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { useAppState } from "@/lib/state/AppStateContext";
import { shadows } from "@/lib/shadows";
import { fetchTopics, fetchGroups, createPost, CommunityTopic, CommunityGroup } from "@/lib/communityData";

export default function NewPostScreen() {
  const router = useRouter();
  const { state } = useAppState();
  const [text, setText] = useState("");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [topics, setTopics] = useState<CommunityTopic[]>([]);
  const [groups, setGroups] = useState<CommunityGroup[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [t, g] = await Promise.all([fetchTopics(), fetchGroups()]);
      setTopics(t);
      setGroups(g);
    } catch (err) {
      console.warn("New post load error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const canPost = text.trim().length > 0 && !posting;

  async function handlePost() {
    if (!canPost) return;
    setPosting(true);
    setError(null);
    try {
      await createPost({
        text: text.trim(),
        tag: selectedTag,
        groupId: selectedGroupId,
        authorName: state.profile.parentName ?? "Ti",
      });
      router.back();
    } catch (e: any) {
      setError(e.message ?? "S'u arrit me postu. Provo prap.");
    } finally {
      setPosting(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      <View className="flex-row items-center justify-between px-5 pt-2 mb-4">
        <Pressable onPress={() => router.back()} className="w-9 h-9 items-center justify-center -ml-2">
          <Text className="font-bodySemibold text-lg text-ink">✕</Text>
        </Pressable>
        <Text className="font-bodySemibold text-base text-ink">Postim i Ri</Text>
        <Pressable
          onPress={handlePost}
          disabled={!canPost}
          className={`px-4 py-1.5 rounded-full ${canPost ? "bg-olive" : "bg-cream-line"}`}
        >
          {posting ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text className={`font-bodySemibold text-xs ${canPost ? "text-white" : "text-ink-faint"}`}>Posto</Text>
          )}
        </Pressable>
      </View>

      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={90}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
          <View className="px-5">
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="Çka ke në mendje? Ndaj një përvojë, pyetje, apo moment..."
              placeholderTextColor="#A79D8A"
              multiline
              autoFocus
              className="font-body text-sm text-ink min-h-[120px]"
              textAlignVertical="top"
            />
          </View>

          {error && <Text className="font-body text-xs text-orange px-5 mt-2">{error}</Text>}

          {!loading && topics.length > 0 && (
            <>
              <Text className="font-bodySemibold text-xs text-ink-soft px-5 mt-6 mb-2">Shto etiketë (opsionale)</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20 }}>
                {topics.map((t) => {
                  const active = selectedTag === t.label;
                  return (
                    <Pressable
                      key={t.id}
                      onPress={() => setSelectedTag(active ? null : t.label)}
                      style={shadows.soft}
                      className={`rounded-full px-4 py-2 mr-2 ${active ? "bg-olive" : "bg-surface"}`}
                    >
                      <Text className={`font-bodyMedium text-xs ${active ? "text-white" : "text-ink"}`}>{t.label}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </>
          )}

          {!loading && groups.length > 0 && (
            <>
              <Text className="font-bodySemibold text-xs text-ink-soft px-5 mt-6 mb-2">Posto në grup (opsionale)</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20 }}>
                {groups.map((g) => {
                  const active = selectedGroupId === g.id;
                  return (
                    <Pressable
                      key={g.id}
                      onPress={() => setSelectedGroupId(active ? null : g.id)}
                      style={shadows.soft}
                      className={`rounded-full px-4 py-2 mr-2 ${active ? "bg-olive" : "bg-surface"}`}
                    >
                      <Text className={`font-bodyMedium text-xs ${active ? "text-white" : "text-ink"}`} numberOfLines={1}>{g.name}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}