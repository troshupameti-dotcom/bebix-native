import { useState } from "react";
import { View, Text, ScrollView, Pressable, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { BackButton } from "@/components/ui/BackButton";
import { Icon } from "@/components/ui/Icon";
import { ThemedSwitch } from "@/components/ui/ThemedSwitch";
import { TONES } from "@/components/baby/LogTiles";
import { MoodRow, SupportBox } from "@/components/parent/CheckInCard";
import { shadows } from "@/lib/shadows";
import { haptics } from "@/lib/haptics";
import { useAppState } from "@/lib/state/AppStateContext";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { useToast } from "@/lib/toast/ToastContext";
import { setLocalReminder } from "@/lib/notifications";
import {
  dayKey, MOOD_EMOJI, needsSupport, recentDays, saveCheckin, saveTodayNote, setCheckinEnabled, tipKeyFor, useCheckins,
} from "@/lib/parent/checkin";
import {
  checkupReminderDate, postpartumWeek, REMINDERS, setReminderEnabled, useEnabledReminders, weekTipKey, type ReminderPreset,
} from "@/lib/parent/postpartum";

/**
 * "Kujdesi për ty": si je ndier këto dy javë (vetëm ti e sheh), shënimi i
 * sotëm, këshillat pas lindjes dhe kujtesat që i ndez vetë.
 */
export default function ParentCareScreen() {
  const { t, lang } = useTranslation();
  const { state } = useAppState();
  const { showToast } = useToast();
  const { list, prefs } = useCheckins();
  const enabledReminders = useEnabledReminders();
  const today = list.find((c) => c.day === dayKey(new Date())) ?? null;
  const [note, setNote] = useState<string | null>(null);
  const noteValue = note ?? today?.note ?? "";
  const ppWeek = postpartumWeek(state.profile.babyDob, state.profile.relation);
  const days = recentDays(list);

  async function toggleReminder(r: ReminderPreset, on: boolean) {
    haptics.select();
    const date = r.once ? checkupReminderDate(state.profile.babyDob) : null;
    const ok = await setLocalReminder(
      `bebix-pp-${r.key}`,
      on ? { title: t(r.labelKey), body: t(r.bodyKey), ...(r.once ? { date: date ?? undefined } : { daily: { hour: r.hour, minute: r.minute } }), route: "/(main)/baby/parent-care" } : null
    );
    if (on && !ok) {
      showToast(t("pp_rem_permission"));
      return;
    }
    setReminderEnabled(r.key, on);
  }

  const time = (r: ReminderPreset) => {
    if (!r.once) return `${String(r.hour).padStart(2, "0")}:${String(r.minute).padStart(2, "0")}`;
    const d = checkupReminderDate(state.profile.babyDob);
    return d ? d.toLocaleDateString(lang === "en" ? "en-GB" : "sq-AL", { day: "numeric", month: "long" }) : t("pp_rem_checkup_passed");
  };

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      <View className="flex-row items-center gap-3 px-4 pb-3 pt-2">
        <BackButton fallback="/(main)/baby" />
        <Text className="font-display text-xl text-ink">{t("care_title")}</Text>
      </View>

      <ScrollView className="flex-1 px-5" contentContainerStyle={{ paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
        <Text className="mb-4 font-body text-sm leading-6 text-ink-soft">{t("care_intro")}</Text>

        <View style={shadows.soft} className="rounded-xl3 bg-surface p-4">
          <Text className="mb-3 font-bodySemibold text-base text-ink">{t("ci_title")}</Text>
          <MoodRow value={today?.mood ?? null} onPick={(m) => saveCheckin(m)} />
          {today ? (
            <>
              <Text className="mt-3 font-bodyMedium text-[14px] leading-5 text-ink">{t(tipKeyFor(today.mood, today.day))}</Text>
              <TextInput
                value={noteValue}
                onChangeText={setNote}
                onEndEditing={() => note !== null && saveTodayNote(note)}
                placeholder={t("care_note_ph")}
                placeholderClassName="text-ink-faint"
                multiline
                maxLength={500}
                className="mt-3 rounded-2xl border border-ink/10 bg-cream px-4 py-3 font-body text-[14px] text-ink"
                style={{ minHeight: 72, textAlignVertical: "top" }}
              />
            </>
          ) : null}
          {needsSupport(list) ? <SupportBox /> : null}
        </View>

        <View style={shadows.soft} className="mt-5 rounded-xl3 bg-surface p-4">
          <Text className="mb-3 font-bodySemibold text-base text-ink">{t("care_last_days")}</Text>
          <View className="flex-row flex-wrap" style={{ gap: 6 }}>
            {days.map((d) => (
              <View key={d.day} className="items-center" style={{ width: "12%" }}>
                <Text style={{ fontSize: 20, opacity: d.mood ? 1 : 0.25 }}>{d.mood ? MOOD_EMOJI[d.mood] : "·"}</Text>
                <Text className="font-body text-[10px] text-ink-faint">{Number(d.day.slice(8))}</Text>
              </View>
            ))}
          </View>
          <Text className="mt-2 font-body text-[11px] text-ink-faint">{t("care_no_streaks")}</Text>
        </View>

        {ppWeek ? (
          <View style={[shadows.soft, { backgroundColor: TONES.pink.tintBg }]} className="mt-5 rounded-xl3 p-4">
            <Text className="font-bodySemibold text-[13px]" style={{ color: TONES.pink.tint }}>
              {t("pp_card_title", { n: ppWeek })}
            </Text>
            <Text className="mt-1 font-bodyMedium text-[14.5px] leading-5" style={{ color: "#17212B" }}>
              {t(weekTipKey(ppWeek))}
            </Text>
            <Text className="mb-1 mt-4 font-bodySemibold text-[13px]" style={{ color: "#17212B" }}>
              {t("pp_reminders")}
            </Text>
            {REMINDERS.map((r) => {
              const unavailable = r.once && !checkupReminderDate(state.profile.babyDob);
              return (
                <View key={r.key} className="flex-row items-center py-2" style={{ minHeight: 48 }}>
                  <View className="flex-1">
                    <Text className="font-bodyMedium text-[14px]" style={{ color: "#17212B" }}>
                      {t(r.labelKey)}
                    </Text>
                    <Text className="font-body text-xs" style={{ color: "#5C6670" }}>
                      {time(r)}
                    </Text>
                  </View>
                  <ThemedSwitch
                    value={enabledReminders.includes(r.key) && !unavailable}
                    onValueChange={(v) => void toggleReminder(r, v)}
                    disabled={!!unavailable}
                  />
                </View>
              );
            })}
            <Text className="mt-2 font-body text-[11px] leading-4" style={{ color: "#5C6670" }}>
              {t("pp_doctor_note")}
            </Text>
          </View>
        ) : null}

        <Pressable
          onPress={() => router.push("/community/explore")}
          accessibilityRole="button"
          style={shadows.soft}
          className="mt-5 flex-row items-center gap-3 rounded-xl3 bg-surface p-4"
        >
          <View className="h-9 w-9 items-center justify-center rounded-full" style={{ backgroundColor: TONES.blue.tintBg }}>
            <Icon name="shield" size={16} color={TONES.blue.tint} />
          </View>
          <View className="flex-1">
            <Text className="font-bodySemibold text-[14px] text-ink">{t("ci_support_expert")}</Text>
            <Text className="font-body text-xs text-ink-soft">{t("care_experts_sub")}</Text>
          </View>
          <Icon name="chevronRight" size={16} color={TONES.blue.tint} />
        </Pressable>

        <View style={shadows.soft} className="mt-5 flex-row items-center rounded-xl3 bg-surface p-4">
          <View className="mr-3 flex-1">
            <Text className="font-bodyMedium text-sm text-ink">{t("care_ask_daily")}</Text>
            <Text className="mt-0.5 font-body text-xs text-ink-soft">{t("care_ask_daily_hint")}</Text>
          </View>
          <ThemedSwitch value={prefs.enabled} onValueChange={setCheckinEnabled} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
