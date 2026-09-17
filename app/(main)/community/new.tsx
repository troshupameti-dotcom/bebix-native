import { useCallback, useState } from "react";
import { View, Text, ScrollView, Pressable, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator, Image, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { useAppState } from "@/lib/state/AppStateContext";
import { shadows } from "@/lib/shadows";
import { haptics } from "@/lib/haptics";
import { Icon } from "@/components/ui/Icon";
import { fetchTopics, fetchGroups, createPost, CommunityTopic, CommunityGroup } from "@/lib/communityData";
import { BackButton, goBackOr } from "@/components/ui/BackButton";
import { MAX_POST_MEDIA, MAX_VIDEO_SECONDS, MAX_FILE_BYTES, type LocalMedia } from "@/lib/community/media";
import { formatVideoDuration } from "@/components/community/PostVideo";

const MAX_TEXT = 2000;

function toLocalMedia(a: ImagePicker.ImagePickerAsset): LocalMedia {
  return {
    uri: a.uri,
    type: a.type === "video" ? "video" : "image",
    width: a.width,
    height: a.height,
    // Picker-i e jep kohëzgjatjen në milisekonda; ruhet në sekonda.
    duration: a.duration != null ? a.duration / 1000 : null,
    mimeType: a.mimeType ?? null,
    fileSize: a.fileSize ?? null,
  };
}

export default function NewPostScreen() {
  const { state } = useAppState();
  const [text, setText] = useState("");
  const [media, setMedia] = useState<LocalMedia[]>([]);
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

  const canPost = (text.trim().length > 0 || media.length > 0) && !posting;
  const slotsLeft = MAX_POST_MEDIA - media.length;

  /** Hedh videot shumë të gjata ose skedarët shumë të mëdhenj, me njoftim. */
  function addAssets(assets: ImagePicker.ImagePickerAsset[]) {
    const accepted: LocalMedia[] = [];
    const rejected: string[] = [];
    for (const a of assets.map(toLocalMedia)) {
      if (a.type === "video" && (a.duration ?? 0) > MAX_VIDEO_SECONDS + 0.5) {
        rejected.push(`Videoja duhet të jetë deri në ${MAX_VIDEO_SECONDS} sekonda.`);
      } else if (a.fileSize && a.fileSize > MAX_FILE_BYTES) {
        rejected.push("Skedari është më i madh se 50 MB.");
      } else {
        accepted.push(a);
      }
    }
    if (accepted.length) {
      haptics.tap();
      setMedia((prev) => [...prev, ...accepted].slice(0, MAX_POST_MEDIA));
    }
    if (rejected.length) Alert.alert("Disa skedarë nuk u shtuan", [...new Set(rejected)].join("\n"));
  }

  async function pickFromLibrary() {
    if (slotsLeft <= 0) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images", "videos"],
      allowsMultipleSelection: true,
      selectionLimit: slotsLeft,
      quality: 0.8,
      videoMaxDuration: MAX_VIDEO_SECONDS,
    });
    if (!result.canceled) addAssets(result.assets);
  }

  async function takeWithCamera() {
    if (slotsLeft <= 0) return;
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Kamera e bllokuar", "Lejo qasjen në kamerë te cilësimet e telefonit.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images", "videos"],
      quality: 0.8,
      videoMaxDuration: MAX_VIDEO_SECONDS,
    });
    if (!result.canceled) addAssets(result.assets);
  }

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
        media,
      });
      haptics.success();
      goBackOr("/(main)/community");
    } catch (e) {
      // Shfaq shkakun e vertete: gabimet e Supabase-it vijne si objekt me
      // fushen message, jo si Error.
      const detail = e instanceof Error ? e.message : typeof e === "object" && e && "message" in e ? String((e as { message: unknown }).message) : "";
      setError(detail ? `Postimi nuk u publikua: ${detail}` : "Postimi nuk u publikua. Provo përsëri.");
    } finally {
      setPosting(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      <View className="flex-row items-center justify-between px-5 pt-2 mb-4">
        <BackButton fallback="/(main)/community" variant="close" />
        <Text className="font-bodySemibold text-base text-ink">Postim i ri</Text>
        <Pressable
          onPress={handlePost}
          disabled={!canPost}
          accessibilityRole="button"
          className={`min-w-[72px] items-center px-4 py-2 rounded-full ${canPost ? "bg-olive" : "bg-cream-line"}`}
        >
          {posting ? (
            <ActivityIndicator className="text-on-accent" size="small" />
          ) : (
            <Text className={`font-bodySemibold text-xs ${canPost ? "text-on-accent" : "text-ink-faint"}`}>Posto</Text>
          )}
        </Pressable>
      </View>

      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={90}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
          <View className="px-5">
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="Çfarë do të ndash?"
              placeholderClassName="text-ink-faint"
              multiline
              autoFocus
              maxLength={MAX_TEXT}
              editable={!posting}
              className="font-body text-sm text-ink min-h-[120px]"
              textAlignVertical="top"
            />
            {text.length > MAX_TEXT * 0.8 ? (
              <Text className="self-end font-body text-[11px] text-ink-faint">{text.length}/{MAX_TEXT}</Text>
            ) : null}
          </View>

          {media.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 10 }} className="mt-3">
              {media.map((m, i) => (
                <View key={`${m.uri}-${i}`} className="h-28 w-28 overflow-hidden rounded-xl bg-black">
                  {m.type === "image" ? (
                    <Image source={{ uri: m.uri }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                  ) : (
                    <View className="flex-1 items-center justify-center">
                      <Icon name="play" size={22} color="#FEFEFE" />
                      {formatVideoDuration(m.duration) ? (
                        <Text className="mt-1 font-bodySemibold text-[10px] text-white">{formatVideoDuration(m.duration)}</Text>
                      ) : null}
                    </View>
                  )}
                  {!posting && (
                    <Pressable
                      onPress={() => setMedia((prev) => prev.filter((_, idx) => idx !== i))}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel="Hiq"
                      className="absolute right-1.5 top-1.5 h-6 w-6 items-center justify-center rounded-full bg-black/60"
                    >
                      <Icon name="close" size={12} color="#FEFEFE" />
                    </Pressable>
                  )}
                </View>
              ))}
            </ScrollView>
          )}

          <View className="mt-4 flex-row gap-2.5 px-5">
            <MediaButton icon="camera" label="Kamera" disabled={slotsLeft <= 0 || posting} onPress={takeWithCamera} />
            <MediaButton icon="plus" label="Nga galeria" disabled={slotsLeft <= 0 || posting} onPress={pickFromLibrary} />
          </View>
          <Text className="mt-2 px-5 font-body text-[11px] text-ink-faint">
            Deri në {MAX_POST_MEDIA} foto ose video · videot deri në {MAX_VIDEO_SECONDS} sekonda
          </Text>

          {posting && media.length > 0 ? (
            <Text className="mt-3 px-5 font-body text-xs text-ink-soft">Po ngarkohen skedarët, mos e mbyll ekranin...</Text>
          ) : null}

          {error && <Text className="font-body text-xs text-red-600 px-5 mt-3">{error}</Text>}

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
                      className={`rounded-full px-4 py-2 mr-2 ${active ? "bg-ink" : "bg-cream-soft"}`}
                    >
                      <Text className={`font-bodyMedium text-xs ${active ? "text-on-accent" : "text-ink-soft"}`}>{t.label}</Text>
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
                      className={`rounded-full px-4 py-2 mr-2 ${active ? "bg-ink" : "bg-cream-soft"}`}
                    >
                      <Text className={`font-bodyMedium text-xs ${active ? "text-on-accent" : "text-ink-soft"}`} numberOfLines={1}>{g.name}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </>
          )}

          <Text className="mt-8 px-5 font-body text-[11px] leading-4 text-ink-faint">
            Postimet janë publike për komunitetin. Mos ndaj të dhëna personale të bebit dhe respekto të tjerët — përmbajtja fyese hiqet.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function MediaButton({
  icon,
  label,
  onPress,
  disabled,
}: {
  icon: "camera" | "plus";
  label: string;
  onPress: () => void;
  disabled: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={shadows.soft}
      className={`flex-1 flex-row items-center justify-center gap-2 rounded-xl2 bg-surface py-3 ${disabled ? "opacity-40" : "active:opacity-70"}`}
    >
      <Icon name={icon} size={17} color="#6E7452" />
      <Text className="font-bodyMedium text-xs text-ink">{label}</Text>
    </Pressable>
  );
}
