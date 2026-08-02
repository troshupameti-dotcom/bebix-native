import { useMemo, useState } from "react";
import { View, Text, ScrollView, Pressable, Dimensions } from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Path, Circle, Line as SvgLine } from "react-native-svg";
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
import { GrowthHistoryEntry } from "@/lib/state/types";

type Metric = "weight" | "height";
const CHART_WIDTH = Dimensions.get("window").width - 40;
const CHART_HEIGHT = 160;

type FormShape = { date: string; weightKg: string; heightCm: string; headCm: string; note: string };
function formFromEntry(e: GrowthHistoryEntry): FormShape {
  return {
    date: e.date,
    weightKg: e.weightKg != null ? String(e.weightKg) : "",
    heightCm: e.heightCm != null ? String(e.heightCm) : "",
    headCm: e.headCm != null ? String(e.headCm) : "",
    note: e.note,
  };
}
function emptyForm(): FormShape {
  return { date: new Date().toISOString(), weightKg: "", heightCm: "", headCm: "", note: "" };
}

export default function GrowthScreen() {
  const { t, lang } = useTranslation();
  const { state, baby } = useAppState();
  const { showToast } = useToast();
  const [metric, setMetric] = useState<Metric>("weight");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormShape>(emptyForm());

  const history = active(state.baby.growthHistory).sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const values = useMemo(
    () =>
      history
        .map((h) => (metric === "weight" ? h.weightKg : h.heightCm))
        .filter((v): v is number => typeof v === "number"),
    [history, metric]
  );

  const { path, bandTop, bandBottom } = useMemo(() => {
    if (values.length < 2) return { path: "", bandTop: "", bandBottom: "" };
    const min = Math.min(...values) * 0.85;
    const max = Math.max(...values) * 1.15;
    const range = max - min || 1;
    const stepX = CHART_WIDTH / (values.length - 1);
    const toXY = (v: number, i: number) => {
      const x = i * stepX;
      const y = CHART_HEIGHT - ((v - min) / range) * CHART_HEIGHT;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    };
    const mainPath = values.map((v, i) => `${i === 0 ? "M" : "L"}${toXY(v, i)}`).join(" ");
    // Simplified visual reference band (±15%) — NOT real WHO LMS percentile data.
    const topPath = values.map((v, i) => `${i === 0 ? "M" : "L"}${toXY(v * 1.12, i)}`).join(" ");
    const bottomPath = values.map((v, i) => `${i === 0 ? "M" : "L"}${toXY(v * 0.88, i)}`).join(" ");
    return { path: mainPath, bandTop: topPath, bandBottom: bottomPath };
  }, [values]);

  function openEdit(entry: GrowthHistoryEntry) {
    haptics.select();
    setForm(formFromEntry(entry));
    setEditingId(entry.id);
    setSheetOpen(true);
  }
  function openNew() {
    haptics.tap();
    setForm(emptyForm());
    setEditingId(null);
    setSheetOpen(true);
  }
  function closeSheet() {
    if (editingId) baby.updateGrowthHistoryEntry(editingId, computePatch());
    setSheetOpen(false);
  }
  function computePatch() {
    return {
      date: form.date,
      weightKg: form.weightKg ? parseFloat(form.weightKg.replace(",", ".")) : null,
      heightCm: form.heightCm ? parseFloat(form.heightCm.replace(",", ".")) : null,
      headCm: form.headCm ? parseFloat(form.headCm.replace(",", ".")) : null,
      note: form.note,
    };
  }
  function save() {
    if (editingId) baby.updateGrowthHistoryEntry(editingId, computePatch());
    else baby.addGrowthHistoryEntry(computePatch());
    haptics.success();
    setSheetOpen(false);
  }
  function handleDelete() {
    if (!editingId) return;
    const id = editingId;
    baby.deleteGrowthHistoryEntry(id);
    showToast(t("deleted_toast"), () => baby.restoreGrowthHistoryEntry(id));
  }
  function handleArchive() {
    if (!editingId) return;
    baby.archiveGrowthHistoryEntry(editingId);
  }
  function handleDuplicate() {
    if (!editingId) return;
    baby.duplicateGrowthHistoryEntry(editingId);
  }
  const editingEntry = editingId ? history.find((e) => e.id === editingId) : null;

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      <View className="flex-row items-center gap-3 px-4 pb-3 pt-2">
        <Pressable onPress={() => router.back()} hitSlop={8} className="h-9 w-9 items-center justify-center">
          <Icon name="chevronLeft" size={20} color="#2C271F" />
        </Pressable>
        <Text className="font-display text-xl text-ink">{t("growth_screen_title")}</Text>
      </View>

      <View className="mx-5 mb-4 flex-row rounded-2xl bg-cream-soft p-1">
        {(["weight", "height"] as Metric[]).map((m) => (
          <Pressable
            key={m}
            onPress={() => setMetric(m)}
            className="flex-1 items-center rounded-xl py-2.5"
            style={metric === m ? [shadows.press, { backgroundColor: "#fff" }] : undefined}
          >
            <Text className={`font-bodySemibold text-[12.5px] ${metric === m ? "text-ink" : "text-ink-faint"}`}>
              {t(m === "weight" ? "growth_weight" : "growth_height")}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView className="flex-1 px-5" contentContainerStyle={{ paddingBottom: 24 }}>
        <View style={shadows.soft} className="items-center rounded-xl3 border border-ink/10 bg-white p-4">
          {values.length >= 2 ? (
            <>
              <Svg width={CHART_WIDTH} height={CHART_HEIGHT + 20}>
                <SvgLine x1={0} y1={CHART_HEIGHT} x2={CHART_WIDTH} y2={CHART_HEIGHT} stroke="#E9DFCC" strokeWidth={1} />
                <Path d={bandTop} stroke="#E9DFCC" strokeWidth={1.5} fill="none" strokeDasharray="4,4" />
                <Path d={bandBottom} stroke="#E9DFCC" strokeWidth={1.5} fill="none" strokeDasharray="4,4" />
                <Path d={path} stroke="#6E7452" strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                {values.map((v, i) => {
                  const min = Math.min(...values) * 0.85;
                  const max = Math.max(...values) * 1.15;
                  const range = max - min || 1;
                  const stepX = CHART_WIDTH / (values.length - 1);
                  const x = i * stepX;
                  const y = CHART_HEIGHT - ((v - min) / range) * CHART_HEIGHT;
                  return <Circle key={i} cx={x} cy={y} r={4} fill="#6E7452" />;
                })}
              </Svg>
              <Text className="mt-2 font-body text-[10.5px] text-ink-faint">{t("growth_percentile_note")}</Text>
            </>
          ) : (
            <View className="h-[160px] items-center justify-center">
              <Text className="font-body text-sm text-ink-soft">{t("growth_add_measurement")}</Text>
            </View>
          )}
        </View>

        <Text className="mb-2 mt-6 font-display text-base text-ink">{t("baby_growth_summary")}</Text>
        {[...history].reverse().map((h) => {
          const bmi = h.weightKg && h.heightCm ? (h.weightKg / (h.heightCm / 100) ** 2).toFixed(1) : null;
          return (
            <Pressable
              key={h.id}
              onPress={() => openEdit(h)}
              className="flex-row items-center justify-between border-b border-ink/8 py-3"
            >
              <Text className="font-body text-[13.5px] text-ink-soft">{formatDate(h.date, lang)}</Text>
              <View className="flex-row items-center gap-2">
                <Text className="font-bodySemibold text-[13.5px] text-ink">
                  {h.weightKg ? `${h.weightKg} kg` : ""}
                  {h.weightKg && h.heightCm ? " · " : ""}
                  {h.heightCm ? `${h.heightCm} cm` : ""}
                  {bmi ? ` · ${t("growth_bmi")} ${bmi}` : ""}
                </Text>
                <Icon name="chevronRight" size={14} color="#A79D8A" />
              </View>
            </Pressable>
          );
        })}
      </ScrollView>

      <View className="px-5 pb-6">
        <Pressable onPress={openNew} className="flex-row items-center justify-center gap-2 rounded-2xl bg-ink py-4">
          <Icon name="plus" size={16} color="#FBF6EE" />
          <Text className="font-bodySemibold text-[15px] text-cream">{t("growth_add_measurement")}</Text>
        </Pressable>
      </View>

      <RecordSheet
        visible={sheetOpen}
        onClose={closeSheet}
        title={t("growth_edit_title")}
        isNew={!editingId}
        onDuplicate={editingId ? handleDuplicate : undefined}
        onArchive={editingId ? handleArchive : undefined}
        onDelete={handleDelete}
        lifecycle={editingEntry ?? undefined}
        shareText={editingId ? `${form.weightKg ? form.weightKg + " kg" : ""} ${form.heightCm ? form.heightCm + " cm" : ""}`.trim() : undefined}
      >
        <View className="gap-4">
          <DateTimeField label={t("date_field")} mode="date" value={form.date} onChange={(iso) => setForm((f) => ({ ...f, date: iso }))} />
          <FormField label={t("growth_weight_ph")} keyboardType="decimal-pad" value={form.weightKg} onChangeText={(v) => setForm((f) => ({ ...f, weightKg: v }))} />
          <FormField label={t("growth_height_ph")} keyboardType="decimal-pad" value={form.heightCm} onChangeText={(v) => setForm((f) => ({ ...f, heightCm: v }))} />
          <FormField label={t("growth_head")} keyboardType="decimal-pad" value={form.headCm} onChangeText={(v) => setForm((f) => ({ ...f, headCm: v }))} />
          <FormField label={t("note_field")} placeholder={t("growth_note_ph")} value={form.note} onChangeText={(v) => setForm((f) => ({ ...f, note: v }))} multiline />
          <Pressable onPress={save} className="mt-1 items-center rounded-2xl bg-ink py-4">
            <Text className="font-bodySemibold text-[15px] text-cream">{editingId ? t("save_action") : t("add_action")}</Text>
          </Pressable>
        </View>
      </RecordSheet>
    </SafeAreaView>
  );
}
