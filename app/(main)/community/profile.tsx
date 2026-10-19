import { useCallback, useState } from "react";
import { View, Text, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { pickMedia } from "@/lib/media/imagePicker";
import { expertPhotoUrl, setMyExpertPhoto } from "@/lib/community/expertPhoto";
import { setCachedAvatar, setMyCommunityAvatar } from "@/lib/community/avatars";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { BadgeCheck, Camera } from "lucide-react-native";
import { useAppState } from "@/lib/state/AppStateContext";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { useThemeColors } from "@/lib/theme/useThemeColors";
import { useTones } from "@/lib/theme/tone";
import { Avatar, PostCard } from "@/components/community/PostCard";
import { ProfileStats } from "@/components/community/ProfileStats";
import { BackButton } from "@/components/ui/BackButton";
import { getCurrentUserId, fetchPostsByAuthor, fetchExpertByUserId, CommunityExpert, CommunityPost } from "@/lib/communityData";
import { fetchPublicProfile, type PublicProfile } from "@/lib/community/messages";
import { logWarn } from "@/lib/log";
import { useSpecialties } from "@/lib/community/useSpecialties";
import { specialtyLabel } from "@/lib/community/specialties";

/**
 * Profili im në komunitet, njësoj si e shohin të tjerët: emri publik (për mjekun, emri i regjistrimit si mjek, ai
 * që del te postimet), fotoja (çdo prind mund ta vendosë; del edhe te postimet e vjetra), Postime · Ndjekës · Të ndjekur.
 */
export default function MyProfileScreen() {
  const router = useRouter();
  const { state } = useAppState();
  const { t, language } = useTranslation();
  const theme = useThemeColors();
  const tones = useTones();
  const specialties = useSpecialties();
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<string | null>(null);
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [expert, setExpert] = useState<CommunityExpert | null>(null);
  const [publicProfile, setPublicProfile] = useState<PublicProfile | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const uid = await getCurrentUserId();
      setMe(uid);
      if (!uid) {
        setPosts([]);
        setExpert(null);
        return;
      }
      const [p, e, pub] = await Promise.all([
        fetchPostsByAuthor(uid),
        fetchExpertByUserId(uid),
        fetchPublicProfile(uid).catch(() => null),
      ]);
      setPosts(p);
      setExpert(e);
      setPublicProfile(pub);
    } catch (err) {
      logWarn("My profile load error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  async function changePhoto() {
    setPhotoError(null);
    const result = await pickMedia("library", { mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 0.8 }, t);
    const asset = result?.assets[0];
    if (!asset || !me) return;
    setPhotoBusy(true);
    try {
      const photo = { uri: asset.uri, mimeType: asset.mimeType ?? null };
      if (expert) {
        const path = await setMyExpertPhoto(photo);
        setCachedAvatar(me, expertPhotoUrl(path));
      } else {
        await setMyCommunityAvatar(photo);
      }
      await load();
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : t("cprof_photo_failed"));
    } finally {
      setPhotoBusy(false);
    }
  }

  // I njëjti emër si te postimet: mjeku me emrin e verifikuar, prindi me emrin publik.
  const name = expert?.name || publicProfile?.name || state.profile.parentName || "Ti";
  const initial = name.trim().charAt(0).toUpperCase() || "T";

  if (loading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-cream">
        <ActivityIndicator color={theme.inkSoft} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      <View className="mb-2 flex-row items-center px-5 pt-2">
        <BackButton fallback="/(main)/community" />
        <Text className="ml-1 font-display text-xl text-ink">{t("community_profile_title")}</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        <View className="mb-5 mt-2 items-center px-5">
          {/* Fotoja: çdo prind e ndërron; kur ndërrohet, del e reja edhe te postimet e vjetra. */}
          <Pressable
            onPress={changePhoto}
            disabled={photoBusy || !me}
            accessibilityRole="button"
            accessibilityLabel={t("cprof_change_photo")}
            className="items-center"
          >
            <View>
              <Avatar initial={initial} accent="olive" size={92} userId={me} />
              <View
                style={{ backgroundColor: theme.ink, borderColor: theme.cream }}
                className="absolute bottom-0 right-0 h-8 w-8 items-center justify-center rounded-full border-2"
              >
                {photoBusy ? <ActivityIndicator size="small" color={theme.cream} /> : <Camera size={15} color={theme.cream} strokeWidth={2.2} />}
              </View>
            </View>
          </Pressable>
          {photoError ? <Text className="mt-2 font-body text-xs text-orange">{photoError}</Text> : null}

          <View className="mt-3 flex-row items-center">
            <Text className="font-display text-xl text-ink">{name}</Text>
            {expert ? <BadgeCheck size={18} color={theme.surface} fill={tones.green.tint} strokeWidth={2.2} style={{ marginLeft: 5 }} /> : null}
          </View>

          {expert ? (
            <Text className="mt-1 font-bodyMedium text-[13px] text-ink-soft">
              {t("cprof_verified_kind", { kind: specialtyLabel(expert.specialty, language, specialties.list) ?? expert.kind })}
            </Text>
          ) : (
            <Pressable onPress={() => router.push("/more/doctor-registration", { withAnchor: true })} hitSlop={8}>
              <Text className="mt-1 font-bodyMedium text-[13px] text-olive">{t("cprof_become_expert")}</Text>
            </Pressable>
          )}

          {me ? (
            <ProfileStats
              userId={me}
              name={name}
              posts={posts.length}
              followers={publicProfile?.followers ?? 0}
              following={publicProfile?.following ?? 0}
            />
          ) : null}
        </View>

        <View className="mb-3 px-5">
          <Text className="font-bodySemibold text-sm text-ink">{t("cprof_my_posts")}</Text>
        </View>

        {posts.length === 0 ? (
          <View className="px-5">
            <Text className="mb-4 font-body text-xs text-ink-faint">{t("cprof_empty")}</Text>
            <Pressable onPress={() => router.push("/community/new")} className="self-start rounded-full bg-olive px-5 py-3">
              <Text className="font-bodySemibold text-xs text-on-accent">{t("cprof_post_something")}</Text>
            </Pressable>
          </View>
        ) : (
          posts.map((p) => (
            <PostCard
              key={p.id}
              post={p}
              linkAuthor={false}
              onOpen={() => router.push(`/community/post/${p.id}`)}
              onRemoved={(id, reason) => (reason === "blocked" ? load() : setPosts((prev) => prev.filter((x) => x.id !== id)))}
            />
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
