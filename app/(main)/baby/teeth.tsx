import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BackButton } from "@/components/ui/BackButton";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Icon } from "@/components/ui/Icon";
import { DateTimeField } from "@/components/baby/DateTimeField";
import { useTones } from "@/lib/theme/tone";
import { shadows } from "@/lib/shadows";
import { haptics } from "@/lib/haptics";
import { useAppState } from "@/lib/state/AppStateContext";
import { useActiveChild } from "@/lib/age/useActiveChild";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import type { TranslationKey } from "@/lib/i18n/translations";
import { formatDate } from "@/lib/dateUtils";
import {
  dueNow, eruptedTeeth, eruptionRange, jawRow, lateFirstTooth, parseTooth, toothEventId, type Jaw, type ToothCode,
} from "@/lib/baby/teeth";

/** Gjerësia relative e dhëmbit sipas pozicionit (incizivët të ngushtë, molarët të gjerë). */
const WIDTH = [1, 0.9, 0.9, 1.15, 1.2];
/** Lartësia relative: incizivët më të gjatë. */
const HEIGHT = [1.35, 1.25, 1.3, 1.05, 1.05];
/** Harku: sa zbret (sipër) ose ngjitet (poshtë) çdo pozicion nga mesi. */
const ARCH = [0, 4, 12, 24, 40];
const GAP = 4;

/**
 * Dhëmbët e qumështit: harku sipër dhe poshtë, prek një dhëmb për ta shënuar me datë. Çdo dhëmb bëhet ngjarje e
 * historikut (sinkronizohet me familjen dhe del te libri i vitit të parë), pa tabelë të re.
 */
