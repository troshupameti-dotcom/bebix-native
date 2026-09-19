import { View, Text } from "react-native";
import { useThemeColors } from "@/lib/theme/useThemeColors";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { durationLabel, type DayRhythm as Rhythm, type TodayTotals } from "@/lib/baby/dayStats";

/**
 * Ritmi i 24 orëve të fundit.
 *
 * Një shirit i vetëm ku gjumi janë blloqe, ushqyerjet dhe pelenat janë
 * shenja. Prindi e sheh me një vështrim nëse nata ishte e copëtuar apo jo —
 * gjë që një listë regjistrimesh nuk e tregon kurrë.
 *
 * Nuk ka asnjë vlerësim ("natë e mirë", "shumë pak gjumë"): app-i tregon
 * çfarë ndodhi, prindi vendos vetë.
 */

const HOUR_LABELS = [0, 6, 12, 18, 24];

function hourAt(windowStart: Date, fraction: number): string {
  const d = new Date(windowStart.getTime() + fraction * 86400000);
  return `${String(d.getHours()).padStart(2, "0")}:00`;
}

export function DayRhythm({ rhythm, totals }: { rhythm: Rhythm; totals: TodayTotals }) {
  const theme = useThemeColors();
  const { t } = useTranslation();
  const hasAnything = rhythm.sleepBlocks.length > 0 || rhythm.marks.length > 0;

  return (
    <View className="mt-5">
      <View className="flex-row items-baseline justify-between mb-3">
        <Text className="font-bodySemibold text-base text-ink">{t("rhythm_title")}</Text>
        <Text className="font-body text-[11px] text-ink-faint">
          {t("rhythm_until_now", { from: hourAt(rhythm.windowStart, 0) })}
        </Text>
      </View>

      {hasAnything ? (
        <>
          {/* Shiriti */}
          <View className="h-12 rounded-xl2 bg-cream-soft overflow-hidden justify-center">
            {rhythm.sleepBlocks.map((block, i) => (
              <View
                key={`sleep-${i}`}
                style={{
                  position: "absolute",
                  left: `${block.start * 100}%`,
                  width: `${Math.max(0.6, (block.end - block.start) * 100)}%`,
                  top: 0,
                  bottom: 0,
                  backgroundColor: theme.olive,
                  opacity: 0.85,
                }}
              />
            ))}

            {rhythm.marks.map((mark, i) => (
              <View
                key={`mark-${i}`}
                style={{
                  position: "absolute",
                  left: `${mark.at * 100}%`,
                  marginLeft: -3,
                  width: 6,
                  height: 6,
                  borderRadius: 3,
                  // Ushqyerjet rrinë lart, pelenat poshtë: dy rreshta shenjash
                  // janë më të lexueshëm se një rresht me dy ngjyra.
                  top: mark.kind === "feeding" ? 8 : undefined,
                  bottom: mark.kind === "diaper" ? 8 : undefined,
                  backgroundColor: mark.kind === "feeding" ? theme.orange : theme.surface,
                  borderWidth: mark.kind === "diaper" ? 1 : 0,
                  borderColor: theme.inkFaint,
                }}
              />
            ))}
          </View>

          {/* Orët */}
          <View className="flex-row justify-between mt-1.5">
            {HOUR_LABELS.map((h) => (
              <Text key={h} className="font-body text-[10px] text-ink-faint">
                {hourAt(rhythm.windowStart, h / 24)}
              </Text>
            ))}
          </View>

          {/* Legjenda */}
          <View className="flex-row items-center mt-3">
            <View className="w-3 h-3 rounded-sm mr-1.5" style={{ backgroundColor: theme.olive, opacity: 0.85 }} />
            <Text className="font-body text-[11px] text-ink-soft mr-4">{t("rhythm_sleep")}</Text>
            <View className="w-2 h-2 rounded-full mr-1.5" style={{ backgroundColor: theme.orange }} />
            <Text className="font-body text-[11px] text-ink-soft mr-4">{t("rhythm_feeding")}</Text>
            <View
              className="w-2 h-2 rounded-full mr-1.5"
              style={{ backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.inkFaint }}
            />
            <Text className="font-body text-[11px] text-ink-soft">{t("rhythm_diaper")}</Text>
          </View>
        </>
      ) : (
        <View className="h-12 rounded-xl2 bg-cream-soft items-center justify-center">
          <Text className="font-body text-[11px] text-ink-faint">
            {t("rhythm_empty")}
          </Text>
        </View>
      )}

      {/* Totalet e sotme */}
      <View className="flex-row mt-4">
        <Total label={t("totals_feedings")} value={String(totals.feedings)} />
        <Total label={t("totals_sleep")} value={totals.sleepMinutes > 0 ? durationLabel(totals.sleepMinutes) : "—"} />
        <Total label={t("totals_diapers")} value={String(totals.diapers)} />
      </View>
    </View>
  );
}

function Total({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-1">
      <Text className="font-display text-xl text-ink">{value}</Text>
      <Text className="font-body text-[11px] text-ink-faint mt-0.5">{label}</Text>
    </View>
  );
}
