import { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, Pressable, Image, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { MotiView } from "moti";
import { captureRef } from "react-native-view-shot";
import * as Sharing from "expo-sharing";
import { Icon } from "@/components/ui/Icon";
import { useAppState } from "@/lib/state/AppStateContext";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { useToast } from "@/lib/toast/ToastContext";
import { haptics } from "@/lib/haptics";
import { durationLabel } from "@/lib/baby/dayStats";
import { buildMonthRecap, type MonthRecap } from "@/lib/baby/memories";
import { useMomentUri } from "@/lib/baby/useMomentUri";
import type { Moment } from "@/lib/state/babyTypes";

const SLIDE_MS = 5000;
const MAX_PHOTOS = 10;

type Slide =
  | { kind: "cover" }
  | { kind: "stats" }
  | { kind: "milestones" }
  | { kind: "photo"; moment: Moment }
  | { kind: "end" };

// Sfondet e diapozitivëve: e njëjta familje ngjyrash si kartat e app-it.
const BG: Record<Slide["kind"], string> = { cover: "#7A3596", stats: "#2E6FA8", milestones: "#B8336A", photo: "#17212B", end: "#9A6415" };

function PhotoSlide({ moment }: { moment: Moment }) {
  const uri = useMomentUri(moment);
  return (
    <View className="flex-1">
      {uri ? <Image source={{ uri }} style={{ flex: 1 }} resizeMode="cover" /> : <ActivityIndicator color="#fff" style={{ flex: 1 }} />}
      {moment.title.trim() ? (
        <View className="absolute bottom-16 left-0 right-0 px-6">
          <Text className="font-display text-[24px] text-white" style={{ textShadowColor: "rgba(0,0,0,0.5)", textShadowRadius: 8 }}>
            {moment.title.trim()}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function Big({ value, label }: { value: string; label: string }) {
  return (
    <View className="mb-6">
      <Text className="font-display text-[44px] leading-[50px] text-white">{value}</Text>
      <Text className="font-bodyMedium text-[15px] text-white/80">{label}</Text>
    </View>
  );
}

/**
 * Filmi i muajit: diapozitivë si "stories" — kopertina, numrat, arritjet,
 * fotot dhe fundi. Prek djathtas/majtas për të lëvizur; secili ndahet si foto.
 */
export default function MonthRecapScreen() {
  const { month } = useLocalSearchParams<{ month?: string }>();
  const { state } = useAppState();
  const { t, lang } = useTranslation();
  const { showToast } = useToast();
  const recap: MonthRecap | null = useMemo(() => buildMonthRecap(state.baby, month ?? ""), [state.baby, month]);
  const babyName = state.profile.nickname || state.profile.babyName || t("your_baby");

  const slides: Slide[] = useMemo(() => {
    if (!recap) return [];
    return [
      { kind: "cover" },
      { kind: "stats" },
      ...(recap.milestones.length ? [{ kind: "milestones" } as Slide] : []),
      ...recap.photos.slice(0, MAX_PHOTOS).map((m) => ({ kind: "photo", moment: m }) as Slide),
      { kind: "end" },
    ];
  }, [recap]);

  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [sharing, setSharing] = useState(false);
  const slideRef = useRef<View>(null);

  useEffect(() => {
    if (paused || slides.length === 0) return;
    const id = setTimeout(() => setIndex((i) => (i < slides.length - 1 ? i + 1 : i)), SLIDE_MS);
    return () => clearTimeout(id);
  }, [index, paused, slides.length]);

  if (!recap) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-cream">
        <Text className="font-body text-ink-soft">{t("month_recap_empty")}</Text>
      </SafeAreaView>
    );
  }

  const monthLabel = new Date(recap.start).toLocaleDateString(lang === "en" ? "en-GB" : "sq-AL", { month: "long", year: "numeric" });
  const slide = slides[Math.min(index, slides.length - 1)];
  const go = (d: number) => {
    haptics.select();
    setIndex((i) => Math.max(0, Math.min(slides.length - 1, i + d)));
  };

  async function share() {
    if (sharing) return;
    setSharing(true);
    setPaused(true);
    try {
      const uri = await captureRef(slideRef, { format: "jpg", quality: 0.92, result: "tmpfile" });
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: "image/jpeg", dialogTitle: "Bebix" });
    } catch {
      showToast(t("month_recap_share_error"));
    } finally {
      setSharing(false);
      setPaused(false);
    }
  }

  return (
    <View className="flex-1" style={{ backgroundColor: BG[slide.kind] }}>
      {/* Pjesa që ndahet si foto: diapozitivi me logon e vogël Bebix. */}
      <View ref={slideRef} collapsable={false} className="flex-1" style={{ backgroundColor: BG[slide.kind] }}>
        <MotiView key={index} from={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ type: "timing", duration: 350 }} className="flex-1">
          {slide.kind === "photo" ? (
            <PhotoSlide moment={slide.moment} />
          ) : (
            <View className="flex-1 justify-center px-8">
              {slide.kind === "cover" ? (
                <>
                  <Text className="font-bodyMedium text-[15px] uppercase text-white/80">{monthLabel}</Text>
                  <Text className="mt-2 font-display text-[40px] leading-[46px] text-white">{t("month_recap_cover", { name: babyName })}</Text>
                </>
              ) : slide.kind === "stats" ? (
                <>
                  <Big value={String(recap.feedings)} label={t("month_recap_feedings")} />
                  <Big value={String(recap.diapers)} label={t("month_recap_diapers")} />
                  {recap.sleepPerDayMin ? <Big value={durationLabel(recap.sleepPerDayMin, t)} label={t("month_recap_sleep")} /> : null}
                  {recap.weightGainKg && recap.weightGainKg > 0 ? (
                    <Big value={`+${recap.weightGainKg} kg`} label={t("month_recap_weight")} />
                  ) : null}
                </>
              ) : slide.kind === "milestones" ? (
                <>
                  <Text className="mb-5 font-display text-[30px] text-white">{t("month_recap_milestones")} ⭐</Text>
                  {recap.milestones.slice(0, 6).map((m) => (
                    <Text key={m.id} className="mb-3 font-bodySemibold text-[19px] text-white">
                      • {m.title}
                    </Text>
                  ))}
                </>
              ) : (
                <>
                  <Text className="font-display text-[34px] leading-[40px] text-white">{t("month_recap_end")}</Text>
                  <Text className="mt-3 font-body text-[16px] text-white/85">{t("month_recap_end_sub")}</Text>
                </>
              )}
            </View>
          )}
        </MotiView>
        <Text className="absolute bottom-5 left-0 right-0 text-center font-bodySemibold text-[12px] text-white/70">Bebix</Text>
      </View>

      {/* Prekja: majtas = mbrapa, djathtas = përpara; mbajtja e ndal. */}
      <View className="absolute bottom-0 left-0 right-0 top-0 flex-row">
        <Pressable className="flex-1" onPress={() => go(-1)} onLongPress={() => setPaused(true)} onPressOut={() => setPaused(false)} accessibilityLabel={t("month_recap_prev")} />
        <Pressable className="flex-[2]" onPress={() => go(1)} onLongPress={() => setPaused(true)} onPressOut={() => setPaused(false)} accessibilityLabel={t("month_recap_next")} />
      </View>

      <SafeAreaView edges={["top"]} className="absolute left-0 right-0 top-0 px-3">
        <View className="mt-2 flex-row" style={{ gap: 4 }}>
          {slides.map((_, i) => (
            <View key={i} className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/30">
              {i < index ? <View className="h-full w-full bg-white" /> : null}
              {i === index ? (
                <MotiView
                  key={`${index}-${paused}`}
                  from={{ width: "0%" }}
                  animate={{ width: paused ? "0%" : "100%" }}
                  transition={{ type: "timing", duration: paused ? 0 : SLIDE_MS }}
                  className="h-full bg-white"
                />
              ) : null}
            </View>
          ))}
        </View>
        <View className="mt-3 flex-row items-center justify-end" style={{ gap: 8 }}>
          <Pressable onPress={share} disabled={sharing} accessibilityRole="button" accessibilityLabel={t("month_recap_share")} className="h-11 flex-row items-center gap-2 rounded-full bg-black/25 px-4">
            {sharing ? <ActivityIndicator color="#fff" size="small" /> : <Icon name="share" size={16} color="#fff" />}
            <Text className="font-bodySemibold text-[13px] text-white">{t("month_recap_share")}</Text>
          </Pressable>
          <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace("/(main)/baby"))} accessibilityRole="button" accessibilityLabel={t("close_action")} className="h-11 w-11 items-center justify-center rounded-full bg-black/25">
            <Icon name="close" size={18} color="#fff" />
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}
