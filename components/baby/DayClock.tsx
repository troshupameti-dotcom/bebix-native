import { useState } from "react";
import { View, Text, Pressable, type GestureResponderEvent } from "react-native";
import Svg, { Circle, Path, G, Line } from "react-native-svg";
import { Icon, type IconName } from "@/components/ui/Icon";
import { useThemeColors } from "@/lib/theme/useThemeColors";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { haptics } from "@/lib/haptics";
import { shadows } from "@/lib/shadows";
import { durationLabel } from "@/lib/baby/dayStats";
import { clockPalette, type ClockPalette } from "@/lib/baby/clockPalette";
import {
  fractionFromTouch,
  itemAtFraction,
  nightArcs,
  radiusFromTouch,
  type ClockItem,
  type ClockTotals,
  type DayClock as Clock,
} from "@/lib/baby/dayClock";
import type { BabyGender } from "@/lib/state/types";
import { formatTime } from "@/lib/dateUtils";
import type { TranslationKey } from "@/lib/i18n/translations";

/**
 * Ora 24-orëshe.
 *
 * Mesnata rri lart, mesdita poshtë. Gjumi është unazë e trashë sepse është
 * gjendje që zgjat; ushqyerja, pelena dhe jashtëqitja janë vija të shkurtra
 * sepse janë çaste. Nata hijezohet në sfond, që forma e natës të lexohet pa
 * asnjë numër.
 *
 * Prekja: kudo mbi rreth, këndi kthehet në orë dhe gjendet çfarë ka aty.
 * Nuk përdoret `onPress` mbi format e SVG-së — hit-testing-u i tyre ndryshon
 * mes iOS dhe Android, dhe një vijë tre-pikselëshe s'kapet dot me gisht.
 * Një shtresë e vetme prekjeje mbi rreth e bën këtë njësoj kudo, dhe lejon
 * tolerancë rreth çdo shenje.
 *
 * Detajet hapen poshtë rrethit dhe mbyllen me një prekje jashtë tyre.
 */

const SIZE = 268;
const RING_WIDTH = 26;
const MARK_INSET = 4;

type Selection =
  | { type: "item"; item: ClockItem }
  | { type: "kind"; kind: "sleep" | "feeding" | "diaper" | "poop" }
  | null;

/** Pika në rreth për një thyesë 0–1, me 0 lart. */
function point(fraction: number, radius: number) {
  const angle = fraction * Math.PI * 2 - Math.PI / 2;
  return {
    x: SIZE / 2 + Math.cos(angle) * radius,
    y: SIZE / 2 + Math.sin(angle) * radius,
  };
}

