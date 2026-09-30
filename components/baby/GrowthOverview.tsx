import { useState } from "react";
import { View, Text, Pressable } from "react-native";
import { Icon, type IconName } from "@/components/ui/Icon";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { FormField } from "@/components/baby/FormField";
import { DateTimeField } from "@/components/baby/DateTimeField";
import { shadows } from "@/lib/shadows";
import { haptics } from "@/lib/haptics";
import { formatDate } from "@/lib/dateUtils";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { parseMeasure, type LatestGrowth, type LatestMeasure } from "@/lib/baby/growthLatest";
import { useThemeColors } from "@/lib/theme/useThemeColors";

type Props = {
  latest: LatestGrowth;
  /** Ruan një matje (pesha dhe/ose gjatësia) te historiku i rritjes, që sinkronizohet. */
  onAdd: (entry: { date: string; weightKg: number | null; heightCm: number | null }) => void;
  onOpenChart: () => void;
};

/**
 * Pesha dhe gjatësia e bebit, lexuar nga historiku i rritjes.
 *
 * Dy fusha të mëdha krah njëra-tjetrës, me datën e matjes së fundit dhe
 * ndryshimin nga e mëparshmja; një buton i vetëm shton një matje me të dyja
 * vlerat njëherësh (ashtu siç e jep pediatri).
 */
export function GrowthOverview({ latest, onAdd, onOpenChart }: Props) {
  const { t, lang } = useTranslation();
  const theme = useThemeColors();
  const [open, setOpen] = useState(false);
  const [weight, setWeight] = useState("");
  const [height, setHeight] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString());

  const w = parseMeasure(weight);
  const h = parseMeasure(height);
  const canSave = w !== null || h !== null;

  function openSheet() {
    haptics.select();
    setWeight("");
    setHeight("");
    setDate(new Date().toISOString());
    setOpen(true);
  }

  function save() {
    if (!canSave) return;
    onAdd({ date, weightKg: w, heightCm: h });
    haptics.success();
    setOpen(false);
  }

  return (
    <>
      <View style={shadows.soft} className="rounded-xl3 border border-ink/10 bg-surface p-4">
        <View className="flex-row gap-3">
          <MeasureTile
            label={t("growth_weight")}
            unit="kg"
            icon="cube"
            tone={TONES.weight}
            measure={latest.weight}
            lang={lang}
          />
          <MeasureTile
            label={t("growth_height")}
            unit="cm"
            icon="chart"
            tone={TONES.height}
            measure={latest.height}
            lang={lang}
          />
        </View>

        <View className="mt-4 flex-row gap-2.5">
          <Pressable
            onPress={openSheet}
            accessibilityRole="button"
            className="flex-1 flex-row items-center justify-center gap-2 rounded-2xl bg-ink py-3.5"
          >
            <Icon name="plus" size={16} color={theme.cream} />
            <Text className="font-bodySemibold text-[14px] text-cream">{t("growth_add_measurement")}</Text>
          </Pressable>
          <Pressable
            onPress={onOpenChart}
            accessibilityRole="button"
            accessibilityLabel={t("baby_see_chart")}
            className="flex-row items-center justify-center gap-2 rounded-2xl border border-ink/10 bg-cream-soft px-4 py-3.5"
          >
            <Icon name="chart" size={16} color="#2C271F" />
            <Text className="font-bodyMedium text-[14px] text-ink">{t("growth_chart_short")}</Text>
          </Pressable>
        </View>
      </View>

      <BottomSheet visible={open} onClose={() => setOpen(false)}>
        <View className="gap-4 pb-2">
          <Text className="font-display text-xl text-ink">{t("growth_add_measurement")}</Text>
          <DateTimeField label={t("date_field")} mode="date" value={date} onChange={setDate} />
          <View className="flex-row gap-3">
            <View className="flex-1">
              <FormField label={t("growth_weight_ph")} value={weight} onChangeText={setWeight} keyboardType="decimal-pad" placeholder="5.4" />
            </View>
            <View className="flex-1">
              <FormField label={t("growth_height_ph")} value={height} onChangeText={setHeight} keyboardType="decimal-pad" placeholder="60" />
            </View>
          </View>
          <Text className="font-body text-[12px] text-ink-soft">{t("growth_add_hint")}</Text>
          <Pressable
            onPress={save}
            disabled={!canSave}
            className={`items-center rounded-2xl py-4 ${canSave ? "bg-ink" : "bg-ink/30"}`}
          >
            <Text className="font-bodySemibold text-[15px] text-cream">{t("save_action")}</Text>
          </Pressable>
        </View>
      </BottomSheet>
    </>
  );
}

