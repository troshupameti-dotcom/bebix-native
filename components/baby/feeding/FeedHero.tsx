import { useEffect, useMemo, useState } from "react";
import { View, Text } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { MotiView } from "moti";
import { Icon } from "@/components/ui/Icon";
import { shadows } from "@/lib/shadows";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { TONES, useTone } from "@/lib/theme/tone";
import { durationLabel, sinceLabel } from "@/lib/baby/dayStats";
import { predictNextFeeding } from "@/lib/baby/predictions";
import { entriesOfDay, isFeed, totals, usualIntervalMin } from "@/lib/baby/feedingDays";
import { formatTime } from "@/lib/dateUtils";
import type { FeedingEntry } from "@/lib/state/types";
import { TYPE_ICON, TYPE_TONE, entryHeadline } from "./feedingStyle";

const SIZE = 84;
const STROKE = 7;
const R = (SIZE - STROKE) / 2;
const CIRC = 2 * Math.PI * R;

/**
 * Karta lart: "sa kohë ka kaluar?" me numrin e madh, dhe unaza që mbushet deri te ushqyerja e radhës (parashikimi
 * nga ritmi i bebit; kur s'ka ende mjaft të dhëna, intervali i zakonshëm i 3 ditëve të fundit). Kur unaza mbushet,
 * pika pulson: "mund të ketë uri".
 */
export function FeedHero({ log }: { log: FeedingEntry[] }) {
  const { t, lang } = useTranslation();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  const last = log.find(isFeed) ?? null;
  const tone = useTone(last ? TYPE_TONE[last.type] : TONES.pink);
  const next = useMemo(() => predictNextFeeding(log, now), [log, now]);
  const usual = useMemo(() => usualIntervalMin(log, now), [log, now]);
  const todayFeeds = useMemo(() => totals(entriesOfDay(log, now)).feeds, [log, now]);

  const since = sinceLabel(last?.at ?? null, t, now);
  const start = last ? new Date(last.at).getTime() : null;
  const end = next ? new Date(next.at).getTime() : start != null && usual ? start + usual * 60_000 : null;
  const progress = start != null && end != null && end > start ? Math.min(1, Math.max(0, (now.getTime() - start) / (end - start))) : 0;
  const due = next ? next.due : end != null && progress >= 1;

  const hint = next
    ? due
      ? t("pred_feeding_due")
      : t("feeding_next_at", { time: formatTime(next.at, lang) })
    : usual
      ? t("feeding_usual_every", { d: durationLabel(usual, t) })
      : null;

  return (
    <View style={[shadows.soft, { backgroundColor: tone.tintBg }]} className="mb-4 rounded-xl3 p-5">
      <View className="flex-row items-center">
        <View className="flex-1 pr-3">
          <Text className="font-bodySemibold text-[13px]" style={{ color: tone.tint }}>
            {t("feeding_last_title")}
          </Text>
          {last && since ? (
            <>
              <Text className="mt-1.5 font-display text-[34px] leading-[40px]" style={{ color: tone.ink }} accessibilityLiveRegion="polite">
                {since}
              </Text>
              <Text className="mt-1 font-body text-[13px]" style={{ color: tone.inkSoft }} numberOfLines={2}>
                {entryHeadline(last, t)} · {t("feeding_last_at", { time: formatTime(last.at, lang) })}
              </Text>
            </>
          ) : (
            <Text className="mt-2 font-body text-[15px] leading-[21px]" style={{ color: tone.inkSoft }}>
              {t("feeding_hero_empty")}
            </Text>
          )}
        </View>

        <View style={{ width: SIZE, height: SIZE }} className="items-center justify-center">
          {due && (
            <MotiView
              from={{ opacity: 0.45, scale: 1 }}
              animate={{ opacity: 0, scale: 1.22 }}
              transition={{ type: "timing", duration: 1600, loop: true, repeatReverse: false }}
              style={{ position: "absolute", width: SIZE, height: SIZE, borderRadius: SIZE / 2, backgroundColor: tone.tint }}
            />
          )}
          <Svg width={SIZE} height={SIZE} style={{ position: "absolute" }}>
            <Circle cx={SIZE / 2} cy={SIZE / 2} r={R} stroke={tone.chip} strokeWidth={STROKE} fill="none" />
            {progress > 0 && (
              <Circle
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={R}
                stroke={tone.tint}
                strokeWidth={STROKE}
                strokeLinecap="round"
                fill="none"
                strokeDasharray={`${CIRC} ${CIRC}`}
                strokeDashoffset={CIRC * (1 - progress)}
                transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
              />
            )}
          </Svg>
          <Icon name={last ? TYPE_ICON[last.type] : "droplet"} size={24} color={tone.tint} />
        </View>
      </View>

      {(hint || todayFeeds > 0) && (
        <View className="mt-4 flex-row flex-wrap items-center" style={{ gap: 8 }}>
          {hint && (
            <View className="flex-row items-center rounded-full px-3 py-1.5" style={{ backgroundColor: tone.chip, gap: 6 }}>
              <View className="h-2 w-2 rounded-full" style={{ backgroundColor: tone.tint }} />
              <Text className="font-bodySemibold text-[12.5px]" style={{ color: tone.tint }}>
                {hint}
              </Text>
            </View>
          )}
          {todayFeeds > 0 && (
            <Text className="font-body text-[12.5px]" style={{ color: tone.inkSoft }}>
              {t("today_count", { n: todayFeeds })}
            </Text>
          )}
        </View>
      )}
    </View>
  );
}