/** Rruga e një harku mes dy thyesave. */
function arcPath(from: number, to: number, radius: number): string {
  // Nje hark i plote nuk vizatohet dot me nje "A": ndahet ne dy gjysma.
  if (to - from >= 0.999) {
    const a = point(0, radius);
    const b = point(0.5, radius);
    return `M ${a.x} ${a.y} A ${radius} ${radius} 0 1 1 ${b.x} ${b.y} A ${radius} ${radius} 0 1 1 ${a.x} ${a.y}`;
  }
  const start = point(from, radius);
  const end = point(to, radius);
  const large = to - from > 0.5 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${large} 1 ${end.x} ${end.y}`;
}

export function DayClock({
  clock,
  totals,
  gender,
}: {
  clock: Clock;
  totals: ClockTotals;
  gender: BabyGender;
}) {
  const theme = useThemeColors();
  const { t, lang } = useTranslation();
  const colors = clockPalette(gender, theme);
  const [selection, setSelection] = useState<Selection>(null);

  const ringRadius = SIZE / 2 - RING_WIDTH / 2 - 2;
  const markOuter = ringRadius - RING_WIDTH / 2 - MARK_INSET;
  const markInner = markOuter - 9;

  const sleeps = clock.items.filter((i) => i.kind === "sleep");
  const marks = clock.items.filter((i) => i.kind !== "sleep");
  const hasAnything = clock.items.length > 0;

  function handleRingPress(event: GestureResponderEvent) {
    const { locationX, locationY } = event.nativeEvent;
    const radius = radiusFromTouch(locationX, locationY, SIZE);
    // Brenda qendres: mbyll, sepse aty nuk ka asgje per te treguar.
    if (radius < 0.45) {
      setSelection(null);
      return;
    }
    const found = itemAtFraction(clock.items, fractionFromTouch(locationX, locationY, SIZE));
    if (found) haptics.select();
    setSelection(found ? { type: "item", item: found } : null);
  }

  return (
    // Cdo prekje jashte kartelës së detajeve e mbyll atë.
    <Pressable onPress={() => setSelection(null)} className="mt-5">
      <View className="mb-3 flex-row items-baseline justify-between">
        <Text className="font-bodySemibold text-base text-ink">{t("clock_title")}</Text>
        <Text className="font-body text-[11px] text-ink-faint">{t("clock_hint")}</Text>
      </View>

      <View className="mb-4 flex-row gap-2">
        <StatCard
          icon="moon"
          color={colors.sleep}
          label={t("rhythm_sleep")}
          value={totals.sleepMinutes > 0 ? durationLabel(totals.sleepMinutes, t) : "—"}
          active={selection?.type === "kind" && selection.kind === "sleep"}
          onPress={() => toggleKind("sleep")}
        />
        <StatCard
          icon="spoon"
          color={colors.feeding}
          label={t("rhythm_feeding")}
          value={String(totals.feedings)}
          active={selection?.type === "kind" && selection.kind === "feeding"}
          onPress={() => toggleKind("feeding")}
        />
        <StatCard
          icon="baby"
          color={colors.diaper}
          label={t("diaper_title")}
          value={String(totals.diapers)}
          active={selection?.type === "kind" && selection.kind === "diaper"}
          onPress={() => toggleKind("diaper")}
        />
        <StatCard
          icon="droplet"
          color={colors.poop}
          label={t("clock_poop")}
          value={String(totals.poops)}
          active={selection?.type === "kind" && selection.kind === "poop"}
          onPress={() => toggleKind("poop")}
        />
      </View>

      <View className="items-center">
        <Pressable onPress={handleRingPress} accessibilityRole="button" accessibilityLabel={t("clock_title")}>
          <Svg width={SIZE} height={SIZE}>
            {/* Unaza bosh */}
            <Circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={ringRadius}
              stroke={colors.track}
              strokeWidth={RING_WIDTH}
              fill="none"
            />

            {/* Nata */}
            {nightArcs().map((band, i) => (
              <Path
                key={`night-${i}`}
                d={arcPath(band.from, band.to, ringRadius)}
                stroke={colors.night}
                strokeOpacity={0.08}
                strokeWidth={RING_WIDTH}
                fill="none"
              />
            ))}

            {/* Orët */}
            <G>
              {Array.from({ length: 24 }, (_, h) => {
                const major = h % 6 === 0;
                const outer = point(h / 24, ringRadius + RING_WIDTH / 2);
                const inner = point(h / 24, ringRadius + RING_WIDTH / 2 - (major ? 7 : 4));
                return (
                  <Line
                    key={`tick-${h}`}
                    x1={outer.x}
                    y1={outer.y}
                    x2={inner.x}
                    y2={inner.y}
                    stroke={theme.inkFaint}
                    strokeOpacity={major ? 0.5 : 0.22}
                    strokeWidth={major ? 1.5 : 1}
                  />
                );
              })}
            </G>

            {/* Gjumi */}
            {sleeps.map((item) => (
              <Path
                key={item.key}
                d={arcPath(item.from, Math.max(item.to, item.from + 0.004), ringRadius)}
                stroke={colors.sleep}
                strokeWidth={RING_WIDTH}
                strokeLinecap="butt"
                fill="none"
                opacity={
                  selection?.type === "item" && selection.item.kind === "sleep" && selection.item.id !== item.id
                    ? 0.35
                    : 1
                }
              />
            ))}

            {/* Çastet */}
            {marks.map((item) => {
              const a = point(item.at, markOuter);
              const b = point(item.at, markInner);
              const isPoop =
                item.kind === "diaper" && (item.entry.type === "dirty" || item.entry.type === "both");
              const color =
                item.kind === "feeding" ? colors.feeding : isPoop ? colors.poop : colors.diaper;
              const chosen = selection?.type === "item" && selection.item.key === item.key;
              return (
                <Line
                  key={item.key}
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  stroke={color}
                  strokeWidth={chosen ? 6 : 3.5}
                  strokeLinecap="round"
                />
              );
            })}

            {/* Tani */}
            <Line
              x1={point(clock.now, ringRadius + RING_WIDTH / 2).x}
              y1={point(clock.now, ringRadius + RING_WIDTH / 2).y}
              x2={point(clock.now, ringRadius - RING_WIDTH / 2 - 6).x}
              y2={point(clock.now, ringRadius - RING_WIDTH / 2 - 6).y}
              stroke={theme.ink}
              strokeWidth={2}
              strokeLinecap="round"
            />
            <Circle cx={point(clock.now, ringRadius).x} cy={point(clock.now, ringRadius).y} r={3.5} fill={theme.ink} />
          </Svg>

          {/* Qendra: numri që lexohet më shpesh */}
          <View pointerEvents="none" className="absolute inset-0 items-center justify-center px-12">
            <Text className="font-display text-[26px] leading-8 text-ink" numberOfLines={1}>
              {totals.sleepMinutes > 0 ? durationLabel(totals.sleepMinutes, t) : "—"}
            </Text>
            <Text className="mt-0.5 text-center font-body text-[11px] leading-4 text-ink-faint">
              {t("clock_center_label")}
            </Text>
            {totals.longestSleepMinutes > 0 && (
              <Text className="mt-2 text-center font-body text-[10.5px] text-ink-faint">
                {t("totals_longest_sleep")} {durationLabel(totals.longestSleepMinutes, t)}
              </Text>
            )}
          </View>

          {/* Etiketat e orëve */}
          <HourLabel fraction={0} label="00:00" />
          <HourLabel fraction={0.25} label="06:00" />
          <HourLabel fraction={0.5} label="12:00" />
          <HourLabel fraction={0.75} label="18:00" />
        </Pressable>
      </View>

      <View className="mt-4 flex-row flex-wrap items-center gap-x-4 gap-y-1.5">
        <Legend color={colors.sleep} label={t("rhythm_sleep")} block />
        <Legend color={colors.feeding} label={t("rhythm_feeding")} />
        <Legend color={colors.diaper} label={t("diaper_title")} />
        <Legend color={colors.poop} label={t("clock_poop")} />
        <Legend color={theme.ink} label={t("clock_night")} block faded />
      </View>

      {!hasAnything && (
        <Text className="mt-4 text-center font-body text-[12px] text-ink-faint">{t("clock_empty")}</Text>
      )}

      {selection && (
        <DetailCard
          selection={selection}
          clock={clock}
          colors={colors}
          lang={lang}
          t={t}
          onClose={() => setSelection(null)}
        />
      )}
    </Pressable>
  );

  function toggleKind(kind: "sleep" | "feeding" | "diaper" | "poop") {
    haptics.select();
    setSelection((prev) => (prev?.type === "kind" && prev.kind === kind ? null : { type: "kind", kind }));
  }
}

function HourLabel({ fraction, label }: { fraction: number; label: string }) {
  const p = point(fraction, SIZE / 2 - RING_WIDTH - 12);
  return (
    <View
      pointerEvents="none"
      style={{ position: "absolute", left: p.x - 24, top: p.y - 8, width: 48 }}
    >
      <Text className="text-center font-body text-[10px] text-ink-faint">{label}</Text>
    </View>
  );
}

function Legend({
  color,
  label,
  block,
  faded,
}: {
  color: string;
  label: string;
  block?: boolean;
  faded?: boolean;
}) {
  return (
    <View className="flex-row items-center gap-1.5">
      <View
        style={{
          width: block ? 14 : 4,
          height: block ? 10 : 12,
          borderRadius: block ? 3 : 2,
          backgroundColor: color,
          opacity: faded ? 0.12 : 1,
        }}
      />
      <Text className="font-body text-[11px] text-ink-soft">{label}</Text>
    </View>
  );
}

function StatCard({
  icon,
  color,
  label,
  value,
  active,
  onPress,
}: {
  icon: IconName;
  color: string;
  label: string;
  value: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={shadows.soft}
      className={`flex-1 rounded-xl2 border px-2.5 py-3 ${
        active ? "border-ink bg-surface-alt" : "border-ink/10 bg-surface"
      }`}
    >
      <Icon name={icon} size={15} color={color} />
      <Text className="mt-1.5 font-bodySemibold text-[15px] leading-5 text-ink" numberOfLines={1}>
        {value}
      </Text>
      <Text className="font-body text-[10px] text-ink-faint" numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

/* ------------------------------------------------------------------ *
 * Detajet
 * ------------------------------------------------------------------ */

type Translate = (key: TranslationKey, params?: Record<string, string | number>) => string;
type Row = { label: string; value: string };

function rowsForItem(item: ClockItem, lang: "sq" | "en", t: Translate): { title: string; rows: Row[] } {
  if (item.kind === "sleep") {
    const e = item.entry;
    const rows: Row[] = [
      { label: t("sleep_start"), value: formatTime(e.startAt, lang) },
      { label: t("sleep_end"), value: e.endAt ? formatTime(e.endAt, lang) : t("clock_ongoing") },
      { label: t("clock_duration"), value: durationLabel(item.minutes, t) },
    ];
    if (e.quality) {
      rows.push({ label: t("sleep_quality"), value: t(`sleep_quality_${e.quality}` as TranslationKey) });
    }
    if (e.note) rows.push({ label: t("note_field"), value: e.note });
    return { title: e.isNap ? t("clock_nap") : t("clock_night_sleep"), rows };
  }

  if (item.kind === "feeding") {
    const e = item.entry;
    const rows: Row[] = [{ label: t("clock_time"), value: formatTime(e.at, lang) }];
    if (e.amountMl) rows.push({ label: t("clock_amount"), value: `${e.amountMl} ml` });
    if (e.durationMin) rows.push({ label: t("clock_duration"), value: durationLabel(e.durationMin, t) });
    if (e.side) rows.push({ label: t("feeding_side"), value: t(`feeding_side_${e.side}` as TranslationKey) });
    if (e.note) rows.push({ label: t("note_field"), value: e.note });
    return {
      title: t(`feeding_type_${e.type === "medicine" ? "medicine_short" : e.type}` as TranslationKey),
      rows,
    };
  }

  const e = item.entry;
  const rows: Row[] = [{ label: t("clock_time"), value: formatTime(e.at, lang) }];
  if (e.color) rows.push({ label: t("diaper_color_ph"), value: e.color });
  if (e.consistency) rows.push({ label: t("clock_consistency"), value: e.consistency });
  if (e.note) rows.push({ label: t("note_field"), value: e.note });
  return { title: t(`diaper_type_${e.type}` as TranslationKey), rows };
}

function itemsOfKind(clock: Clock, kind: "sleep" | "feeding" | "diaper" | "poop"): ClockItem[] {
  if (kind === "sleep") {
    // Nje gjume i ndare ne mesnate do te dilte dy here ne liste.
    const seen = new Set<string>();
    return clock.items.filter((i) => {
      if (i.kind !== "sleep" || seen.has(i.id)) return false;
      seen.add(i.id);
      return true;
    });
  }
  if (kind === "feeding") return clock.items.filter((i) => i.kind === "feeding");
  if (kind === "diaper") return clock.items.filter((i) => i.kind === "diaper");
  return clock.items.filter(
    (i) => i.kind === "diaper" && (i.entry.type === "dirty" || i.entry.type === "both")
  );
}

function DetailCard({
  selection,
  clock,
  colors,
  lang,
  t,
  onClose,
}: {
  selection: NonNullable<Selection>;
  clock: Clock;
  colors: ClockPalette;
  lang: "sq" | "en";
  t: Translate;
  onClose: () => void;
}) {
  const single = selection.type === "item" ? rowsForItem(selection.item, lang, t) : null;
  const list = selection.type === "kind" ? itemsOfKind(clock, selection.kind) : [];
  const kindColor =
    selection.type === "kind"
      ? colors[selection.kind]
      : selection.item.kind === "sleep"
        ? colors.sleep
        : selection.item.kind === "feeding"
          ? colors.feeding
          : selection.item.entry.type === "wet"
            ? colors.diaper
            : colors.poop;

  return (
    // Prekjet brenda detajit nuk e mbyllin atë: vetëm ato jashtë.
    <Pressable
      onPress={() => {}}
      style={shadows.soft}
      className="mt-4 rounded-xl2 border border-ink/10 bg-surface p-4"
    >
      <View className="mb-3 flex-row items-center gap-2">
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: kindColor }} />
        <Text className="flex-1 font-bodySemibold text-[14px] text-ink">
          {single ? single.title : t("clock_all_of", { kind: kindLabel(selection, t) })}
        </Text>
        <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel={t("clock_close")}>
          <Icon name="close" size={14} color="#A79D8A" />
        </Pressable>
      </View>

      {single ? (
        <View className="gap-2">
          {single.rows.map((row) => (
            <View key={row.label} className="flex-row items-start justify-between gap-3">
              <Text className="font-body text-[12.5px] text-ink-soft">{row.label}</Text>
              <Text className="flex-1 text-right font-bodyMedium text-[12.5px] text-ink">{row.value}</Text>
            </View>
          ))}
        </View>
      ) : list.length === 0 ? (
        <Text className="font-body text-[12.5px] text-ink-faint">{t("clock_empty_kind")}</Text>
      ) : (
        <View className="gap-2.5">
          {list.map((item) => {
            const detail = rowsForItem(item, lang, t);
            const when =
              item.kind === "sleep" ? formatTime(item.entry.startAt, lang) : formatTime(item.entry.at, lang);
            return (
              <View key={item.key} className="flex-row items-center gap-3">
                <Text className="w-11 font-body text-[12px] text-ink-faint">{when}</Text>
                <Text className="flex-1 font-bodyMedium text-[12.5px] text-ink" numberOfLines={1}>
                  {detail.title}
                </Text>
                <Text className="font-body text-[12px] text-ink-soft">
                  {detail.rows.find((r) => r.label === t("clock_duration") || r.label === t("clock_amount"))?.value ?? ""}
                </Text>
              </View>
            );
          })}
        </View>
      )}
    </Pressable>
  );
}

function kindLabel(selection: NonNullable<Selection>, t: Translate): string {
  if (selection.type !== "kind") return "";
  switch (selection.kind) {
    case "sleep":
      return t("rhythm_sleep");
    case "feeding":
      return t("rhythm_feeding");
    case "diaper":
      return t("diaper_title");
    case "poop":
      return t("clock_poop");
  }
}
