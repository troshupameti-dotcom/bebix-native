import { View, Text, Pressable } from "react-native";
import { Icon } from "@/components/ui/Icon";
import { useThemeColors } from "@/lib/theme/useThemeColors";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { clockPalette } from "@/lib/baby/clockPalette";
import { durationLabel } from "@/lib/baby/dayStats";
import { dayKeyOf, startOfDay, weekDays, SPECIAL_KINDS, type DiaryDay } from "@/lib/baby/diary";
import { formatTime } from "@/lib/dateUtils";
import { haptics } from "@/lib/haptics";
import type { BabyGender } from "@/lib/state/types";

type Props = {
  anchor: Date;
  today: Date;
  daysByKey: Map<string, DiaryDay>;
  gender: BabyGender;
  onChangeWeek: (delta: -1 | 1) => void;
  onPickDay: (day: Date) => void;
};

/** Mbi këtë lartësi (orë) shtylla e gjumit nuk rritet më. */
const CHART_HOURS = 16;
const CHART_HEIGHT = 120;

/**
 * Raporti i javës: mesataret, gjumi ditë pas dite, ushqyerjet dhe pelenat,
 * dhe ngjarjet që s'përsëriten. Mesataret llogariten vetëm mbi ditët me
 * shënime, që një ditë e harruar të mos e ulë mesataren e gjumit në gjysmë.
 */
