import { useState } from "react";
import { View, Text, ScrollView, Pressable, Switch } from "react-native";
import { router } from "expo-router";
import { MotiView } from "moti";
import { SafeAreaView } from "react-native-safe-area-context";
import { Icon } from "@/components/ui/Icon";
import { RecordSheet } from "@/components/baby/RecordSheet";
import { FormField } from "@/components/baby/FormField";
import { DateTimeField } from "@/components/baby/DateTimeField";
import { useAppState, active } from "@/lib/state/AppStateContext";
import { useToast } from "@/lib/toast/ToastContext";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { haptics } from "@/lib/haptics";
import { formatDate } from "@/lib/dateUtils";
import { shadows } from "@/lib/shadows";
import { VaccineEntry, VaccineStatus } from "@/lib/state/types";

const STATUS_COLOR: Record<VaccineStatus, { bg: string; fg: string }> = {
  done: { bg: "#E7EAD9", fg: "#6E7452" },
  upcoming: { bg: "#F3ECDD", fg: "#6B6154" },
  due_today: { bg: "#F5E1CC", fg: "#C9702E" },
  overdue: { bg: "#FBDCD4", fg: "#DC2626" },
};

type FormShape = {
  name: string;
  description: string;
  dueDate: string;
  givenDate: string | null;
  doctor: string;
  clinic: string;
  batchNumber: string;
  note: string;
  reminderEnabled: boolean;
};
function formFromEntry(e: VaccineEntry): FormShape {
  return {
    name: e.name,
    description: e.description,
    dueDate: e.dueDate,
    givenDate: e.givenDate,
    doctor: e.doctor,
    clinic: e.clinic,
    batchNumber: e.batchNumber,
    note: e.note,
    reminderEnabled: e.reminderEnabled,
  };
}
function emptyForm(): FormShape {
  return {
    name: "",
    description: "",
    dueDate: new Date().toISOString(),
    givenDate: null,
    doctor: "",
    clinic: "",
    batchNumber: "",
    note: "",
    reminderEnabled: true,
  };
}

function computeStatus(v: { dueDate: string; givenDate: string | null }): VaccineStatus {
  if (v.givenDate) return "done";
  const due = new Date(v.dueDate);
  const now = new Date();
  const isSameDay = due.toDateString() === now.toDateString();
  if (isSameDay) return "due_today";
  return due.getTime() < now.getTime() ? "overdue" : "upcoming";
}

