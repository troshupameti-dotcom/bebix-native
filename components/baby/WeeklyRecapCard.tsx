import { useEffect, useMemo, useState } from "react";
import { View, Text, Pressable } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { MotiView } from "moti";
import { Icon } from "@/components/ui/Icon";
import { useTones } from "@/lib/theme/tone";
import { shadows } from "@/lib/shadows";
import { haptics } from "@/lib/haptics";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { durationLabel } from "@/lib/baby/dayStats";
import { buildWeeklyRecap, showRecapCard, type RecapHighlight } from "@/lib/baby/weeklyRecap";
import type { DiaperEntry, FeedingEntry, SleepEntry } from "@/lib/state/babyTypes";

const DISMISSED_KEY = "bebix_recap_dismissed_v1";

/**
 * Grafiku i vogël i gjumit: 7 shtylla (e hënë → e diel), një ngjyrë, maja të rrumbullakëta 4 px mbi vijën bazë,
 * dita me më shumë gjumë shkruhet te titulli (te shtylla s'ka vend). Lexuesi i ekranit merr të gjitha ditët me orët.
 */
function SleepBars({ minutes, color, track, soft }: { minutes: number[]; color: string; track: string; soft: string }) {
  const { t } = useTranslation();
  const max = Math.max(...minutes);
  if (max <= 0) return null;
  const short = t("recap_days").split(",");
  const long = t("recap_days_long").split(",");
  const best = minutes.indexOf(max);
  const H = 56;
  const label = minutes.map((m, i) => `${long[i]}: ${m > 0 ? durationLabel(m, t) : "–"}`).join(", ");
  return (
    <View className="mt-3" accessible accessibilityRole="image" accessibilityLabel={`${t("recap_chart_title")}. ${label}`}>
      <Text className="font-bodyMedium text-[12.5px]" style={{ color: soft }}>
        {t("recap_chart_title")} · {t("recap_chart_best", { d: durationLabel(max, t), day: long[best] })}
      </Text>
      <View className="mt-2 flex-row items-end" style={{ height: H, gap: 6 }}>
        {minutes.map((m, i) => (
          <View key={i} className="flex-1 items-center justify-end" style={{ height: H }}>
            <View
              style={{
                width: "70%",
                maxWidth: 22,
                height: m > 0 ? Math.max(3, Math.round((m / max) * H)) : 2,
                backgroundColor: m > 0 ? color : track,
                borderTopLeftRadius: 4,
                borderTopRightRadius: 4,
              }}
            />
          </View>
        ))}
      </View>
      <View className="flex-row" style={{ gap: 6, borderTopWidth: 1, borderTopColor: track, paddingTop: 3 }}>
        {short.map((d, i) => (
          <Text key={i} className="flex-1 text-center font-body text-[11px]" style={{ color: soft }}>
            {d}
          </Text>
        ))}
      </View>
    </View>
  );
}

/**
 * Përmbledhja e javës së kaluar, e hënë–e mërkurë, derisa prindi ta mbyllë.
 * Vetëm lajme të mira si trend; pjesa tjetër neutrale.
 */
export function WeeklyRecapCard({
  feedings,
  sleeps,
  diapers,
  babyName,
}: {
  feedings: FeedingEntry[];
  sleeps: SleepEntry[];
  diapers: DiaperEntry[];
  babyName: string | null;
}) {
  const tones = useTones();
  const { t } = useTranslation();
  // undefined = ende po lexohet (karta s'shfaqet derisa të dihet).
  const [dismissed, setDismissed] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    AsyncStorage.getItem(DISMISSED_KEY)
      .then((v) => setDismissed(v))
      .catch(() => setDismissed(null));
  }, []);

  const recap = useMemo(
    () => buildWeeklyRecap({ feedingLog: feedings, sleepLog: sleeps, diaperLog: diapers }),
    [feedings, sleeps, diapers]
  );
  if (dismissed === undefined || !recap || !showRecapCard(new Date(), dismissed, recap)) return null;

  const highlight = (h: RecapHighlight) =>
    h.kind === "night_sleep_up"
      ? t("recap_night_up", { d: durationLabel(h.deltaMin, t) })
      : h.kind === "total_sleep_up"
        ? t("recap_total_up", { d: durationLabel(h.deltaMin, t) })
        : t("recap_longest_up", { d: durationLabel(h.minutes, t) });

  function dismiss() {
    if (!recap) return;
    haptics.select();
    setDismissed(recap.weekKey);
    AsyncStorage.setItem(DISMISSED_KEY, recap.weekKey).catch(() => {});
  }

  const name = babyName?.trim();
  return (
    <MotiView
      from={{ opacity: 0, translateY: 8 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: "timing", duration: 260 }}
      style={[shadows.soft, { backgroundColor: tones.amber.tintBg }]}
      className="mt-5 rounded-xl3 p-4"
    >
      <View className="flex-row items-center gap-2">
        <Icon name="star" size={16} color={tones.amber.tint} />
        <Text className="flex-1 font-bodySemibold text-base" style={{ color: tones.amber.tint }}>
          {name ? t("recap_title_named", { name }) : t("recap_title")}
        </Text>
        <Pressable onPress={dismiss} hitSlop={12} accessibilityRole="button" accessibilityLabel={t("recap_dismiss")}>
          <Icon name="close" size={16} color={tones.amber.tint} />
        </Pressable>
      </View>

      {recap.highlights.map((h) => (
        <Text key={h.kind} className="mt-2 font-bodySemibold text-[15px]" style={{ color: tones.ink }}>
          {highlight(h)}
        </Text>
      ))}
      <Text className="mt-2 font-body text-[13px]" style={{ color: tones.inkSoft }}>
        {t("recap_avg", { f: recap.stats.feedingsPerDay, d: recap.stats.diapersPerDay })}
      </Text>
      {recap.stats.nightSleepMin !== null ? (
        <Text className="mt-0.5 font-body text-[13px]" style={{ color: tones.inkSoft }}>
          {t("recap_night_avg", { d: durationLabel(recap.stats.nightSleepMin, t) })}
        </Text>
      ) : null}
      <SleepBars minutes={recap.sleepByDay} color={tones.amber.tint} track={tones.amber.tint + "33"} soft={tones.inkSoft} />
      <Text className="mt-2.5 font-bodyMedium text-[12.5px]" style={{ color: tones.inkSoft }}>{t("recap_kind")}</Text>
    </MotiView>
  );
}