export default function TeethScreen() {
  const tones = useTones();
  const { t, lang } = useTranslation();
  const { state, baby } = useAppState();
  const { months } = useActiveChild();
  const { width } = useWindowDimensions();
  const erupted = useMemo(() => eruptedTeeth(state.baby.timeline), [state.baby.timeline]);
  const due = useMemo(() => dueNow(new Set(erupted.keys()), months), [erupted, months]);
  const duePairs = new Set(due.map((c) => c[0] + c[2]));
  const [open, setOpen] = useState<ToothCode | null>(null);
  const [date, setDate] = useState(() => new Date().toISOString());

  const units = 2 * WIDTH.reduce((s, w) => s + w, 0);
  const unit = Math.max(16, (Math.min(width, 520) - 40 - 32 - 9 * GAP) / units);

  const name = (code: ToothCode) => {
    const { jaw, side, pos } = parseTooth(code);
    return t("teeth_name", {
      pos: t(`teeth_pos_${pos}` as TranslationKey),
      jaw: t(`teeth_jaw_${jaw}` as TranslationKey),
      side: t(`teeth_side_${side}` as TranslationKey),
    });
  };
  const range = (code: ToothCode) => {
    const [from, to] = eruptionRange(code);
    return t("teeth_range", { from, to });
  };

  function openTooth(code: ToothCode) {
    haptics.select();
    setDate(erupted.get(code)?.date ?? new Date().toISOString());
    setOpen(code);
  }

  function mark() {
    if (!open) return;
    const n = name(open);
    const lower = n.charAt(0).toLocaleLowerCase() + n.slice(1);
    const title = erupted.size === 0 ? t("teeth_event_first", { name: lower }) : t("teeth_event_title", { name: lower });
    baby.addTimelineEvent(title, date, toothEventId(open));
    haptics.success();
    setOpen(null);
  }

  function saveDate() {
    const ev = open ? erupted.get(open) : null;
    if (ev) baby.updateTimelineEvent(ev.id, { date });
    haptics.success();
    setOpen(null);
  }

  function remove() {
    const ev = open ? erupted.get(open) : null;
    if (ev) baby.deleteTimelineEvent(ev.id);
    haptics.select();
    setOpen(null);
  }

  const first = [...erupted.values()][0] ?? null;
  const current = open ? erupted.get(open) ?? null : null;

  const row = (jaw: Jaw) => (
      <View style={{ flexDirection: "row", justifyContent: "center", alignItems: jaw === "U" ? "flex-start" : "flex-end", gap: GAP }}>
        {jawRow(jaw).map((code) => {
          const { pos } = parseTooth(code);
          const on = erupted.has(code);
          const soon = !on && duePairs.has(code[0] + code[2]);
          const w = unit * WIDTH[pos - 1];
          const h = unit * HEIGHT[pos - 1];
          const r = pos >= 4 ? w * 0.3 : w * 0.45;
          return (
            <Pressable
              key={code}
              onPress={() => openTooth(code)}
              accessibilityRole="button"
              accessibilityLabel={`${name(code)}. ${on ? formatDate(erupted.get(code)!.date, lang) : range(code)}`}
              hitSlop={2}
              style={{
                width: w,
                height: h,
                marginTop: jaw === "U" ? ARCH[pos - 1] : 0,
                marginBottom: jaw === "L" ? ARCH[pos - 1] : 0,
                borderRadius: r,
                borderTopLeftRadius: jaw === "U" ? w * 0.2 : r,
                borderTopRightRadius: jaw === "U" ? w * 0.2 : r,
                borderBottomLeftRadius: jaw === "L" ? w * 0.2 : r,
                borderBottomRightRadius: jaw === "L" ? w * 0.2 : r,
                backgroundColor: on ? tones.blue.tint : tones.blue.tintBg,
                borderWidth: soon ? 2 : 0,
                borderColor: tones.amber.tint,
              }}
            />
          );
        })}
      </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      <View className="flex-row items-center gap-3 px-4 pb-3 pt-2">
        <BackButton fallback="/(main)/baby" />
        <Text accessibilityRole="header" className="font-display text-xl text-ink">
          {t("teeth_title")}
        </Text>
      </View>

      <ScrollView className="flex-1 px-5" contentContainerStyle={{ paddingBottom: 32 }}>
        <View style={shadows.soft} className="rounded-xl3 bg-surface p-4">
          <Text className="font-display text-[22px] text-ink">{t("teeth_count", { n: erupted.size })}</Text>
          <Text className="mt-1 font-body text-[13.5px] leading-5 text-ink-soft">
            {first ? t("teeth_first", { date: formatDate(first.date, lang) }) : t("teeth_none")}
          </Text>

          <Text className="mt-4 text-center font-bodyMedium text-[12px] text-ink-soft">{t("teeth_upper")}</Text>
          <View className="mt-2">
            {row("U")}
          </View>
          <View style={{ height: 18 }} />
          {row("L")}
          <Text className="mt-2 text-center font-bodyMedium text-[12px] text-ink-soft">{t("teeth_lower")}</Text>
          <View className="mt-2 flex-row justify-between">
            <Text className="font-body text-[11.5px] text-ink-soft">{`← ${t("teeth_baby_right")}`}</Text>
            <Text className="font-body text-[11.5px] text-ink-soft">{`${t("teeth_baby_left")} →`}</Text>
          </View>
          <Text className="mt-3 text-center font-body text-[12.5px] text-ink-soft">{t("teeth_tap_hint")}</Text>
        </View>

        {lateFirstTooth(erupted.size, months) ? (
          <View className="mt-4 rounded-2xl p-4" style={{ backgroundColor: tones.amber.tintBg }}>
            <Text className="font-bodyMedium text-[14px] leading-5" style={{ color: tones.amber.tint }}>
              {t("teeth_late")}
            </Text>
          </View>
        ) : null}

        {due.length > 0 ? (
          <View style={shadows.soft} className="mt-4 rounded-2xl bg-surface p-4">
            <View className="flex-row items-center gap-2">
              <View style={{ width: 12, height: 12, borderRadius: 4, borderWidth: 2, borderColor: tones.amber.tint }} />
              <Text className="font-bodySemibold text-[15px] text-ink">{t("teeth_due_now")}</Text>
            </View>
            {due.map((code) => {
              const { pos, jaw } = parseTooth(code);
              const label = `${t(`teeth_pos_${pos}` as TranslationKey)} ${t(`teeth_jaw_${jaw}` as TranslationKey)}`;
              return (
                <Text key={code} className="mt-1.5 font-body text-[14px] text-ink">
                  {`${label.charAt(0).toLocaleUpperCase()}${label.slice(1)} · ${range(code)}`}
                </Text>
              );
            })}
          </View>
        ) : null}

        <View style={shadows.soft} className="mt-4 rounded-2xl bg-surface p-4">
          <Text className="font-bodySemibold text-[15px] text-ink">{t("teeth_tips_title")}</Text>
          {(["teeth_tip_1", "teeth_tip_2", "teeth_tip_3", "teeth_tip_4", "teeth_dentist"] as const).map((k) => (
            <Text key={k} className="mt-2 font-body text-[13.5px] leading-5 text-ink">
              {`• ${t(k)}`}
            </Text>
          ))}
        </View>
      </ScrollView>

      <BottomSheet visible={!!open} onClose={() => setOpen(null)}>
        {open ? (
          <View className="gap-4 pb-2">
            <View>
              <Text accessibilityRole="header" className="font-display text-xl text-ink">
                {name(open)}
              </Text>
              <Text className="mt-1 font-body text-[13.5px] text-ink-soft">{t("teeth_typical", { range: range(open) })}</Text>
            </View>
            <DateTimeField label={t("teeth_came_in_on")} mode="date" value={date} onChange={setDate} />
            {current ? (
              <View className="flex-row gap-3">
                <Pressable onPress={remove} accessibilityRole="button" className="flex-1 items-center justify-center rounded-2xl border border-ink/10 bg-surface py-3.5">
                  <Text className="font-bodyMedium text-[15px] text-ink">{t("teeth_remove")}</Text>
                </Pressable>
                <Pressable onPress={saveDate} accessibilityRole="button" className="flex-1 items-center justify-center rounded-2xl bg-olive py-3.5">
                  <Text className="font-bodySemibold text-[15px] text-on-accent">{t("teeth_save_date")}</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable onPress={mark} accessibilityRole="button" className="flex-row items-center justify-center gap-2 rounded-2xl bg-olive py-3.5">
                <Icon name="tooth" size={18} color="#FFFFFF" />
                <Text className="font-bodySemibold text-[15px] text-on-accent">{t("teeth_mark")}</Text>
              </Pressable>
            )}
          </View>
        ) : null}
      </BottomSheet>
    </SafeAreaView>
  );
}
