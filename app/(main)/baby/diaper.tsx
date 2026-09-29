import { useMemo, useState } from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
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
import { DiaperEntry, DiaperType } from "@/lib/state/types";
import { BackButton } from "@/components/ui/BackButton";
import { SinceHero, LogTile, LogRow, TONES, type Tone } from "@/components/baby/LogTiles";
import type { IconName } from "@/components/ui/Icon";

const TYPES: DiaperType[] = ["wet", "dirty", "both"];

/** E lagur kaltër, e pistë qelibar, të dyja vjollcë — dallohen me një vështrim. */
const TYPE_TONE: Record<DiaperType, Tone> = { wet: TONES.blue, dirty: TONES.amber, both: TONES.purple };
const TYPE_ICON: Record<DiaperType, IconName> = { wet: "droplet", dirty: "diaper", both: "repeat" };

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

  // Nje prekje mjafton: lloji dhe koha. Ngjyra dhe qendrueshmeria
  // kane rendesi vetem kur dicka shkon keq — atehere hapet formulari.
  function quickLog(type: DiaperType) {
    const id = baby.addDiaperEntry({ type });
    haptics.success();
    showToast(t("quick_saved"), () => baby.deleteDiaperEntry(id));
  }

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
        <BackButton fallback="/(main)/baby" />
        <Text className="font-display text-xl text-ink">{t("diaper_screen_title")}</Text>
      </View>

      <ScrollView className="flex-1 px-5" contentContainerStyle={{ paddingBottom: 24 }}>
        <SinceHero
          title={t("diaper_last_title")}
          lastAt={log[0]?.at ?? null}
          emptyText={t("diaper_hero_empty")}
          detail={log[0] ? `${t(`diaper_type_${log[0].type}` as never)} · ${t("today_count", { n: stats.today })}` : undefined}
          icon={log[0] ? TYPE_ICON[log[0].type] : "diaper"}
          tone={log[0] ? TYPE_TONE[log[0].type] : TONES.blue}
        />

        <Text className="mb-2 font-bodyMedium text-xs uppercase text-ink-faint">{t("quick_log_title")}</Text>
        <View className="flex-row" style={{ gap: 10 }}>
          {TYPES.map((type) => (
            <LogTile
              key={type}
              label={t(`diaper_type_${type}` as never)}
              icon={TYPE_ICON[type]}
              tone={TYPE_TONE[type]}
              onPress={() => quickLog(type)}
            />
          ))}
        </View>

        <View className="mt-5" />
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
              <LogRow
                onPress={() => openEdit(entry)}
                onDelete={() => {
                  baby.deleteDiaperEntry(entry.id);
                  showToast(t("deleted_toast"), () => baby.restoreDiaperEntry(entry.id));
                }}
                deleteLabel={t("delete_action")}
                icon={TYPE_ICON[entry.type]}
                tone={TYPE_TONE[entry.type]}
                title={t(`diaper_type_${entry.type}` as never)}
                detail={[entry.color, entry.consistency, formatTime(entry.at, lang)].filter(Boolean).join(" · ")}
              />
            </MotiView>
          ))
        )}
      </ScrollView>

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
              <Text className="font-bodyMedium text-[15px] text-cream">{t("save_action")}</Text>
            </Pressable>
          </View>
        </RecordSheet>
      )}
    </SafeAreaView>
  );
}