export function DiaryWeek({ anchor, today, daysByKey, gender, onChangeWeek, onPickDay }: Props) {
  const theme = useThemeColors();
  const { t, lang } = useTranslation();
  const colors = clockPalette(gender, theme);

  const monthsOf = t("diary_months_of").split(",");
  const weekdaysShort = t("diary_weekdays_short").split(",");
  const weekdaysLong = t("diary_weekdays_long").split(",");
  const days = weekDays(anchor);
  const todayStart = startOfDay(today).getTime();
  const containsToday = days.some((d) => d.getTime() === todayStart);

  const rows = days.map((date, i) => {
    const day = daysByKey.get(dayKeyOf(date.getTime()));
    return {
      date,
      short: weekdaysShort[i],
      long: `${weekdaysLong[i]} ${date.getDate()}`,
      day,
      future: date.getTime() > todayStart,
      isToday: date.getTime() === todayStart,
    };
  });
  const logged = rows.filter((r) => r.day);
  const n = logged.length;

  const fmt = (x: number) => {
    const s = (Math.round(x * 10) / 10).toString();
    return lang === "sq" ? s.replace(".", ",") : s;
  };
  const avgSleep = n ? Math.round(logged.reduce((s, r) => s + (r.day?.sleepMinutes ?? 0), 0) / n) : 0;
  const avgFeeds = n ? logged.reduce((s, r) => s + (r.day?.feedings ?? 0), 0) / n : 0;
  const avgDiapers = n ? logged.reduce((s, r) => s + (r.day?.diapers ?? 0), 0) / n : 0;

  const events = logged.flatMap((r) =>
    (r.day?.entries ?? [])
      .filter((e) => SPECIAL_KINDS.has(e.kind))
      .map((e) => ({ ...e, dayLabel: r.long }))
  );

  const first = days[0];
  const last = days[6];
  const range =
    first.getMonth() === last.getMonth()
      ? t("diary_week_range", { from: String(first.getDate()), to: `${last.getDate()} ${monthsOf[last.getMonth()]}` })
      : t("diary_week_range", {
          from: `${first.getDate()} ${monthsOf[first.getMonth()]}`,
          to: `${last.getDate()} ${monthsOf[last.getMonth()]}`,
        });

  return (
    <View className="gap-3">
      <View className="flex-row items-center justify-between">
        <Pressable
          onPress={() => {
            haptics.select();
            onChangeWeek(-1);
          }}
          accessibilityRole="button"
          accessibilityLabel={t("diary_prev_week")}
          className="h-11 w-11 items-center justify-center rounded-full border border-cream-line bg-surface"
        >
          <Icon name="chevronLeft" size={18} color={theme.ink} />
        </Pressable>
        <View className="items-center">
          <Text className="font-display text-lg text-ink">{range}</Text>
          <Text className="mt-0.5 font-body text-[12px] text-ink-soft">{t("diary_week_logged", { n })}</Text>
        </View>
        <Pressable
          onPress={() => {
            haptics.select();
            onChangeWeek(1);
          }}
          disabled={containsToday}
          accessibilityRole="button"
          accessibilityLabel={t("diary_next_week")}
          accessibilityState={{ disabled: containsToday }}
          className="h-11 w-11 items-center justify-center rounded-full border border-cream-line bg-surface"
          style={{ opacity: containsToday ? 0.3 : 1 }}
        >
          <Icon name="chevronRight" size={18} color={theme.ink} />
        </Pressable>
      </View>

      {n === 0 ? (
        <View className="items-center rounded-xl2 border border-dashed border-cream-line py-10">
          <Text className="font-body text-sm text-ink-soft">{t("diary_week_empty")}</Text>
        </View>
      ) : (
        <>
          <View className="flex-row gap-2">
            <AvgTile color={colors.sleep} label={t("diary_week_avg_sleep")} value={durationLabel(avgSleep, t)} />
            <AvgTile color={colors.feeding} label={t("diary_week_avg_feeds")} value={fmt(avgFeeds)} />
            <AvgTile color={colors.diaper} label={t("diary_week_avg_diapers")} value={fmt(avgDiapers)} />
          </View>

          <View className="rounded-xl2 border border-cream-line bg-surface p-4">
            <Text className="mb-3 font-bodySemibold text-[15px] text-ink">{t("diary_week_sleep_chart")}</Text>
            <View className="flex-row items-end gap-2" style={{ height: CHART_HEIGHT + 56 }}>
              {rows.map((r) => {
                const minutes = r.day?.sleepMinutes ?? 0;
                const h = Math.max(6, Math.round((Math.min(minutes / 60, CHART_HOURS) / CHART_HOURS) * CHART_HEIGHT));
                return (
                  <Pressable
                    key={r.short}
                    onPress={() => r.day && onPickDay(r.date)}
                    disabled={!r.day}
                    accessibilityRole="button"
                    accessibilityLabel={`${r.long}: ${r.day ? durationLabel(minutes, t) : "—"}`}
                    className="flex-1 items-center gap-1"
                  >
                    <Text className="font-bodySemibold text-[11px]" style={{ color: colors.sleep }}>
                      {r.day && minutes ? `${fmt(minutes / 60)}h` : "—"}
                    </Text>
                    {r.day && minutes ? (
                      <View className="w-full rounded-lg" style={{ height: h, maxWidth: 28, backgroundColor: colors.sleep, opacity: r.isToday ? 0.6 : 1 }} />
                    ) : (
                      <View className="w-full rounded-lg border border-dashed border-cream-line" style={{ height: 36, maxWidth: 28 }} />
                    )}
                    <Text className={`text-[12px] ${r.isToday ? "font-bodySemibold text-ink" : "font-body text-ink-soft"}`}>{r.short}</Text>
                    <Text className="font-body text-[11px] text-ink-faint">{r.date.getDate()}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View className="rounded-xl2 border border-cream-line bg-surface px-4 pb-2 pt-4">
            <Text className="mb-2 font-bodySemibold text-[15px] text-ink">{t("diary_week_table")}</Text>
            <View className="flex-row border-b border-cream-line pb-1.5">
              <Text className="flex-[2] font-bodySemibold text-[11px] uppercase text-ink-faint">{t("diary_week_col_day")}</Text>
              <Text className="flex-1 text-right font-bodySemibold text-[11px] uppercase text-ink-faint">{t("diary_sum_feeds")}</Text>
              <Text className="flex-1 text-right font-bodySemibold text-[11px] uppercase text-ink-faint">{t("diary_sum_diapers")}</Text>
            </View>
            {rows.map((r) => (
              <Pressable
                key={r.short}
                onPress={() => r.day && onPickDay(r.date)}
                disabled={!r.day}
                accessibilityRole="button"
                className="flex-row items-center border-b border-cream-line py-2.5"
              >
                <Text className={`flex-[2] text-[13.5px] ${r.isToday ? "font-bodySemibold text-ink" : r.future ? "font-body text-ink-faint" : "font-body text-ink"}`}>
                  {r.long}
                  {r.isToday ? ` · ${t("diary_today").toLowerCase()}` : ""}
                </Text>
                <Text className="flex-1 text-right font-bodySemibold text-[13.5px]" style={{ color: r.day ? colors.feeding : theme.inkFaint }}>
                  {r.day ? r.day.feedings : "—"}
                </Text>
                <Text className="flex-1 text-right font-bodySemibold text-[13.5px]" style={{ color: r.day ? colors.diaper : theme.inkFaint }}>
                  {r.day ? r.day.diapers : "—"}
                </Text>
              </Pressable>
            ))}
          </View>

          <View className="rounded-xl2 border border-cream-line bg-surface p-4">
            <Text className="mb-2 font-bodySemibold text-[15px] text-ink">{t("diary_week_events")}</Text>
            {events.length === 0 ? (
              <Text className="font-body text-[13px] text-ink-soft">{t("diary_week_no_events")}</Text>
            ) : (
              events.map((e) => (
                <View key={`${e.kind}-${e.id}`} className="flex-row items-center gap-3 py-1.5">
                  <View className="h-2.5 w-2.5 rounded-full" style={{ borderWidth: 2, borderColor: colors.poop }} />
                  <View className="flex-1">
                    <Text className="font-bodyMedium text-[14px] text-ink">
                      {e.title}
                      {e.detail ? ` · ${e.detail}` : ""}
                    </Text>
                    <Text className="font-body text-[12px] text-ink-soft">
                      {e.dayLabel} · {formatTime(new Date(e.at).toISOString(), lang)}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </View>
        </>
      )}
    </View>
  );
}

function AvgTile({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <View className="flex-1 rounded-2xl p-3" style={{ backgroundColor: `${color}1F` }}>
      <Text className="font-bodySemibold text-[10.5px] uppercase" style={{ color }} numberOfLines={2}>
        {label}
      </Text>
      <Text className="mt-1 font-display text-[16px] text-ink">{value}</Text>
    </View>
  );
}