type Tone = { light: { tint: string; bg: string; iconBg: string }; dark: { tint: string; bg: string; iconBg: string } };

/**
 * Ngjyrat e dy fushave. Te tema e errët pastelet e çelëta dukeshin si
 * njolla të bardha nën tekstin krem: atje sfondi është vetë ngjyra, e tejdukshme.
 */
const TONES: Record<"weight" | "height", Tone> = {
  weight: {
    light: { tint: "#B23A1C", bg: "#F3DCCF99", iconBg: "#F3DCCF" },
    dark: { tint: "#F0A58C", bg: "#E0785A26", iconBg: "#E0785A40" },
  },
  height: {
    light: { tint: "#2E6FA8", bg: "#D9E7F299", iconBg: "#D9E7F2" },
    dark: { tint: "#94C2EC", bg: "#5A9BD626", iconBg: "#5A9BD640" },
  },
};

function MeasureTile({
  label,
  unit,
  icon,
  tone,
  measure,
  lang,
}: {
  label: string;
  unit: string;
  icon: IconName;
  tone: Tone;
  measure: LatestMeasure | null;
  lang: "sq" | "en";
}) {
  const { t } = useTranslation();
  const { isDark } = useThemeColors();
  const { tint, bg, iconBg } = isDark ? tone.dark : tone.light;
  const delta = measure?.delta ?? null;
  const deltaText = delta === null || delta === 0 ? null : `${delta > 0 ? "+" : "−"}${formatNumber(Math.abs(delta))} ${unit}`;

  return (
    <View className="flex-1 rounded-2xl p-3.5" style={{ backgroundColor: bg }}>
      <View className="flex-row items-center gap-2">
        <View className="h-7 w-7 items-center justify-center rounded-full" style={{ backgroundColor: iconBg }}>
          <Icon name={icon} size={14} color={tint} />
        </View>
        <Text className="font-bodySemibold text-[12.5px]" style={{ color: tint }}>
          {label}
        </Text>
      </View>

      {measure ? (
        <>
          <View className="mt-3 flex-row items-baseline gap-1">
            <Text className="font-display text-[30px] leading-[34px] text-ink">{formatNumber(measure.value)}</Text>
            <Text className="font-bodyMedium text-[14px] text-ink-soft">{unit}</Text>
          </View>
          <Text className="mt-1 font-body text-[11.5px] text-ink-soft">{formatDate(measure.date, lang)}</Text>
          {deltaText ? (
            <View className="mt-2 self-start rounded-full bg-surface px-2 py-0.5">
              <Text className="font-bodyMedium text-[11px]" style={{ color: tint }}>
                {deltaText}
              </Text>
            </View>
          ) : null}
        </>
      ) : (
        <>
          <Text className="mt-3 font-display text-[30px] leading-[34px] text-ink/25">—</Text>
          <Text className="mt-1 font-body text-[11.5px] text-ink-soft">{t("growth_empty")}</Text>
        </>
      )}
    </View>
  );
}

/** 5.9 → "5.9", 61 → "61", 5.25 → "5.25". */
function formatNumber(n: number): string {
  return String(Math.round(n * 100) / 100);
}
