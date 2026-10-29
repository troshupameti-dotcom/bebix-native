import { useCallback, useState } from "react";
import { View, Text, FlatList, Pressable, ActivityIndicator, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { BackButton } from "@/components/ui/BackButton";
import { Avatar, PostCard } from "@/components/community/PostCard";
import { ProfileStats } from "@/components/community/ProfileStats";
import { haptics } from "@/lib/haptics";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { useThemeColors } from "@/lib/theme/useThemeColors";
import { logWarn } from "@/lib/log";
import { fetchExpertByUserId, fetchPostsByAuthor, getCurrentUserId, type CommunityPost } from "@/lib/communityData";
import {
  fetchPublicProfile, followUser, isMissing, messageErrorKey, startConversation, unfollowUser, type PublicProfile,
} from "@/lib/community/messages";

/**
 * Profili publik i një prindi: emri, ndjekësit, "Ndiq" dhe "Shkruaj", postimet.
 * "Shkruaj" punon kur njëri ndjek tjetrin (mjafton njëra palë). Ekspertët kanë
 * faqen e tyre; për ta, ky ekran të çon atje.
 */
export default function UserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t } = useTranslation();
  const theme = useThemeColors();
  const [profile, setProfile] = useState<PublicProfile | null | undefined>(undefined);
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [busy, setBusy] = useState<"follow" | "message" | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const me = await getCurrentUserId();
      if (me === id) {
        router.replace("/community/profile");
        return;
      }
      let p: PublicProfile | null = null;
      try {
        p = await fetchPublicProfile(id);
      } catch (err) {
        // Pa migrimin e mesazheve funksioni s'ekziston: profili del sërish, pa ndjekje dhe mesazhe.
        if (!isMissing(err as { code?: string })) throw err;
      }
      const expertId = p ? p.expertId : ((await fetchExpertByUserId(id))?.id ?? null);
      if (expertId) {
        router.replace(`/community/expert/${expertId}`);
        return;
      }
      const list = await fetchPostsByAuthor(id);
      setPosts(list);
      setProfile(
        p ?? {
          userId: id, name: list[0]?.authorName ?? "Prind", expertId: null, followers: 0, following: 0,
          iFollow: false, followsMe: false, canMessage: false, blocked: false, limited: true,
        }
      );
    } catch (err) {
      logWarn("User profile load error:", err);
      setProfile((prev) => prev ?? null);
    }
  }, [id, router]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  async function toggleFollow() {
    if (!profile || busy) return;
    setBusy("follow");
    haptics.tap();
    try {
      if (profile.iFollow) await unfollowUser(profile.userId);
      else await followUser(profile.userId);
      setProfile(await fetchPublicProfile(profile.userId));
    } catch (err) {
      Alert.alert(t("mod_error_title"), t(messageErrorKey(err)));
    } finally {
      setBusy(null);
    }
  }

  async function openChat() {
    if (!profile || busy) return;
    setBusy("message");
    haptics.tap();
    try {
      const conversationId = await startConversation(profile.userId);
      router.push(`/community/chat/${conversationId}`);
    } catch (err) {
      Alert.alert(t("mod_error_title"), t(messageErrorKey(err)));
    } finally {
      setBusy(null);
    }
  }

  const header = profile ? (
    <View className="items-center px-5 pb-4 pt-2">
      <Avatar initial={profile.name.trim().charAt(0).toUpperCase() || "?"} accent="olive" size={88} userId={profile.userId} />
      <Text className="mt-3 font-display text-xl text-ink">{profile.name}</Text>
      {profile.followsMe ? <Text className="mt-1 font-bodyMedium text-[11px] text-olive">{t("dm_follows_you")}</Text> : null}
      {/* Postime · Ndjekës · Të ndjekur: listat i sheh vetëm kush është mik (ndiqni njëri-tjetrin). */}
      {!profile.limited ? (
        <ProfileStats userId={profile.userId} name={profile.name} posts={posts.length} followers={profile.followers} following={profile.following} />
      ) : null}

      {!profile.blocked && !profile.limited ? (
        <View className="mt-4 w-full flex-row" style={{ gap: 10 }}>
          <Pressable
            onPress={() => void toggleFollow()}
            disabled={!!busy}
            accessibilityRole="button"
            className={`flex-1 items-center justify-center rounded-full ${profile.iFollow ? "border border-cream-line bg-surface" : "bg-olive"}`}
            style={{ minHeight: 48 }}
          >
            {busy === "follow" ? (
              <ActivityIndicator color={profile.iFollow ? theme.ink : theme.onAccent} />
            ) : (
              <Text className={`font-bodySemibold text-sm ${profile.iFollow ? "text-ink" : "text-on-accent"}`}>
                {profile.iFollow ? t("dm_unfollow") : profile.followsMe ? t("dm_follow_back") : t("dm_follow")}
              </Text>
            )}
          </Pressable>
          <Pressable
            onPress={() => void openChat()}
            disabled={!profile.canMessage || !!busy}
            accessibilityRole="button"
            accessibilityState={{ disabled: !profile.canMessage }}
            className={`flex-1 items-center justify-center rounded-full ${profile.canMessage ? "bg-ink" : "bg-cream-line"}`}
            style={{ minHeight: 48 }}
          >
            {busy === "message" ? (
              <ActivityIndicator color={theme.onAccent} />
            ) : (
              <Text className={`font-bodySemibold text-sm ${profile.canMessage ? "text-on-accent" : "text-ink-faint"}`}>{t("dm_message")}</Text>
            )}
          </Pressable>
        </View>
      ) : null}
      {!profile.canMessage && !profile.blocked && !profile.limited ? <Text className="mt-2 text-center font-body text-[11px] text-ink-faint">{t("dm_follow_to_message")}</Text> : null}

      <Text className="mt-6 self-start font-bodySemibold text-sm text-ink">{t("dm_posts")}</Text>
    </View>
  ) : undefined;

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      <View className="flex-row items-center px-5 pb-2 pt-2">
        <BackButton fallback="/(main)/community" />
      </View>
      {profile === undefined ? <ActivityIndicator className="mt-10" color={theme.olive} /> : null}
      {profile === null ? <Text className="mt-10 text-center font-body text-sm text-ink-soft">{t("dm_profile_missing")}</Text> : null}
      {profile ? (
        <FlatList
          data={posts}
          keyExtractor={(p) => p.id}
          ListHeaderComponent={header}
          renderItem={({ item }) => <PostCard post={item} linkAuthor={false} onOpen={() => router.push(`/community/post/${item.id}`)} />}
          ListEmptyComponent={<Text className="px-5 font-body text-xs text-ink-faint">{t("dm_no_posts")}</Text>}
          contentContainerStyle={{ paddingBottom: 32 }}
        />
      ) : null}
    </SafeAreaView>
  );
}
