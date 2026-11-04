import { useEffect, useMemo, useState } from "react";
import { View, Text, Pressable } from "react-native";
import { LogRow } from "@/components/baby/LogTiles";
import { shadows } from "@/lib/shadows";
import { haptics } from "@/lib/haptics";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { useToneTheme } from "@/lib/theme/tone";
import { useThemeColors } from "@/lib/theme/useThemeColors";
import { NIGHT_FROM, NIGHT_TO } from "@/lib/baby/dayStats";
import {
  averageIntervalMin, dayLabel, entriesOfDay, feedsVsYesterday, gapsById, groupByDay, startOfDay, totals, type FeedDay,
} from "@/lib/baby/feedingDays";
import { formatTime } from "@/lib/dateUtils";
import type { FeedingEntry } from "@/lib/state/types";
import { TYPE_ICON, TYPE_TONE, compactDuration, entryHeadline } from "./feedingStyle";

const DAY_MS = 86_400_000;
const STRIP_H = 44;

/** Karta "Dita e sotme": vija 24-orëshe me çdo ushqyerje në vendin e vet, dhe totalet e ditës. */
export function TodayCard({ log, onOpen }: { log: FeedingEntry[]; onOpen: (e: FeedingEntry) => void }) {
  const { t } = useTranslation();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);
  const today = useMemo(() => entriesOfDay(log, now), [log, now]);
  const delta = useMemo(() => feedsVsYesterday(log, now), [log, now]);
  const sum = totals(today);
  const interval = averageIntervalMin(today);

  const stats = [
    { value: String(sum.feeds), label: t("feeding_stat_feeds") },
    sum.ml > 0 ? { value: `${sum.ml} ml`, label: t("feeding_stat_ml") } : null,
    sum.breastMin > 0 ? { value: `${sum.breastMin} min`, label: t("feeding_stat_breast") } : null,
    interval != null ? { value: compactDuration(interval), label: t("feeding_stats_avg_interval") } : null,
  ].filter((s): s is { value: string; label: string } => s !== null);

  return (
    <View style={shadows.press} className="mt-4 rounded-xl3 border border-ink/10 bg-surface p-4">
      <View className="flex-row items-baseline justify-between">
        <Text className="font-bodySemibold text-[15px] text-ink">{t("feeding_today_title")}</Text>
        {delta != null && delta !== 0 && (
          <Text className="font-body text-[12px] text-ink-soft">
            {t("sum_vs_yesterday", { v: `${delta > 0 ? "+" : "−"}${Math.abs(delta)}` })}
          </Text>
        )}
      </View>

      <DayStrip entries={today} now={now} onOpen={onOpen} />

      <View className="mt-4 flex-row">
        {stats.map((s, i) => (
          <View key={s.label} className={`flex-1 ${i > 0 ? "border-l border-ink/10 pl-3" : ""}`}>
            <Text className="font-display text-[19px] leading-[24px] text-ink" numberOfLines={1} adjustsFontSizeToFit>
              {s.value}
            </Text>
            <Text className="mt-0.5 font-body text-[11px] text-ink-soft" numberOfLines={1}>
              {s.label}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/**
 * Vija e ditës (00–24): nata e hijezuar, gjiri si shirit sa zgjati, biberoni si pikë sa sasia, ushqimi si katror.
 * Prekja e një shenje hap shënimin.
 */
function DayStrip({ entries, now, onOpen }: { entries: FeedingEntry[]; now: Date; onOpen: (e: FeedingEntry) => void }) {
  const { t, lang } = useTranslation();
  const themed = useToneTheme();
  const colors = useThemeColors();
  const [w, setW] = useState(0);
  const dayStart = startOfDay(now).getTime();
  const x = (ms: number) => Math.min(1, Math.max(0, (ms - dayStart) / DAY_MS)) * w;
  const night = colors.isDark ? "rgba(255,255,255,0.05)" : "rgba(28,26,22,0.055)";

  return (
    <View className="mt-3">
      <View
        onLayout={(e) => setW(e.nativeEvent.layout.width)}
        style={{ height: STRIP_H, borderRadius: 14, backgroundColor: colors.surfaceAlt, overflow: "hidden" }}
      >
        <View style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${(NIGHT_TO / 24) * 100}%`, backgroundColor: night }} />
        <View style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: `${((24 - NIGHT_FROM) / 24) * 100}%`, backgroundColor: night }} />
        {[6, 12, 18].map((h) => (
          <View key={h} style={{ position: "absolute", left: `${(h / 24) * 100}%`, top: 10, bottom: 10, width: 1, backgroundColor: colors.creamLine }} />
        ))}

        {w > 0 &&
          entries.map((e) => {
            const tone = themed(TYPE_TONE[e.type]);
            const left = x(new Date(e.at).getTime());
            let width: number;
            let height: number;
            let radius: number;
            if (e.type === "breast") {
              width = Math.max(10, (((e.durationMin ?? 10) * 60_000) / DAY_MS) * w);
              height = 16;
              radius = 8;
            } else if (e.type === "bottle" || e.type === "formula") {
              width = height = 10 + Math.min(8, Math.round((e.amountMl ?? 60) / 30));
              radius = width / 2;
            } else if (e.type === "solid") {
              width = height = 13;
              radius = 4;
            } else {
              width = height = 8;
              radius = 4;
            }
            const start = e.type === "breast" ? left : left - width / 2;
            return (
              <Pressable
                key={e.id}
                onPress={() => {
                  haptics.select();
                  onOpen(e);
                }}
                hitSlop={{ top: 14, bottom: 14, left: 6, right: 6 }}
                accessibilityRole="button"
                accessibilityLabel={`${entryHeadline(e, t)}, ${formatTime(e.at, lang)}`}
                style={{
                  position: "absolute",
                  left: Math.min(Math.max(2, start), w - width - 2),
                  top: (STRIP_H - height) / 2,
                  width,
                  height,
                  borderRadius: radius,
                  backgroundColor: tone.tint,
                  borderWidth: 1.5,
                  borderColor: colors.surfaceAlt,
                }}
              />
            );
          })}

        {w > 0 && (
          <View
            pointerEvents="none"
            style={{ position: "absolute", left: x(now.getTime()) - 1, top: 5, bottom: 5, width: 2, borderRadius: 1, backgroundColor: colors.ink }}
          />
        )}
      </View>
      <View className="mt-1.5 flex-row justify-between px-0.5">
        {["00", "06", "12", "18", "24"].map((l) => (
          <Text key={l} className="font-body text-[10.5px] text-ink-faint">
            {l}
          </Text>
        ))}
      </View>
    </View>
  );
}

/** Historiku sipas ditëve: "Sot", "Dje", "E hënë, 2 nëntor", me totalet e çdo dite; 5 ditë, pastaj "Shfaq". */
export function FeedHistory({
  log,
  onOpen,
  onDelete,
}: {
  log: FeedingEntry[];
  onOpen: (e: FeedingEntry) => void;
  onDelete: (e: FeedingEntry) => void;
}) {
  const { t, lang } = useTranslation();
  const days = useMemo(() => groupByDay(log), [log]);
  const gaps = useMemo(() => gapsById(log), [log]);
  const [shown, setShown] = useState(5);
  const now = new Date();
  const words = { today: t("diary_today"), yesterday: t("diary_yesterday") };

  function summary(day: FeedDay): string {
    const { feeds, ml, breastMin } = day.totals;
    return [
      feeds === 1 ? t("feeding_day_count_one") : t("feeding_day_count", { n: feeds }),
      ml > 0 ? `${ml} ml` : null,
      breastMin > 0 ? t("feeding_day_breast", { n: breastMin }) : null,
    ]
      .filter(Boolean)
      .join(" · ");
  }

  return (
    <View className="mt-6">
      <Text className="font-bodyMedium text-xs uppercase text-ink-faint">{t("feeding_history_title")}</Text>
      {days.slice(0, shown).map((day) => (
        <View key={day.start.toISOString()} className="mt-4">
          <View className="mb-2.5 flex-row items-baseline justify-between">
            <Text className="font-bodySemibold text-[15px] text-ink">{dayLabel(day.start, now, lang, words)}</Text>
            <Text className="ml-3 shrink font-body text-[12px] text-ink-soft" numberOfLines={1}>
              {summary(day)}
            </Text>
          </View>
          {day.entries.map((entry) => {
            const gap = gaps.get(entry.id);
            return (
              <LogRow
                key={entry.id}
                onPress={() => onOpen(entry)}
                onDelete={() => onDelete(entry)}
                deleteLabel={t("delete_action")}
                icon={TYPE_ICON[entry.type]}
                tone={TYPE_TONE[entry.type]}
                title={entryHeadline(entry, t)}
                detail={[
                  entry.type === "breast" && entry.durationMin ? `${entry.durationMin} min` : null,
                  entry.foodCategory,
                  entry.note.trim() || null,
                  gap ? t("feeding_gap", { d: compactDuration(gap) }) : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
                trailing={formatTime(entry.at, lang)}
              />
            );
          })}
        </View>
      ))}
      {days.length > shown && (
        <Pressable
          onPress={() => {
            haptics.tap();
            setShown((n) => n + 7);
          }}
          accessibilityRole="button"
          className="mt-2 items-center rounded-2xl border border-ink/10 bg-surface py-3.5 active:opacity-80"
        >
          <Text className="font-bodyMedium text-[14px] text-ink">{t("feeding_show_more")}</Text>
        </Pressable>
      )}
    </View>
  );
}
