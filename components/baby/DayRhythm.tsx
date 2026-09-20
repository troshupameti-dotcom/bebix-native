import { View, Text } from "react-native";
import { useThemeColors } from "@/lib/theme/useThemeColors";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import {
  durationLabel,
  hourTicks,
  nightBands,
  type DayRhythm as Rhythm,
  type TodayTotals,
} from "@/lib/baby/dayStats";

/**
 * Ritmi i 24 orëve të fundit.
 *
 * Tri korsi të ndara, jo një shirit i vetëm: gjumi është gjendje dhe zë
 * bllok, ushqyerja dhe pelena janë çaste dhe zënë shenjë. Kur të trija
 * rrinin mbi njëra-tjetrën, shenja e bardhë e pelenës humbte mbi bllokun e
 * gjumit dhe shiriti lexohej si njollë.
 *
 * Nata hijezohet në sfond. Pa të, tri orë gjumë në mesditë dhe tri orë në
 * mesnatë duken njësoj — ndërsa për prindin janë dy netë krejt të ndryshme.
 *
 * Nuk ka asnjë vlerësim ("natë e mirë", "shumë pak gjumë"): app-i tregon
 * çfarë ndodhi, prindi vendos vetë.
 */

const SLEEP_LANE = 34;
const MARK_LANE = 13;

export function DayRhythm({
  rhythm,
  totals,
  longestSleep,
}: {
  rhythm: Rhythm;
  totals: TodayTotals;
  longestSleep: number;
}) {
  const theme = useThemeColors();
  const { t } = useTranslation();
  const hasAnything = rhythm.sleepBlocks.length > 0 || rhythm.marks.length > 0;

  const feedings = rhythm.marks.filter((m) => m.kind === "feeding");
  const diapers = rhythm.marks.filter((m) => m.kind === "diaper");
  // Dritarja mbaron "tani", ndaj fundi i saj është edhe referenca e orëve.
  const windowEnd = new Date(rhythm.windowStart.getTime() + 86400000);
  const nights = nightBands(rhythm.windowStart, windowEnd);
  const ticks = hourTicks(rhythm.windowStart, windowEnd);

  return (
    <View className="mt-5">
      <View className="mb-3 flex-row items-baseline justify-between">
        <Text className="font-bodySemibold text-base text-ink">{t("rhythm_title")}</Text>
        <View className="flex-row items-center gap-1.5">
          <View className="h-2.5 w-4 rounded-sm" style={{ backgroundColor: theme.ink, opacity: 0.09 }} />
          <Text className="font-body text-[11px] text-ink-faint">{t("rhythm_night")}</Text>
        </View>
      </View>

      {hasAnything ? (
        <>
          <View>
            {/* Korsia e gjumit */}
            <View
              className="overflow-hidden rounded-xl2 bg-cream-soft"
              style={{ height: SLEEP_LANE }}
            >
              {nights.map((band, i) => (
                <View
                  key={`night-${i}`}
                  style={{
                    position: "absolute",
                    left: `${band.start * 100}%`,
                    width: `${(band.end - band.start) * 100}%`,
                    top: 0,
                    bottom: 0,
                    backgroundColor: theme.ink,
                    opacity: 0.07,
                  }}
                />
              ))}

              {rhythm.sleepBlocks.map((block, i) => (
                <View
                  key={`sleep-${i}`}
                  style={{
                    position: "absolute",
                    left: `${block.start * 100}%`,
                    // Një gjumë pesëminutësh duhet të mbetet i dukshëm.
                    width: `${Math.max(0.7, (block.end - block.start) * 100)}%`,
                    top: 5,
                    bottom: 5,
                    borderRadius: 7,
                    backgroundColor: theme.olive,
                  }}
                />
              ))}
            </View>

            {/* Korsia e ushqyerjeve */}
            <MarkLane marks={feedings} color={theme.orange} />
            {/* Korsia e pelenave */}
            <MarkLane marks={diapers} color={theme.inkFaint} />

            {/* "Tani" — buza e djathtë e dritares, e shënuar qartë */}
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                right: 0,
                top: 0,
                height: SLEEP_LANE + MARK_LANE * 2 + 8,
                width: 2,
                borderRadius: 1,
                backgroundColor: theme.ink,
                opacity: 0.45,
              }}
            />
          </View>

          {/* Orët — në pozicionin e vërtetë, jo të ndara në mënyrë të barabartë */}
          <View className="mt-1.5 h-4">
            {ticks.map((tick) => (
              <Text
                key={tick.label + tick.at}
                className="font-body text-[10px] text-ink-faint"
                style={{ position: "absolute", left: `${tick.at * 100}%`, marginLeft: -16, width: 32, textAlign: "center" }}
              >
                {tick.label}
              </Text>
            ))}
            <Text
              className="font-body text-[10px] text-ink-faint"
              style={{ position: "absolute", right: 0 }}
            >
              {t("rhythm_now")}
            </Text>
          </View>

          {/* Legjenda */}
          <View className="mt-3 flex-row items-center">
            <View className="mr-1.5 h-3 w-4 rounded-sm" style={{ backgroundColor: theme.olive }} />
            <Text className="mr-4 font-body text-[11px] text-ink-soft">{t("rhythm_sleep")}</Text>
            <View className="mr-1.5 h-3 w-1.5 rounded-full" style={{ backgroundColor: theme.orange }} />
            <Text className="mr-4 font-body text-[11px] text-ink-soft">{t("rhythm_feeding")}</Text>
            <View className="mr-1.5 h-3 w-1.5 rounded-full" style={{ backgroundColor: theme.inkFaint }} />
            <Text className="font-body text-[11px] text-ink-soft">{t("rhythm_diaper")}</Text>
          </View>
        </>
      ) : (
        <View className="h-12 items-center justify-center rounded-xl2 bg-cream-soft">
          <Text className="font-body text-[11px] text-ink-faint">{t("rhythm_empty")}</Text>
        </View>
      )}

      {/* Totalet e sotme */}
      <View className="mt-4 flex-row">
        <Total label={t("totals_feedings")} value={String(totals.feedings)} />
        <Total
          label={t("totals_sleep")}
          value={totals.sleepMinutes > 0 ? durationLabel(totals.sleepMinutes, t) : "—"}
        />
        <Total label={t("totals_diapers")} value={String(totals.diapers)} />
        <Total
          label={t("totals_longest_sleep")}
          value={longestSleep > 0 ? durationLabel(longestSleep, t) : "—"}
        />
      </View>
    </View>
  );
}

/** Një rresht i hollë shenjash: vija lexohen edhe kur bien pranë njëra-tjetrës. */
function MarkLane({ marks, color }: { marks: { at: number }[]; color: string }) {
  return (
    <View style={{ height: MARK_LANE }}>
      {marks.map((mark, i) => (
        <View
          key={i}
          style={{
            position: "absolute",
            left: `${mark.at * 100}%`,
            marginLeft: -1.5,
            top: 4,
            width: 3,
            height: 9,
            borderRadius: 1.5,
            backgroundColor: color,
          }}
        />
      ))}
    </View>
  );
}

function Total({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-1 pr-2">
      <Text className="font-display text-lg text-ink" numberOfLines={1}>
        {value}
      </Text>
      <Text className="mt-0.5 font-body text-[10.5px] text-ink-faint" numberOfLines={2}>
        {label}
      </Text>
    </View>
  );
}
