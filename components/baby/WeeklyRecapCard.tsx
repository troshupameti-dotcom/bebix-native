import { useEffect, useMemo, useState } from "react";
import { View, Text, Pressable } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { MotiView } from "moti";
import { Icon } from "@/components/ui/Icon";
import { TONES } from "@/components/baby/LogTiles";
import { shadows } from "@/lib/shadows";
import { haptics } from "@/lib/haptics";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { durationLabel } from "@/lib/baby/dayStats";
import { buildWeeklyRecap, showRecapCard, type RecapHighlight } from "@/lib/baby/weeklyRecap";
import type { DiaperEntry, FeedingEntry, SleepEntry } from "@/lib/state/babyTypes";

const DISMISSED_KEY = "bebix_recap_dismissed_v1";

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
      style={[shadows.soft, { backgroundColor: TONES.amber.tintBg }]}
      className="mt-5 rounded-xl3 p-4"
    >
      <View className="flex-row items-center gap-2">
        <Icon name="star" size={16} color={TONES.amber.tint} />
        <Text className="flex-1 font-bodySemibold text-base" style={{ color: TONES.amber.tint }}>
          {name ? t("recap_title_named", { name }) : t("recap_title")}
        </Text>
        <Pressable onPress={dismiss} hitSlop={12} accessibilityRole="button" accessibilityLabel={t("recap_dismiss")}>
          <Icon name="close" size={16} color={TONES.amber.tint} />
        </Pressable>
      </View>

      {recap.highlights.map((h) => (
        <Text key={h.kind} className="mt-2 font-bodySemibold text-[15px] text-[#17212B]">
          {highlight(h)}
        </Text>
      ))}
      <Text className="mt-2 font-body text-[13px] text-[#3B4652]">
        {t("recap_avg", { f: recap.stats.feedingsPerDay, d: recap.stats.diapersPerDay })}
      </Text>
      {recap.stats.nightSleepMin !== null ? (
        <Text className="mt-0.5 font-body text-[13px] text-[#3B4652]">
          {t("recap_night_avg", { d: durationLabel(recap.stats.nightSleepMin, t) })}
        </Text>
      ) : null}
      <Text className="mt-2.5 font-bodyMedium text-[12.5px] text-[#3B4652]">{t("recap_kind")}</Text>
    </MotiView>
  );
}
