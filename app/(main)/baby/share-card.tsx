import { useMemo, useRef, useState } from "react";
import { View, Text, Pressable, ScrollView, Image, ActivityIndicator, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";
import { captureRef } from "react-native-view-shot";
import * as Sharing from "expo-sharing";
import { BackButton } from "@/components/ui/BackButton";
import { Icon } from "@/components/ui/Icon";
import { ShareCard } from "@/components/share/ShareCard";
import { useAppState } from "@/lib/state/AppStateContext";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { useToast } from "@/lib/toast/ToastContext";
import { haptics } from "@/lib/haptics";
import { formatDate } from "@/lib/dateUtils";
import { useMomentUri } from "@/lib/baby/useMomentUri";
import {
  availableTemplates, buildCardContent, CARD_SIZE, defaultTemplate, parseCardParams, pickDefaultPhoto, selectablePhotos,
  type CardAspect, type CardTemplate,
} from "@/lib/share/cards";
import type { Moment } from "@/lib/state/babyTypes";

function Thumb({ moment, selected, onPress }: { moment: Moment; selected: boolean; onPress: () => void }) {
  const uri = useMomentUri(moment);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      className="mr-2 overflow-hidden rounded-xl bg-cream-soft"
      style={{ width: 60, height: 60, borderWidth: selected ? 3 : 0, borderColor: "#7A3596" }}
    >
      {uri ? <Image source={{ uri }} style={{ width: "100%", height: "100%" }} /> : null}
    </Pressable>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      className={`mr-2 items-center justify-center rounded-full px-4 ${active ? "bg-ink" : "bg-surface"}`}
      style={{ minHeight: 44 }}
    >
      <Text className={`font-bodySemibold text-[13px] ${active ? "text-cream" : "text-ink"}`}>{label}</Text>
    </Pressable>
  );
}

/**
 * Krijo kartë: dita e 100-të, muajt, ditëlindja, arritjet ose një moment,
 * me foton e bebit dhe logon e vogël Bebix → imazh për Instagram/WhatsApp.
 */
