import { useMemo } from "react";
import { Alert, Image, Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { BackButton } from "@/components/ui/BackButton";
import { Icon } from "@/components/ui/Icon";
import { useTones } from "@/lib/theme/tone";
import { shadows } from "@/lib/shadows";
import { haptics } from "@/lib/haptics";
import { useAppState } from "@/lib/state/AppStateContext";
import { useActiveChild } from "@/lib/age/useActiveChild";
import { pregnancyProgress } from "@/lib/age/engine";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { pickMedia } from "@/lib/media/imagePicker";
import { useMomentUri } from "@/lib/baby/useMomentUri";
import { bumpPhotos, bumpTags } from "@/lib/baby/bump";
import type { Moment } from "@/lib/state/babyTypes";

const GAP = 8;

function Tile({ moment, week, size, onPress, onLongPress, label }: { moment: Moment; week: number; size: number; onPress: () => void; onLongPress: () => void; label: string }) {
  const uri = useMomentUri(moment);
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{ width: size, height: size * 1.25, borderRadius: 16, overflow: "hidden" }}
      className="bg-cream-soft"
    >
      {uri ? <Image source={{ uri }} style={{ width: "100%", height: "100%" }} resizeMode="cover" /> : null}
      <View style={{ position: "absolute", left: 6, bottom: 6, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, backgroundColor: "rgba(0,0,0,0.55)" }}>
        <Text className="font-bodySemibold text-[12px]" style={{ color: "#FFFFFF" }}>
          {week}
        </Text>
      </View>
    </Pressable>
  );
}

/**
 * Barku javë pas jave: një foto për javë (nga kamera ose galeria), rrjetë me javët, prek për ta ndarë si kartë,
 * mbaj shtypur për ta fshirë. Fotot janë momente me etiketën "bump".
 */
export default function BumpScreen() {
  const tones = useTones();
  const { t } = useTranslation();
  const { state, baby } = useAppState();
  const { child } = useActiveChild();
  const { width } = useWindowDimensions();
  const progress = pregnancyProgress(child.dueDate ?? null);
  const week = progress?.week ?? null;
  const photos = useMemo(() => bumpPhotos(state.baby.moments), [state.baby.moments]);
  const size = (Math.min(width, 560) - 40 - 2 * GAP) / 3;

  async function add(source: "camera" | "library") {
    if (week == null) return;
    haptics.tap();
    const result = await pickMedia(source, { mediaTypes: ["images"], quality: 0.8 }, t);
    const uri = result?.assets[0]?.uri;
    if (!uri) return;
    baby.addMoment({ type: "photo", uri, title: t("bump_week", { n: week }), tags: bumpTags(week) });
    haptics.success();
  }

  function remove(m: Moment) {
    Alert.alert(t("bump_delete_title"), undefined, [
      { text: t("cancel_action"), style: "cancel" },
      { text: t("delete_action"), style: "destructive", onPress: () => baby.deleteMoment(m.id) },
    ]);
  }

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      <View className="flex-row items-center gap-3 px-4 pb-3 pt-2">
        <BackButton fallback="/(main)/baby" />
        <Text accessibilityRole="header" className="font-display text-xl text-ink">
          {t("bump_title")}
        </Text>
      </View>

      <ScrollView className="flex-1 px-5" contentContainerStyle={{ paddingBottom: 32 }}>
        <Text className="font-body text-[14px] leading-5 text-ink-soft">{t("bump_intro")}</Text>

        {week != null ? (
          <View style={[shadows.soft, { backgroundColor: tones.pink.tintBg }]} className="mt-4 rounded-xl3 p-4">
            <Text className="font-bodySemibold text-[16px]" style={{ color: tones.ink }}>
              {t("bump_add", { n: week })}
            </Text>
            <View className="mt-3 flex-row gap-3">
              <Pressable onPress={() => void add("camera")} accessibilityRole="button" className="flex-1 flex-row items-center justify-center gap-2 rounded-2xl py-3" style={{ backgroundColor: tones.pink.tint }}>
                <Icon name="camera" size={17} color="#FFFFFF" />
                <Text className="font-bodySemibold text-[14.5px]" style={{ color: "#FFFFFF" }}>
                  {t("bump_camera")}
                </Text>
              </Pressable>
              <Pressable onPress={() => void add("library")} accessibilityRole="button" className="flex-1 flex-row items-center justify-center gap-2 rounded-2xl bg-surface py-3">
                <Icon name="grid" size={17} color={tones.ink} />
                <Text className="font-bodySemibold text-[14.5px] text-ink">{t("bump_library")}</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {photos.length === 0 ? (
          <Text className="mt-6 text-center font-body text-[14px] text-ink-soft">{t("bump_empty")}</Text>
        ) : (
          <>
            <Text className="mt-6 font-body text-[12.5px] text-ink-soft">{t("bump_open_hint")}</Text>
            <View className="mt-2 flex-row flex-wrap" style={{ gap: GAP }}>
              {photos.map(({ moment, week: w }) => (
                <Tile
                  key={moment.id}
                  moment={moment}
                  week={w}
                  size={size}
                  label={t("bump_week", { n: w })}
                  onPress={() => {
                    haptics.tap();
                    router.push({ pathname: "/(main)/baby/share-card", params: { kind: "pregnancy", n: String(w), momentId: moment.id } });
                  }}
                  onLongPress={() => remove(moment)}
                />
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
