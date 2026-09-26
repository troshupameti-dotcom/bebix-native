import { View, Text, Pressable } from "react-native";
import { Icon } from "@/components/ui/Icon";
import { useThemeColors } from "@/lib/theme/useThemeColors";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { clockPalette } from "@/lib/baby/clockPalette";
import { dayKeyOf, monthCells, startOfDay, type DayMarks } from "@/lib/baby/diary";
import { haptics } from "@/lib/haptics";
import type { BabyGender } from "@/lib/state/types";

type Props = {
  year: number;
  month: number;
  selected: Date;
  today: Date;
  marks: Map<string, DayMarks>;
  gender: BabyGender;
  onSelect: (day: Date) => void;
  onChangeMonth: (delta: -1 | 1) => void;
};

/**
 * Kalendari i muajit te Ditari. Çdo ditë tregon me pika çfarë u shënua, që
 * prindi ta shohë me një vështrim edhe ditët që harroi t'i shënojë. Ngjyrat
 * janë të njëjtat të unazave të orës, që pika e ushqyerjes këtu të lexohet
 * njësoj si harku i ushqyerjes atje.
 */
export function DiaryCalendar({ year, month, selected, today, marks, gender, onSelect, onChangeMonth }: Props) {
  const theme = useThemeColors();
  const { t } = useTranslation();
  const colors = clockPalette(gender, theme);

  const monthNames = t("diary_months").split(",");
  const monthsOf = t("diary_months_of").split(",");
  const weekdays = t("diary_weekdays_short").split(",");
  const cells = monthCells(year, month);
  const todayStart = startOfDay(today).getTime();
  const selectedKey = dayKeyOf(selected.getTime());
  const todayKey = dayKeyOf(today.getTime());
  // Muajt pas këtij s'kanë asgjë për të treguar.
  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth();

  return (
    <View className="rounded-xl2 border border-cream-line bg-surface px-3 pb-3 pt-3">
      <View className="mb-2 flex-row items-center justify-between">
        <Pressable
          onPress={() => {
            haptics.select();
            onChangeMonth(-1);
          }}
          accessibilityRole="button"
          accessibilityLabel={t("diary_prev_month")}
          className="h-11 w-11 items-center justify-center rounded-full"
        >
          <Icon name="chevronLeft" size={18} color={theme.ink} />
        </Pressable>
        <Text className="font-display text-lg text-ink">
          {monthNames[month]} {year}
        </Text>
        <Pressable
          onPress={() => {
            haptics.select();
            onChangeMonth(1);
          }}
          disabled={isCurrentMonth}
          accessibilityRole="button"
          accessibilityLabel={t("diary_next_month")}
          accessibilityState={{ disabled: isCurrentMonth }}
          className="h-11 w-11 items-center justify-center rounded-full"
          style={{ opacity: isCurrentMonth ? 0.3 : 1 }}
        >
          <Icon name="chevronRight" size={18} color={theme.ink} />
        </Pressable>
      </View>

      <View className="mb-1 flex-row">
        {weekdays.map((w) => (
          <Text key={w} className="flex-1 text-center font-bodySemibold text-[11px] uppercase text-ink-faint">
            {w}
          </Text>
        ))}
      </View>

      <View className="flex-row flex-wrap">
        {cells.map((date, i) => {
          if (!date) return <View key={`blank-${i}`} style={{ width: `${100 / 7}%`, height: 48 }} />;

          const key = dayKeyOf(date.getTime());
          const m = marks.get(key);
          const isSelected = key === selectedKey;
          const isToday = key === todayKey;
          const isFuture = date.getTime() > todayStart;
          const dotColor = (c: string) => (isSelected ? theme.onAccent : c);
          const label = m
            ? t("diary_cell_label", { day: date.getDate(), month: monthsOf[month], n: m.count })
            : t("diary_cell_label_empty", { day: date.getDate(), month: monthsOf[month] });

          return (
            <View key={key} style={{ width: `${100 / 7}%`, height: 48, padding: 2 }}>
              <Pressable
                onPress={() => {
                  haptics.select();
                  onSelect(date);
                }}
                disabled={isFuture}
                accessibilityRole="button"
                accessibilityLabel={label}
                accessibilityState={{ selected: isSelected, disabled: isFuture }}
                className={`flex-1 items-center justify-center rounded-xl ${isSelected ? "bg-olive" : ""}`}
                style={!isSelected && isToday ? { borderWidth: 1.5, borderColor: theme.olive } : undefined}
              >
                <Text
                  className={`text-[14px] ${
                    isSelected
                      ? "font-bodySemibold text-on-accent"
                      : isToday
                        ? "font-bodySemibold text-ink"
                        : isFuture
                          ? "font-body text-ink-faint"
                          : "font-body text-ink"
                  }`}
                  style={isFuture ? { opacity: 0.55 } : undefined}
                >
                  {date.getDate()}
                </Text>
                <View className="mt-1 h-[5px] flex-row gap-[3px]">
                  {m?.feeding && <View className="h-[5px] w-[5px] rounded-full" style={{ backgroundColor: dotColor(colors.feeding) }} />}
                  {m?.sleep && <View className="h-[5px] w-[5px] rounded-full" style={{ backgroundColor: dotColor(colors.sleep) }} />}
                  {m?.diaper && <View className="h-[5px] w-[5px] rounded-full" style={{ backgroundColor: dotColor(colors.diaper) }} />}
                </View>
                {m?.special && (
                  <View
                    className="absolute right-1 top-1 h-[6px] w-[6px] rounded-full"
                    style={{ borderWidth: 1.5, borderColor: dotColor(colors.poop) }}
                  />
                )}
              </Pressable>
            </View>
          );
        })}
      </View>

      <View className="mt-2 flex-row flex-wrap gap-x-3.5 gap-y-1.5 border-t border-cream-line px-1 pt-2.5">
        <LegendDot color={colors.feeding} label={t("diary_sum_feeds")} />
        <LegendDot color={colors.sleep} label={t("diary_sum_sleep")} />
        <LegendDot color={colors.diaper} label={t("diary_sum_diapers")} />
        <View className="flex-row items-center gap-1.5">
          <View className="h-[7px] w-[7px] rounded-full" style={{ borderWidth: 1.5, borderColor: colors.poop }} />
          <Text className="font-body text-[12px] text-ink-soft">{t("diary_legend_special")}</Text>
        </View>
      </View>
    </View>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <View className="flex-row items-center gap-1.5">
      <View className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
      <Text className="font-body text-[12px] text-ink-soft">{label}</Text>
    </View>
  );
}