export default function ShareCardScreen() {
  const raw = useLocalSearchParams<{ kind?: string; n?: string; momentId?: string }>();
  const params = parseCardParams(raw) ?? { kind: "moment" as const, n: null, momentId: raw.momentId ?? null };
  const { state } = useAppState();
  const { t, lang } = useTranslation();
  const { showToast } = useToast();
  const { width: screenW, height: screenH } = useWindowDimensions();

  const moments = state.baby.moments;
  const photos = useMemo(() => selectablePhotos(moments), [moments]);
  const sourceMoment = params.momentId ? (moments.find((m) => m.id === params.momentId) ?? null) : null;
  const defaultPhoto = useMemo(() => pickDefaultPhoto(moments, params.momentId), [moments, params.momentId]);

  const [photoId, setPhotoId] = useState<string | "none" | null>(null);
  const selected = photoId === "none" ? null : photoId ? (photos.find((p) => p.id === photoId) ?? defaultPhoto) : defaultPhoto;
  const momentUri = useMomentUri(selected ?? { uri: null, storagePath: null });
  const photoUri = photoId === "none" ? null : selected ? momentUri : (state.profile.babyPhoto ?? null);

  const hasPhoto = !!photoUri;
  const [templatePick, setTemplatePick] = useState<CardTemplate | null>(null);
  const templates = availableTemplates(hasPhoto);
  const template = templatePick && templates.some((x) => x.key === templatePick) ? templatePick : defaultTemplate(hasPhoto);
  const [aspect, setAspect] = useState<CardAspect>("square");
  const [loadedUri, setLoadedUri] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const cardRef = useRef<View>(null);

  const babyName = state.profile.nickname || state.profile.babyName || t("your_baby");
  const dateIso = params.kind === "milestone" || params.kind === "moment" ? (sourceMoment?.date ?? new Date().toISOString()) : new Date().toISOString();
  const content = buildCardContent({ kind: params.kind, n: params.n, babyName, moment: sourceMoment, dateLabel: formatDate(dateIso, lang), t });

  // Parapamja: e gjerë sa ekrani; story-ja kufizohet nga lartësia.
  const previewW = aspect === "story" ? Math.min(screenW - 40, (screenH * 0.5) / (16 / 9)) : Math.min(screenW - 40, 420);
  const ready = !photoUri || loadedUri === photoUri;

  async function share() {
    if (!ready || sharing) return;
    haptics.success();
    setSharing(true);
    try {
      const size = CARD_SIZE[aspect];
      const uri = await captureRef(cardRef, { format: "jpg", quality: 0.95, result: "tmpfile", width: size.width, height: size.height });
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: "image/jpeg", dialogTitle: "Bebix" });
    } catch {
      showToast(t("month_recap_share_error"));
    } finally {
      setSharing(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      <View className="flex-row items-center gap-3 px-4 pb-3 pt-2">
        <BackButton fallback="/(main)/baby" />
        <Text className="font-display text-xl text-ink">{t("card_screen_title")}</Text>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 24 }}>
        <View className="items-center px-5">
          <View style={{ borderRadius: 18, overflow: "hidden", shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 12, elevation: 4 }}>
            <ShareCard
              ref={cardRef}
              template={template}
              aspect={aspect}
              content={content}
              photoUri={photoUri}
              width={previewW}
              onPhotoLoad={() => setLoadedUri(photoUri)}
            />
          </View>
        </View>

        <Text className="mb-2 mt-5 px-5 font-bodySemibold text-[13px] text-ink">{t("card_template")}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20 }}>
          {templates.map((tpl) => (
            <Chip key={tpl.key} label={t(tpl.labelKey)} active={template === tpl.key} onPress={() => { haptics.select(); setTemplatePick(tpl.key); }} />
          ))}
        </ScrollView>

        <Text className="mb-2 mt-4 px-5 font-bodySemibold text-[13px] text-ink">{t("card_format")}</Text>
        <View className="flex-row px-5">
          <Chip label={t("card_format_post")} active={aspect === "square"} onPress={() => { haptics.select(); setAspect("square"); }} />
          <Chip label={t("card_format_story")} active={aspect === "story"} onPress={() => { haptics.select(); setAspect("story"); }} />
        </View>

        {photos.length > 0 ? (
          <>
            <Text className="mb-2 mt-4 px-5 font-bodySemibold text-[13px] text-ink">{t("card_photo")}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20 }}>
              <Pressable
                onPress={() => { haptics.select(); setPhotoId("none"); }}
                accessibilityRole="button"
                accessibilityLabel={t("card_no_photo")}
                className="mr-2 items-center justify-center rounded-xl bg-surface"
                style={{ width: 60, height: 60, borderWidth: photoId === "none" ? 3 : 0, borderColor: "#7A3596" }}
              >
                <Icon name="close" size={18} color="#8A929A" />
              </Pressable>
              {photos.map((p) => (
                <Thumb key={p.id} moment={p} selected={photoId !== "none" && selected?.id === p.id} onPress={() => { haptics.select(); setPhotoId(p.id); }} />
              ))}
            </ScrollView>
          </>
        ) : null}
      </ScrollView>

      <View className="px-5 pb-6 pt-2">
        <Pressable
          onPress={() => void share()}
          disabled={!ready || sharing}
          accessibilityRole="button"
          className="flex-row items-center justify-center gap-2 rounded-2xl bg-ink"
          style={{ minHeight: 56, opacity: ready ? 1 : 0.6 }}
        >
          {sharing || !ready ? <ActivityIndicator color="#FBF6EE" /> : <Icon name="share" size={17} color="#FBF6EE" />}
          <Text className="font-bodySemibold text-[15px] text-cream">{t("card_share")}</Text>
        </Pressable>
        <Text className="mt-2 text-center font-body text-[11px] text-ink-faint">{t("card_share_hint")}</Text>
      </View>
    </SafeAreaView>
  );
}
