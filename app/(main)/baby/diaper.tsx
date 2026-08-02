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
import { formatTime } from "@/lib/dateUtils";
import { shadows } from "@/lib/shadows";
import { DiaperEntry, DiaperType } from "@/lib/state/types";

const TYPES: DiaperType[] = ["wet", "dirty", "both"];

type FormShape = { type: DiaperType; color: string; consistency: string; at: string; note: string };
function formFromEntry(e: DiaperEntry): FormShape {
  return { type: e.type, color: e.color ?? "", consistency: e.consistency ?? "", at: e.at, note: e.note };
}

export default function DiaperScreen() {
  const { t, lang } = useTranslation();
  const { state, baby } = useAppState();
  const { showToast } = useToast();
  const log = active(state.baby.diaperLog).sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormShape | null>(null);

  const stats = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfWeek = now.getTime() - 6 * 86400000;
    const today = log.filter((e) => new Date(e.at).getTime() >= startOfToday);
    const week = log.filter((e) => new Date(e.at).getTime() >= startOfWeek);
    return { today: today.length, week: week.length };
  }, [log]);

  function openEdit(entry: DiaperEntry) {
    haptics.select();
    setForm(formFromEntry(entry));
    setEditingId(entry.id);
    setSheetOpen(true);
  }
  function closeSheet() {
    if (editingId && form) baby.updateDiaperEntry(editingId, { ...form, color: form.color || null, consistency: form.consistency || null });
    setSheetOpen(false);
  }
  function save() {
    if (!editingId || !form) return;
    baby.updateDiaperEntry(editingId, { ...form, color: form.color || null, consistency: form.consistency || null });
    haptics.success();
    setSheetOpen(false);
  }
  function handleDelete() {
    if (!editingId) return;
    const id = editingId;
    baby.deleteDiaperEntry(id);
    showToast(t("deleted_toast"), () => baby.restoreDiaperEntry(id));
  }
  function handleArchive() {
    if (!editingId) return;
    baby.archiveDiaperEntry(editingId);
  }
  function handleDuplicate() {
    if (!editingId) return;
    baby.duplicateDiaperEntry(editingId);
  }
  const editingEntry = editingId ? log.find((e) => e.id === editingId) : null;

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      <View className="flex-row items-center gap-3 px-4 pb-3 pt-2">
        <Pressable onPress={() => router.back()} hitSlop={8} className="h-9 w-9 items-center justify-center">
          <Icon name="chevronLeft" size={20} color="#2C271F" />
        </Pressable>
        <Text className="font-display text-xl text-ink">{t("diaper_screen_title")}</Text>
      </View>

      <ScrollView className="flex-1 px-5" contentContainerStyle={{ paddingBottom: 24 }}>
        <StatsRow
          stats={[
            { label: t("diaper_stats_today"), value: String(stats.today) },
            { label: t("diaper_stats_week"), value: String(stats.week) },
          ]}
        />

        {log.length === 0 ? (
          <View className="items-center gap-2 py-16">
            <Icon name="baby" size={26} color="#E9DFCC" />
            <Text className="font-body text-sm text-ink-soft">{t("diaper_empty")}</Text>
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
                onPress={() => openEdit(entry)}
                style={shadows.press}
                className="mb-2.5 flex-row items-center gap-3 rounded-xl2 border border-ink/10 bg-white p-3.5"
              >
                <View className="h-10 w-10 items-center justify-center rounded-xl bg-orange-bg">
                  <Icon name="baby" size={17} color="#C9702E" />
                </View>
                <View className="flex-1">
                  <Text className="font-bodySemibold text-[14px] text-ink">
                    {t(`diaper_type_${entry.type}` as never)}
                  </Text>
                  <Text className="font-body text-xs text-ink-soft">{formatTime(entry.at, lang)}</Text>
                </View>
                <Icon name="chevronRight" size={16} color="#A79D8A" />
              </Pressable>
            </MotiView>
          ))
        )}
      </ScrollView>

      <View className="flex-row gap-2.5 px-5 pb-6">
        {TYPES.map((type) => (
          <Pressable
            key={type}
            onPress={() => {
              haptics.tap();
              baby.addDiaperEntry({ type });
            }}
            className="flex-1 items-center gap-1 rounded-2xl bg-ink py-4"
          >
            <Icon name="baby" size={16} color="#FBF6EE" />
            <Text className="font-bodySemibold text-[12px] text-cream">{t(`diaper_type_${type}` as never)}</Text>
          </Pressable>
        ))}
      </View>

      {form && (
        <RecordSheet
          visible={sheetOpen}
          onClose={closeSheet}
          title={t("diaper_edit_title")}
          onDuplicate={handleDuplicate}
          onArchive={handleArchive}
          onDelete={handleDelete}
          lifecycle={editingEntry ?? undefined}
          shareText={`${t(`diaper_type_${form.type}` as never)} · ${formatTime(form.at, lang)}`}
        >
          <View className="gap-4">
            <SegmentedField
              options={TYPES.map((ty) => ({ value: ty, label: t(`diaper_type_${ty}` as never) }))}
              value={form.type}
              onChange={(v) => setForm((f) => f && { ...f, type: v })}
            />
            <DateTimeField label={`${t("date_field")} · ${t("time_field")}`} mode="datetime" value={form.at} onChange={(iso) => setForm((f) => f && { ...f, at: iso })} />
            <FormField
              label={t("diaper_color_ph")}
              value={form.color}
              onChangeText={(v) => setForm((f) => f && { ...f, color: v })}
            />
            <FormField
              label={t("diaper_consistency_ph")}
              value={form.consistency}
              onChangeText={(v) => setForm((f) => f && { ...f, consistency: v })}
            />
            <FormField
              label={t("note_field")}
              placeholder={t("note_ph")}
              value={form.note}
              onChangeText={(v) => setForm((f) => f && { ...f, note: v })}
              multiline
            />
            <Pressable onPress={save} className="mt-1 items-center rounded-2xl bg-ink py-4">
              <Text className="font-bodySemibold text-[15px] text-cream">{t("save_action")}</Text>
            </Pressable>
          </View>
        </RecordSheet>
      )}
    </SafeAreaView>
  );
}
