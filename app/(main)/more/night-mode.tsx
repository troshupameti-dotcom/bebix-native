import { useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { BackButton } from "@/components/ui/BackButton";
import { ThemedSwitch } from "@/components/ui/ThemedSwitch";
import { Icon } from "@/components/ui/Icon";
import { AnalogNightClock, NIGHT_COLORS } from "@/components/baby/NightClock";
import { shadows } from "@/lib/shadows";
import { haptics } from "@/lib/haptics";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { useThemeColors } from "@/lib/theme/useThemeColors";
import { formatTime } from "@/lib/dateUtils";
import {
  DIM_LEVELS, hourLabel, setNightAuto, setNightClock, setNightDim, setNightHours, setNightOverride, useNightMode, type NightClockStyle,
} from "@/lib/baby/nightMode";
import type { TranslationKey } from "@/lib/i18n/translations";

const DIM_LABELS: Record<string, TranslationKey> = { "0.04": "night_dim_low", "0.1": "night_dim_mid", null: "night_dim_off" };

/** Zgjedhës ore me – / + (pa varësi të re), i njëjtë si te Njoftimet. */
function HourStepper({ label, value, onChange }: { label: string; value: number; onChange: (h: number) => void }) {
  const theme = useThemeColors();
  const step = (d: number) => {
    haptics.select();
    onChange((value + d + 24) % 24);
  };
  return (
    <View className="flex-1 items-center">
      <Text className="mb-1.5 font-body text-[11px] text-ink-faint">{label}</Text>
      <View className="flex-row items-center">
        <Pressable onPress={() => step(-1)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`${label} -1`} className="h-10 w-10 items-center justify-center rounded-full bg-cream-soft">
          <Text className="font-bodyMedium text-base text-ink">–</Text>
        </Pressable>
        <Text className="mx-3 w-14 text-center font-bodySemibold text-base text-ink">{hourLabel(value)}</Text>
        <Pressable onPress={() => step(1)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`${label} +1`} className="h-10 w-10 items-center justify-center rounded-full bg-cream-soft">
          <Icon name="plus" size={14} color={theme.ink} />
        </Pressable>
      </View>
    </View>
  );
}

/** Pllaka e zgjedhjes së orës, me parapamje në ngjyrat e natës. */
function ClockOption({ style, selected, label, now }: { style: NightClockStyle; selected: boolean; label: string; now: Date }) {
  return (
    <Pressable
      onPress={() => {
        haptics.select();
        setNightClock(style);
      }}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      className={`flex-1 rounded-xl2 border-2 p-2 ${selected ? "border-olive" : "border-transparent"}`}
    >
      <View style={{ backgroundColor: NIGHT_COLORS.bg, borderRadius: 18, height: 128, alignItems: "center", justifyContent: "center" }}>
        {style === "analog" ? (
          <AnalogNightClock now={now} size={104} />
        ) : (
          <Text style={{ color: NIGHT_COLORS.text, fontSize: 34, fontFamily: "Inter_600SemiBold", letterSpacing: -0.5 }}>{formatTime(now.toISOString(), "sq")}</Text>
        )}
      </View>
      <View className="mt-2 flex-row items-center justify-center" style={{ gap: 6, minHeight: 24 }}>
        {selected ? <Icon name="check" size={14} color="#6E7452" /> : null}
        <Text className={`font-bodySemibold text-[13px] ${selected ? "text-olive" : "text-ink-soft"}`}>{label}</Text>
      </View>
    </Pressable>
  );
}

/**
 * Modaliteti i natës: së pari çelësi "Ndize vetë natën" (si te Apple), pastaj,
 * kur është i ndezur, orari. Poshtë: pamja e orës (digjitale ose analoge, pa
 * numra), ndriçimi i ekranit natën, drita e kuqe dhe "Provoje tani".
 */
export default function NightModeSettings() {
  const { t } = useTranslation();
  const night = useNightMode();
  const { auto, fromHour, toHour, clock, dimLevel } = night.prefs;
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Fillimi dhe mbarimi s'mund të jenë e njëjta orë: kapërcehet një orë më tej.
  const changeFrom = (h: number) => setNightHours(h === toHour ? (h + 1) % 24 : h, toHour);
  const changeTo = (h: number) => setNightHours(fromHour, h === fromHour ? (h + 1) % 24 : h);

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      <View className="mb-2 flex-row items-center px-5 pt-2">
        <BackButton fallback="/(main)/more" className="mr-3" />
        <Text className="font-display text-xl text-ink">{t("night_title")}</Text>
      </View>

      <ScrollView className="flex-1 px-5" contentContainerStyle={{ paddingBottom: 40 }}>
        <Text className="mb-4 font-body text-sm leading-6 text-ink-soft">{t("night_settings_intro")}</Text>

        {/* 1) Çelësi */}
        <View style={shadows.soft} className="rounded-xl2 bg-surface px-4 py-3.5">
          <View className="flex-row items-center" style={{ minHeight: 48 }}>
            <View className="mr-3 h-9 w-9 items-center justify-center rounded-full bg-cream-soft">
              <Icon name="moon" size={16} color="#B23A1C" />
            </View>
            <View className="mr-3 flex-1">
              <Text className="font-bodySemibold text-sm text-ink">{t("night_auto")}</Text>
              <Text className="mt-0.5 font-body text-xs leading-5 text-ink-soft">
                {auto ? t("night_auto_hint", { from: hourLabel(fromHour), to: hourLabel(toHour) }) : t("night_off_hint")}
              </Text>
            </View>
            <ThemedSwitch value={auto} onValueChange={setNightAuto} />
          </View>
        </View>

        {/* 2) Orari, vetëm kur ndizet vetë */}
        {auto ? (
          <View style={shadows.soft} className="mt-4 rounded-xl2 bg-surface p-4">
            <Text className="mb-3 font-bodySemibold text-sm text-ink">{t("night_schedule")}</Text>
            <View className="flex-row">
              <HourStepper label={t("night_from")} value={fromHour} onChange={changeFrom} />
              <HourStepper label={t("night_to")} value={toHour} onChange={changeTo} />
            </View>
          </View>
        ) : null}

        {/* 3) Pamja e orës */}
        <Text className="mb-2 mt-6 px-1 font-bodyMedium text-xs uppercase text-ink-faint">{t("night_clock_title")}</Text>
        <View style={shadows.soft} className="flex-row rounded-xl2 bg-surface p-2" accessibilityRole="radiogroup">
          <ClockOption style="digital" selected={clock === "digital"} label={t("night_clock_digital")} now={now} />
          <ClockOption style="analog" selected={clock === "analog"} label={t("night_clock_analog")} now={now} />
        </View>

        {/* 4) Ndriçimi i ekranit natën */}
        <Text className="mb-2 mt-6 px-1 font-bodyMedium text-xs uppercase text-ink-faint">{t("night_dim_title")}</Text>
        <View style={shadows.soft} className="rounded-xl2 bg-surface p-2">
          <View className="flex-row" style={{ gap: 6 }} accessibilityRole="radiogroup">
            {DIM_LEVELS.map((level) => {
              const selected = dimLevel === level;
              return (
                <Pressable
                  key={String(level)}
                  onPress={() => {
                    haptics.select();
                    setNightDim(level);
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  className={`flex-1 items-center justify-center rounded-xl px-2 ${selected ? "bg-olive" : "bg-cream-soft"}`}
                  style={{ minHeight: 44 }}
                >
                  <Text className={`font-bodySemibold text-[13px] ${selected ? "text-on-accent" : "text-ink-soft"}`}>{t(DIM_LABELS[String(level)])}</Text>
                </Pressable>
              );
            })}
          </View>
          <Text className="mt-2 px-2 pb-1 font-body text-xs leading-5 text-ink-soft">{t("night_dim_hint")}</Text>
        </View>

        {/* 5) Drita e kuqe */}
        <View style={shadows.soft} className="mt-4 flex-row rounded-xl2 bg-surface px-4 py-3.5">
          <View className="mr-3 h-9 w-9 items-center justify-center rounded-full" style={{ backgroundColor: NIGHT_COLORS.bg }}>
            <Icon name="flash" size={16} color={NIGHT_COLORS.text} />
          </View>
          <View className="flex-1">
            <Text className="font-bodySemibold text-sm text-ink">{t("night_light")}</Text>
            <Text className="mt-0.5 font-body text-xs leading-5 text-ink-soft">{t("night_light_settings_hint")}</Text>
          </View>
        </View>

        <Pressable
          onPress={() => {
            haptics.tap();
            setNightOverride("on");
            router.replace("/(main)/baby");
          }}
          accessibilityRole="button"
          className="mt-6 items-center justify-center rounded-full bg-olive px-6"
          style={{ minHeight: 52 }}
        >
          <Text className="font-bodySemibold text-[15px] text-on-accent">{t("night_try")}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