export default function VaccinationsScreen() {
  const { t, lang } = useTranslation();
  const { state, baby } = useAppState();
  const { showToast } = useToast();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormShape>(emptyForm());

  const vaccines = active(state.baby.vaccines)
    .map((v) => ({ ...v, status: computeStatus(v) }))
    .sort((a, b) => {
      const order: Record<VaccineStatus, number> = { overdue: 0, due_today: 1, upcoming: 2, done: 3 };
      if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    });

  function openEdit(v: VaccineEntry) {
    haptics.select();
    setForm(formFromEntry(v));
    setEditingId(v.id);
    setSheetOpen(true);
  }
  function openNew() {
    haptics.tap();
    setForm(emptyForm());
    setEditingId(null);
    setSheetOpen(true);
  }
  function closeSheet() {
    if (editingId && form.name.trim()) baby.updateVaccine(editingId, form);
    setSheetOpen(false);
  }
  function save() {
    if (!form.name.trim()) return;
    if (editingId) baby.updateVaccine(editingId, form);
    else baby.addVaccine(form);
    haptics.success();
    setSheetOpen(false);
  }
  function handleDelete() {
    if (!editingId) return;
    const id = editingId;
    baby.deleteVaccine(id);
    showToast(t("deleted_toast"), () => baby.restoreVaccine(id));
  }
  function handleArchive() {
    if (!editingId) return;
    baby.archiveVaccine(editingId);
  }
  function handleDuplicate() {
    if (!editingId) return;
    baby.duplicateVaccine(editingId);
  }
  const editingEntry = editingId ? vaccines.find((v) => v.id === editingId) : null;

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      <View className="flex-row items-center gap-3 px-4 pb-3 pt-2">
        <Pressable onPress={() => router.back()} hitSlop={8} className="h-9 w-9 items-center justify-center">
          <Icon name="chevronLeft" size={20} color="#2C271F" />
        </Pressable>
        <Text className="font-display text-xl text-ink">{t("vaccine_screen_title")}</Text>
      </View>

      <ScrollView className="flex-1 px-5" contentContainerStyle={{ paddingBottom: 24 }}>
        {vaccines.length === 0 ? (
          <View className="items-center gap-2 py-16">
            <Icon name="syringe" size={26} color="#E9DFCC" />
            <Text className="font-body text-sm text-ink-soft">{t("vaccine_empty")}</Text>
          </View>
        ) : (
          vaccines.map((v, i) => {
            const colors = STATUS_COLOR[v.status];
            return (
              <MotiView
                key={v.id}
                from={{ opacity: 0, translateY: 6 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{ type: "timing", duration: 200, delay: Math.min(i, 6) * 25 }}
              >
                <Pressable
                  onPress={() => openEdit(v)}
                  style={shadows.press}
                  className="mb-2.5 flex-row items-center gap-3 rounded-xl2 border border-ink/10 bg-white p-3.5"
                >
                  <View style={{ backgroundColor: colors.bg }} className="h-10 w-10 items-center justify-center rounded-xl">
                    <Icon name="syringe" size={17} color={colors.fg} />
                  </View>
                  <View className="flex-1">
                    <Text className="font-bodySemibold text-[14px] text-ink">{v.name}</Text>
                    <Text className="font-body text-xs text-ink-soft">
                      {v.status === "done" && v.givenDate
                        ? `${t("vaccine_status_done")} · ${formatDate(v.givenDate, lang)}`
                        : `${t(`vaccine_status_${v.status}` as never)} · ${formatDate(v.dueDate, lang)}`}
                    </Text>
                  </View>
                  {v.status !== "done" ? (
                    <Pressable
                      onPress={() => {
                        haptics.success();
                        baby.markVaccineDone(v.id);
                      }}
                      className="rounded-full bg-ink px-3 py-1.5"
                    >
                      <Text className="font-bodyMedium text-[11px] text-cream">{t("vaccine_mark_done")}</Text>
                    </Pressable>
                  ) : (
                    <Icon name="check" size={16} color="#6E7452" />
                  )}
                </Pressable>
              </MotiView>
            );
          })
        )}
      </ScrollView>

      <View className="px-5 pb-6">
        <Pressable onPress={openNew} className="flex-row items-center justify-center gap-2 rounded-2xl bg-ink py-4">
          <Icon name="plus" size={16} color="#FBF6EE" />
          <Text className="font-bodyMedium text-[15px] text-cream">{t("vaccine_add")}</Text>
        </Pressable>
      </View>

      <RecordSheet
        visible={sheetOpen}
        onClose={closeSheet}
        title={t("vaccine_edit_title")}
        isNew={!editingId}
        onDuplicate={editingId ? handleDuplicate : undefined}
        onArchive={editingId ? handleArchive : undefined}
        onDelete={handleDelete}
        lifecycle={editingEntry ?? undefined}
        shareText={editingId ? `${form.name} · ${formatDate(form.dueDate, lang)}` : undefined}
      >
        <View className="gap-4">
          <FormField label={t("vaccine_name_ph")} value={form.name} onChangeText={(v) => setForm((f) => ({ ...f, name: v }))} />
          <FormField label={t("note_field")} placeholder={t("note_ph")} value={form.description} onChangeText={(v) => setForm((f) => ({ ...f, description: v }))} multiline />
          <DateTimeField label={t("vaccine_due_ph")} mode="date" value={form.dueDate} onChange={(iso) => setForm((f) => ({ ...f, dueDate: iso }))} />
          <FormField label={t("vaccine_doctor_ph")} value={form.doctor} onChangeText={(v) => setForm((f) => ({ ...f, doctor: v }))} />
          <FormField label={t("vaccine_clinic_ph")} value={form.clinic} onChangeText={(v) => setForm((f) => ({ ...f, clinic: v }))} />
          <FormField label={t("vaccine_batch_ph")} value={form.batchNumber} onChangeText={(v) => setForm((f) => ({ ...f, batchNumber: v }))} />
          <View className="flex-row items-center justify-between rounded-2xl border border-ink/10 bg-white px-4 py-3.5">
            <Text className="font-bodyMedium text-[13.5px] text-ink">{t("vaccine_reminder")}</Text>
            <Switch
              value={form.reminderEnabled}
              onValueChange={(v) => setForm((f) => ({ ...f, reminderEnabled: v }))}
              trackColor={{ true: "#6E7452", false: "#E9DFCC" }}
            />
          </View>
          <Pressable onPress={save} className="mt-1 items-center rounded-2xl bg-ink py-4">
            <Text className="font-bodyMedium text-[15px] text-cream">{editingId ? t("save_action") : t("add_action")}</Text>
          </Pressable>
        </View>
      </RecordSheet>
    </SafeAreaView>
  );
}
