import { useEffect, useMemo, useState } from "react";
import { View, Text } from "react-native";
import { Icon, type IconName } from "@/components/ui/Icon";
import { TONES, type Tone } from "@/components/baby/LogTiles";
import { shadows } from "@/lib/shadows";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { formatTime } from "@/lib/dateUtils";
import { buildPredictions, type PredictedWindow } from "@/lib/baby/predictions";
import type { DiaperEntry, FeedingEntry, SleepEntry } from "@/lib/state/babyTypes";
import type { TranslationKey } from "@/lib/i18n/translations";

/**
 * "Sot": çfarë vjen më pas (ushqimi, gjumi) nga ritmi i vetë bebit, plus
 * shumat e ditës. Pa të dhëna të mjaftueshme thotë miqësisht "edhe disa
 * ditë", jo hamendësime. Rifreskohet çdo minutë.
 */
export function TodayCard({
  feedings,
  sleeps,
  diapers,
  babyDob,
}: {
  feedings: FeedingEntry[];
  sleeps: SleepEntry[];
  diapers: DiaperEntry[];
  babyDob: string | null;
}) {
  const { t, lang } = useTranslation();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const p = useMemo(
    () => buildPredictions({ feedingLog: feedings, sleepLog: sleeps, diaperLog: diapers }, babyDob, now),
    [feedings, sleeps, diapers, babyDob, now]
  );

  const asleep = sleeps.some((s) => !s.endAt);
  const sleepWindow = asleep ? p.nextWake : p.nextSleep;

  return (
    <View style={shadows.soft} className="mt-5 rounded-xl3 bg-surface p-4">
      <View className="mb-3 flex-row items-center gap-2">
        <Icon name="sparkle" size={15} color={TONES.amber.tint} />
        <Text className="font-bodySemibold text-base text-ink">{t("pred_card_title")}</Text>
      </View>

      <PredictionRow
        icon="spoon"
        tone={TONES.pink}
        label={t("pred_next_feeding")}
        window={p.nextFeeding}
        dueKey="pred_feeding_due"
        emptyText={t("pred_need_data_feeding")}
        lang={lang}
      />
      <View className="my-2.5 h-px bg-ink/5" />
      <PredictionRow
        icon="moon"
        tone={TONES.purple}
        label={asleep ? t("pred_next_wake") : t("pred_next_sleep")}
        window={sleepWindow}
        dueKey={asleep ? "pred_wake_due" : "pred_sleep_due"}
        emptyText={t("pred_need_data_sleep")}
        lang={lang}
      />

      {/* Shumat e ditës janë te karta "Sot" (DaySummaryCard), në krye. */}
      <Text className="mt-3 font-body text-[11px] leading-4 text-ink-faint">{t("pred_disclaimer")}</Text>
    </View>
  );
}

function PredictionRow({
  icon,
  tone,
  label,
  window,
  dueKey,
  emptyText,
  lang,
}: {
  icon: IconName;
  tone: Tone;
  label: string;
  window: PredictedWindow | null;
  dueKey: TranslationKey;
  emptyText: string;
  lang: "sq" | "en";
}) {
  const { t } = useTranslation();
  const main = !window
    ? emptyText
    : window.due
      ? t(dueKey)
      : t("pred_around", { time: formatTime(window.at, lang), m: window.plusMinusMin });
  const meta = window
    ? [window.basis === "age" ? t("pred_by_age") : null, t(window.confidence === "high" ? "pred_conf_high" : "pred_conf_medium")]
        .filter(Boolean)
        .join(" · ")
    : null;

  return (
    <View className="flex-row items-center gap-3" accessible accessibilityLabel={`${label}: ${main}`}>
      <View className="h-9 w-9 items-center justify-center rounded-full" style={{ backgroundColor: tone.tintBg }}>
        <Icon name={icon} size={16} color={tone.tint} />
      </View>
      <View className="flex-1">
        <Text className="font-body text-xs text-ink-soft">{label}</Text>
        <Text className={`font-bodySemibold ${window ? "text-[15px] text-ink" : "text-[13px] text-ink-soft"}`}>{main}</Text>
      </View>
      {meta ? <Text className="font-body text-[11px] text-ink-faint">{meta}</Text> : null}
    </View>
  );
}
