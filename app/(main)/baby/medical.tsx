import { useState } from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { router } from "expo-router";
import { MotiView } from "moti";
import { SafeAreaView } from "react-native-safe-area-context";
import { Icon, IconName } from "@/components/ui/Icon";
import { RecordSheet } from "@/components/baby/RecordSheet";
import { FormField } from "@/components/baby/FormField";
import { SegmentedField } from "@/components/baby/SegmentedField";
import { DateTimeField } from "@/components/baby/DateTimeField";
import { useAppState, active } from "@/lib/state/AppStateContext";
import { useToast } from "@/lib/toast/ToastContext";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { haptics } from "@/lib/haptics";
import { formatDate } from "@/lib/dateUtils";
import { shadows } from "@/lib/shadows";
import { MedicalRecord, MedicalRecordType } from "@/lib/state/types";

const TYPES: MedicalRecordType[] = ["symptom", "temperature", "medication", "doctor_visit", "prescription", "document"];
const TYPE_ICON: Record<MedicalRecordType, IconName> = {
  symptom: "sparkle",
  temperature: "flame",
  medication: "pill",
  doctor_visit: "shield",
  prescription: "edit",
  document: "download",
};

type FormShape = { type: MedicalRecordType; title: string; value: string; doctor: string; at: string; note: string };
function formFromRecord(m: MedicalRecord): FormShape {
  return { type: m.type, title: m.title, value: m.value, doctor: m.doctor, at: m.at, note: m.note };
}
function emptyForm(): FormShape {
  return { type: "symptom", title: "", value: "", doctor: "", at: new Date().toISOString(), note: "" };
}

export default function MedicalScreen() {
  const { t, lang } = useTranslation();
  const { state, baby } = useAppState();
  const { showToast } = useToast();
  const records = active(state.baby.medicalRecords).sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return new Date(b.at).getTime() - new Date(a.at).getTime();
  });

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormShape>(emptyForm());

  function openEdit(m: MedicalRecord) {
    haptics.select();
    setForm(formFromRecord(m));
    setEditingId(m.id);
    setSheetOpen(true);
  }
  function openNew() {
    haptics.tap();
    setForm(emptyForm());
    setEditingId(null);
    setSheetOpen(true);
  }
  function closeSheet() {
    if (editingId && form.title.trim()) baby.updateMedicalRecord(editingId, form);
    setSheetOpen(false);
  }
  function save() {
    if (!form.title.trim()) return;
    if (editingId) baby.updateMedicalRecord(editingId, form);
    else baby.addMedicalRecord(form);
    haptics.success();
    setSheetOpen(false);
  }
  function handleDelete() {
    if (!editingId) return;
    const id = editingId;
    baby.deleteMedicalRecord(id);
    showToast(t("deleted_toast"), () => baby.restoreMedicalRecord(id));
  }
  function handleArchive() {
    if (!editingId) return;
    baby.archiveMedicalRecord(editingId);
  }
  function handleDuplicate() {
    if (!editingId) return;
    baby.duplicateMedicalRecord(editingId);
  }
  const editingEntry = editingId ? records.find((m) => m.id === editingId) : null;

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      <View className="flex-row items-center gap-3 px-4 pb-3 pt-2">
        <Pressable onPress={() => router.back()} hitSlop={8} className="h-9 w-9 items-center justify-center">
          <Icon name="chevronLeft" size={20} color="#2C271F" />
        </Pressable>
        <Text className="font-display text-xl text-ink">{t("medical_screen_title")}</Text>
      </View>

      <ScrollView className="flex-1 px-5" contentContainerStyle={{ paddingBottom: 24 }}>
        {records.length === 0 ? (
          <View className="items-center gap-2 py-16">
            <Icon name="shield" size={26} color="#E9DFCC" />
            <Text className="font-body text-sm text-ink-soft">{t("medical_empty")}</Text>
          </View>
        ) : (
          records.map((m, i) => (
            <MotiView
              key={m.id}
              from={{ opacity: 0, translateX: -8 }}
              animate={{ opacity: 1, translateX: 0 }}
              transition={{ type: "timing", duration: 200, delay: Math.min(i, 6) * 25 }}
            >
              <Pressable
                onPress={() => openEdit(m)}
                style={shadows.press}
                className="mb-2.5 flex-row items-center gap-3 rounded-xl2 border border-ink/10 bg-white p-3.5"
              >
                <View className="h-10 w-10 items-center justify-center rounded-xl bg-olive-bg">
                  <Icon name={TYPE_ICON[m.type]} size={17} color="#6E7452" />
                </View>
                <View className="flex-1">
                  <Text className="font-bodySemibold text-[14px] text-ink">{m.title}</Text>
                  <Text className="font-body text-xs text-ink-soft" numberOfLines={1}>
                    {[m.value, m.doctor].filter(Boolean).join(" · ")} {m.value || m.doctor ? "· " : ""}
                    {formatDate(m.at, lang)}
                  </Text>
                </View>
                {m.pinned && <Icon name="heart" size={13} color="#C9702E" />}
                <Icon name="chevronRight" size={16} color="#A79D8A" />
              </Pressable>
            </MotiView>
          ))
        )}
      </ScrollView>

      <View className="px-5 pb-6">
        <Pressable onPress={openNew} className="flex-row items-center justify-center gap-2 rounded-2xl bg-ink py-4">
          <Icon name="plus" size={16} color="#FBF6EE" />
          <Text className="font-bodyMedium text-[15px] text-cream">{t("medical_add")}</Text>
        </Pressable>
      </View>

      <RecordSheet
        visible={sheetOpen}
        onClose={closeSheet}
        title={editingId ? t("view_details") : t("medical_add")}
        isNew={!editingId}
        onDuplicate={editingId ? handleDuplicate : undefined}
        onArchive={editingId ? handleArchive : undefined}
        onTogglePin={editingId ? () => baby.togglePinMedicalRecord(editingId) : undefined}
        pinned={editingEntry?.pinned}
        onDelete={handleDelete}
        lifecycle={editingEntry ?? undefined}
        shareText={editingId ? `${form.title} · ${form.value}`.trim() : undefined}
      >
        <View className="gap-4">
          <SegmentedField
            options={TYPES.map((ty) => ({ value: ty, label: t(`medical_type_${ty}` as never), icon: TYPE_ICON[ty] }))}
            value={form.type}
            onChange={(v) => setForm((f) => ({ ...f, type: v }))}
          />
          <FormField label={t("label_field")} value={form.title} onChangeText={(v) => setForm((f) => ({ ...f, title: v }))} />
          <FormField label={t("medical_value_ph")} value={form.value} onChangeText={(v) => setForm((f) => ({ ...f, value: v }))} />
          <FormField label={t("medical_doctor_ph")} value={form.doctor} onChangeText={(v) => setForm((f) => ({ ...f, doctor: v }))} />
          <DateTimeField label={t("date_field")} mode="date" value={form.at} onChange={(iso) => setForm((f) => ({ ...f, at: iso }))} />
          <FormField label={t("note_field")} placeholder={t("note_ph")} value={form.note} onChangeText={(v) => setForm((f) => ({ ...f, note: v }))} multiline />
          <Pressable onPress={save} className="mt-1 items-center rounded-2xl bg-ink py-4">
            <Text className="font-bodyMedium text-[15px] text-cream">{editingId ? t("save_action") : t("add_action")}</Text>
          </Pressable>
        </View>
      </RecordSheet>
    </SafeAreaView>
  );
}
