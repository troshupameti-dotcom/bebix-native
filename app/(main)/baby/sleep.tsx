import { useMemo, useState } from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { router } from "expo-router";
import { MotiView } from "moti";
import { SafeAreaView } from "react-native-safe-area-context";
import { Icon } from "@/components/ui/Icon";
import { RecordSheet } from "@/components/baby/RecordSheet";
import { FormField } from "@/components/baby/FormField";
import { SegmentedField } from "@/components/baby/SegmentedField";
import { DateTimeField } from "@/components/baby/DateTimeField";
import { StatsRow } from "@/components/baby/StatsRow";
import { useAppState, active } from "@/lib/state/AppStateContext";
import { useToast } from "@/lib/toast/ToastContext";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { haptics } from "@/lib/haptics";
import { formatTime, formatDuration } from "@/lib/dateUtils";
import { shadows } from "@/lib/shadows";
import { SleepEntry, SleepQuality } from "@/lib/state/types";

type FormShape = {
  startAt: string;
  endAt: string | null;
  isNap: boolean;
  quality: SleepQuality;
  note: string;
};

function formFromEntry(e: SleepEntry): FormShape {
  return { startAt: e.startAt, endAt: e.endAt, isNap: e.isNap, quality: e.quality, note: e.note };
}

export default function SleepScreen() {
  const { t, lang } = useTranslation();
  const { state, baby } = useAppState();
  const { showToast } = useToast();
  const log = active(state.baby.sleepLog).sort((a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime());
  const ongoing = log.find((s) => s.endAt === null);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormShape | null>(null);

  const stats = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfWeek = now.getTime() - 6 * 86400000;
    const withDuration = (e: SleepEntry) => {
      const end = e.endAt ? new Date(e.endAt).getTime() : Date.now();
      return Math.max(0, (end - new Date(e.startAt).getTime()) / 60000 - e.pausedIntervalsMin);
    };
    const today = log.filter((e) => new Date(e.startAt).getTime() >= startOfToday);
    const week = log.filter((e) => new Date(e.startAt).getTime() >= startOfWeek);
    const todayMin = today.reduce((sum, e) => sum + withDuration(e), 0);
    const weekMin = week.reduce((sum, e) => sum + withDuration(e), 0);
    const fmt = (min: number) => `${Math.floor(min / 60)}h ${Math.round(min % 60)}m`;
    const nightWakes = today.filter((e) => !e.isNap).length;
    return { today: fmt(todayMin), week: fmt(weekMin / 7), wakes: String(nightWakes) };
  }, [log]);

  function openEdit(entry: SleepEntry) {
    haptics.select();
    setForm(formFromEntry(entry));
    setEditingId(entry.id);
    setSheetOpen(true);
  }
  function closeSheet() {
    if (editingId && form) baby.updateSleepEntry(editingId, form);
    setSheetOpen(false);
  }
  function save() {
    if (!editingId || !form) return;
    baby.updateSleepEntry(editingId, form);
    haptics.success();
    setSheetOpen(false);
  }
  function handleDelete() {
    if (!editingId) return;
    const id = editingId;
    baby.deleteSleepEntry(id);
    showToast(t("deleted_toast"), () => baby.restoreSleepEntry(id));
  }
  function handleArchive() {
    if (!editingId) return;
    baby.archiveSleepEntry(editingId);
  }
  function handleDuplicate() {
    if (!editingId) return;
    baby.duplicateSleepEntry(editingId);
  }
  const editingEntry = editingId ? log.find((e) => e.id === editingId) : null;

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      <View className="flex-row items-center gap-3 px-4 pb-3 pt-2">
        <Pressable onPress={() => router.back()} hitSlop={8} className="h-9 w-9 items-center justify-center">
          <Icon name="chevronLeft" size={20} color="#2C271F" />
        </Pressable>
        <Text className="font-display text-xl text-ink">{t("sleep_screen_title")}</Text>
      </View>

      <ScrollView className="flex-1 px-5" contentContainerStyle={{ paddingBottom: 24 }}>
        <StatsRow
          stats={[
            { label: t("sleep_stats_today"), value: stats.today },
            { label: t("sleep_stats_avg"), value: stats.week },
            { label: "Zgjime", value: stats.wakes },
          ]}
        />

        {log.length === 0 ? (
          <View className="items-center gap-2 py-16">
            <Icon name="moon" size={26} color="#E9DFCC" />
            <Text className="font-body text-sm text-ink-soft">{t("sleep_empty")}</Text>
          </View>
        ) : (
          log.map((entry, i) => (
            <MotiView
              key={entry.id}
              from={{ opacity: 0, translateX: -8 }}
              animate={{ opacity: 1, translateX: 0 }}
              transition={{ type: "timing", duration: 220, delay: Math.min(i, 6) * 25 }}
            >
              <Pressable
                onPress={() => (entry.endAt !== null ? openEdit(entry) : undefined)}
                style={shadows.press}
                className="mb-2.5 flex-row items-center gap-3 rounded-xl2 border border-ink/10 bg-white p-3.5"
              >
                <View className="h-10 w-10 items-center justify-center rounded-xl bg-olive-bg">
                  <Icon name="moon" size={17} color="#6E7452" />
                </View>
                <View className="flex-1">
                  <Text className="font-bodySemibold text-[14px] text-ink">
                    {entry.endAt === null
                      ? entry.pausedAt
                        ? t("sleep_pause")
                        : t("sleep_ongoing")
                      : formatDuration(entry.startAt, entry.endAt)}
                  </Text>
                  <Text className="font-body text-xs text-ink-soft">
                    {formatTime(entry.startAt, lang)} {entry.endAt ? `– ${formatTime(entry.endAt, lang)}` : ""}
                    {" · "}
                    {entry.isNap ? t("sleep_is_nap") : t("sleep_is_night")}
                  </Text>
                </View>
                {entry.endAt === null ? (
                  <View className="flex-row gap-1.5">
                    <Pressable
                      onPress={() => (entry.pausedAt ? baby.resumeSleep(entry.id) : baby.pauseSleep(entry.id))}
                      className="rounded-full bg-cream-soft px-3 py-1.5"
                    >
                      <Text className="font-bodySemibold text-[11px] text-ink">
                        {entry.pausedAt ? t("sleep_resume") : t("sleep_pause")}
                      </Text>
                    </Pressable>
                    <Pressable onPress={() => baby.endSleep(entry.id)} className="rounded-full bg-ink px-3 py-1.5">
                      <Text className="font-bodySemibold text-[11px] text-cream">{t("sleep_end")}</Text>
                    </Pressable>
                  </View>
                ) : (
                  <Icon name="chevronRight" size={16} color="#A79D8A" />
                )}
              </Pressable>
            </MotiView>
          ))
        )}
      </ScrollView>

      <View className="flex-row gap-2.5 px-5 pb-6">
        <Pressable
          disabled={!!ongoing}
          onPress={() => {
            haptics.tap();
            baby.startSleep(true);
          }}
          className={`flex-1 flex-row items-center justify-center gap-2 rounded-2xl py-4 ${ongoing ? "bg-ink/30" : "bg-ink"}`}
        >
          <Icon name="moon" size={16} color="#FBF6EE" />
          <Text className="font-bodyMedium text-[14px] text-cream">{t("sleep_is_nap")}</Text>
        </Pressable>
        <Pressable
          disabled={!!ongoing}
          onPress={() => {
            haptics.tap();
            baby.startSleep(false);
          }}
          className={`flex-1 flex-row items-center justify-center gap-2 rounded-2xl py-4 ${ongoing ? "bg-ink/30" : "bg-olive"}`}
        >
          <Icon name="moon" size={16} color="#FBF6EE" />
          <Text className="font-bodyMedium text-[14px] text-cream">{t("sleep_is_night")}</Text>
        </Pressable>
      </View>

      {form && (
        <RecordSheet
          visible={sheetOpen}
          onClose={closeSheet}
          title={t("sleep_edit_title")}
          onDuplicate={handleDuplicate}
          onArchive={handleArchive}
          onDelete={handleDelete}
          lifecycle={editingEntry ?? undefined}
          shareText={`${formatDuration(form.startAt, form.endAt)} · ${formatTime(form.startAt, lang)}`}
        >
          <View className="gap-4">
            <DateTimeField label={t("sleep_start")} mode="datetime" value={form.startAt} onChange={(iso) => setForm((f) => f && { ...f, startAt: iso })} />
            {form.endAt && (
              <DateTimeField label={t("sleep_end")} mode="datetime" value={form.endAt} onChange={(iso) => setForm((f) => f && { ...f, endAt: iso })} />
            )}
            <SegmentedField
              label={t("sleep_is_nap")}
              options={[
                { value: "nap", label: t("sleep_is_nap") },
                { value: "night", label: t("sleep_is_night") },
              ]}
              value={form.isNap ? "nap" : "night"}
              onChange={(v) => setForm((f) => f && { ...f, isNap: v === "nap" })}
            />
            <SegmentedField
              label={t("sleep_quality")}
              options={(["good", "fair", "restless"] as SleepQuality[]).map((q) => ({
                value: q as string,
                label: t(`sleep_quality_${q}` as never),
              }))}
              value={form.quality ?? "good"}
              onChange={(v) => setForm((f) => f && { ...f, quality: v as SleepQuality })}
            />
            <FormField
              label={t("note_field")}
              placeholder={t("note_ph")}
              value={form.note}
              onChangeText={(v) => setForm((f) => f && { ...f, note: v })}
              multiline
            />
            <Pressable onPress={save} className="mt-1 items-center rounded-2xl bg-ink py-4">
              <Text className="font-bodyMedium text-[15px] text-cream">{t("save_action")}</Text>
            </Pressable>
          </View>
        </RecordSheet>
      )}
    </SafeAreaView>
  );
}
