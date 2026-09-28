import { useMemo, useState } from "react";
import { View, Text, ScrollView, Pressable, Dimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Path, Circle, Defs, LinearGradient, Stop, Line as SvgLine } from "react-native-svg";
import { Icon } from "@/components/ui/Icon";
import { RecordSheet } from "@/components/baby/RecordSheet";
import { FormField } from "@/components/baby/FormField";
import { DateTimeField } from "@/components/baby/DateTimeField";
import { TONES, type Tone } from "@/components/baby/LogTiles";
import { useAppState, active } from "@/lib/state/AppStateContext";
import { useToast } from "@/lib/toast/ToastContext";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { haptics } from "@/lib/haptics";
import { formatDate } from "@/lib/dateUtils";
import { shadows } from "@/lib/shadows";
import { GrowthHistoryEntry } from "@/lib/state/types";
import { BackButton } from "@/components/ui/BackButton";
import { buildSeries, metricHistory, type GrowthMetric } from "@/lib/baby/growthChart";

/** Kartela ka 20 px anash dhe 20 px mbushje: grafiku zë pjesën e mbetur. */
const CHART_WIDTH = Dimensions.get("window").width - 80;
const CHART_HEIGHT = 170;

/** Pesha në ngjyrën e kartës së peshës, gjatësia në atë të gjatësisë. */
const METRIC: Record<GrowthMetric, { unit: string; labelKey: "growth_weight" | "growth_height"; tone: Tone; icon: "cube" | "chart" }> = {
  weight: { unit: "kg", labelKey: "growth_weight", tone: TONES.orange, icon: "cube" },
  height: { unit: "cm", labelKey: "growth_height", tone: TONES.blue, icon: "chart" },
};

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

/** 5.9 → "5.9", 61 → "61". */
function fmt(n: number): string {
  return String(Math.round(n * 100) / 100);
}

export default function GrowthScreen() {
  const { t, lang } = useTranslation();
  const { state, baby } = useAppState();
  const { showToast } = useToast();
  const [metric, setMetric] = useState<GrowthMetric>("weight");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormShape>(emptyForm());

  const allHistory = useMemo(() => active(state.baby.growthHistory), [state.baby.growthHistory]);
  const cfg = METRIC[metric];
  const series = useMemo(() => buildSeries(allHistory, metric, CHART_WIDTH, CHART_HEIGHT), [allHistory, metric]);
  const items = useMemo(() => metricHistory(allHistory, metric), [allHistory, metric]);
  const last = items[items.length - 1] ?? null;
  const prev = items[items.length - 2] ?? null;
  const delta = last && prev ? Math.round((last.value - prev.value) * 100) / 100 : null;

  function openEdit(id: string) {
    const entry = allHistory.find((e) => e.id === id);
    if (!entry) return;
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
  const editingEntry = editingId ? allHistory.find((e) => e.id === editingId) : null;

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      <View className="flex-row items-center gap-3 px-4 pb-3 pt-2">
        <BackButton fallback="/(main)/baby" />
        <Text className="font-display text-xl text-ink">{t("growth_screen_title")}</Text>
      </View>

      {/* Zgjedhësi: secila madhësi me ngjyrën e vet. */}
      <View className="mx-5 mb-4 flex-row" style={{ gap: 10 }}>
        {(["weight", "height"] as GrowthMetric[]).map((m) => {
          const on = metric === m;
          const { tone, icon, labelKey } = METRIC[m];
          return (
            <Pressable
              key={m}
              onPress={() => {
                haptics.select();
                setMetric(m);
              }}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              className="flex-1 flex-row items-center justify-center gap-2 rounded-2xl py-3"
              style={{ backgroundColor: on ? tone.tint : tone.tintBg }}
            >
              <Icon name={icon} size={15} color={on ? "#FFFFFF" : tone.tint} />
              <Text className="font-bodySemibold text-[14px]" style={{ color: on ? "#FFFFFF" : tone.tint }}>
                {t(labelKey)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <ScrollView className="flex-1 px-5" contentContainerStyle={{ paddingBottom: 24 }}>
        {/* Vlera e fundit dhe grafiku, gjithmonë të dukshëm. */}
        <View style={shadows.soft} className="mb-5 rounded-xl3 border border-ink/10 bg-surface p-5">
          {last ? (
            <>
              <View className="flex-row items-end justify-between">
                <View>
                  <Text className="font-bodyMedium text-[12.5px] text-ink-soft">{t(cfg.labelKey)}</Text>
                  <View className="mt-1 flex-row items-baseline gap-1">
                    <Text className="font-display text-[36px] leading-[42px] text-ink">{fmt(last.value)}</Text>
                    <Text className="font-bodyMedium text-[15px] text-ink-soft">{cfg.unit}</Text>
                  </View>
                  <Text className="font-body text-[12px] text-ink-soft">{formatDate(last.date, lang)}</Text>
                </View>
                {delta !== null && delta !== 0 ? (
                  <View className="rounded-full px-3 py-1" style={{ backgroundColor: cfg.tone.tintBg }}>
                    <Text className="font-bodySemibold text-[12.5px]" style={{ color: cfg.tone.tint }}>
                      {delta > 0 ? "+" : "−"}
                      {fmt(Math.abs(delta))} {cfg.unit}
                    </Text>
                  </View>
                ) : null}
              </View>

              <View className="mt-4">
                <Svg width={CHART_WIDTH} height={CHART_HEIGHT}>
                  <Defs>
                    <LinearGradient id="growthFill" x1="0" y1="0" x2="0" y2="1">
                      <Stop offset="0" stopColor={cfg.tone.tint} stopOpacity={0.28} />
                      <Stop offset="1" stopColor={cfg.tone.tint} stopOpacity={0} />
                    </LinearGradient>
                  </Defs>
                  {[0.25, 0.5, 0.75].map((f) => (
                    <SvgLine key={f} x1={0} x2={CHART_WIDTH} y1={CHART_HEIGHT * f} y2={CHART_HEIGHT * f} stroke="#E9DFCC" strokeWidth={1} strokeDasharray="3,5" />
                  ))}
                  {series.area ? <Path d={series.area} fill="url(#growthFill)" /> : null}
                  {series.points.length > 1 ? (
                    <Path d={series.line} stroke={cfg.tone.tint} strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                  ) : null}
                  {series.points.map((p, i) => {
                    const isLast = i === series.points.length - 1;
                    return (
                      <Circle
                        key={p.id}
                        cx={p.x}
                        cy={p.y}
                        r={isLast ? 6 : 4}
                        fill={isLast ? cfg.tone.tint : "#FFFFFF"}
                        stroke={cfg.tone.tint}
                        strokeWidth={2.5}
                      />
                    );
                  })}
                </Svg>
                {items.length > 1 ? (
                  <View className="mt-1 flex-row justify-between">
                    <Text className="font-body text-[11px] text-ink-faint">{formatDate(items[0].date, lang)}</Text>
                    <Text className="font-body text-[11px] text-ink-faint">{formatDate(last.date, lang)}</Text>
                  </View>
                ) : (
                  <Text className="mt-1 text-center font-body text-[12px] text-ink-soft">{t("growth_one_more")}</Text>
                )}
              </View>
            </>
          ) : (
            <View className="items-center gap-2 py-10">
              <Icon name={cfg.icon} size={26} color={cfg.tone.tint} />
              <Text className="text-center font-body text-sm text-ink-soft">{t("growth_empty_metric")}</Text>
            </View>
          )}
        </View>

        {/* Historiku i madhësisë së zgjedhur, më e reja lart. */}
        {items.length > 0 && (
          <>
            <Text className="mb-2 font-bodySemibold text-base text-ink">{t("growth_history_title")}</Text>
            <View style={shadows.soft} className="overflow-hidden rounded-xl3 border border-ink/10 bg-surface">
              {[...items].reverse().map((item, i, arr) => {
                const before = arr[i + 1];
                const d = before ? Math.round((item.value - before.value) * 100) / 100 : null;
                return (
                  <Pressable
                    key={item.id}
                    onPress={() => openEdit(item.id)}
                    className={`flex-row items-center px-4 py-3.5 ${i < arr.length - 1 ? "border-b border-ink/8" : ""}`}
                  >
                    <View className="mr-3 h-2.5 w-2.5 rounded-full" style={{ backgroundColor: cfg.tone.tint }} />
                    <Text className="flex-1 font-body text-[13.5px] text-ink-soft">{formatDate(item.date, lang)}</Text>
                    {d !== null && d !== 0 ? (
                      <Text className="mr-3 font-bodyMedium text-[12px]" style={{ color: cfg.tone.tint }}>
                        {d > 0 ? "+" : "−"}
                        {fmt(Math.abs(d))}
                      </Text>
                    ) : null}
                    <Text className="font-bodySemibold text-[15px] text-ink">
                      {fmt(item.value)} {cfg.unit}
                    </Text>
                    <Icon name="chevronRight" size={14} color="#A79D8A" />
                  </Pressable>
                );
              })}
            </View>
          </>
        )}
      </ScrollView>

      <View className="px-5 pb-6">
        <Pressable onPress={openNew} className="flex-row items-center justify-center gap-2 rounded-2xl bg-ink py-4">
          <Icon name="plus" size={16} color="#FBF6EE" />
          <Text className="font-bodyMedium text-[15px] text-cream">{t("growth_add_measurement")}</Text>
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
          <View className="flex-row gap-3">
            <View className="flex-1">
              <FormField label={t("growth_weight_ph")} keyboardType="decimal-pad" value={form.weightKg} onChangeText={(v) => setForm((f) => ({ ...f, weightKg: v }))} />
            </View>
            <View className="flex-1">
              <FormField label={t("growth_height_ph")} keyboardType="decimal-pad" value={form.heightCm} onChangeText={(v) => setForm((f) => ({ ...f, heightCm: v }))} />
            </View>
          </View>
          <FormField label={t("growth_head")} keyboardType="decimal-pad" value={form.headCm} onChangeText={(v) => setForm((f) => ({ ...f, headCm: v }))} />
          <FormField label={t("note_field")} placeholder={t("growth_note_ph")} value={form.note} onChangeText={(v) => setForm((f) => ({ ...f, note: v }))} multiline />
          <Pressable onPress={save} className="mt-1 items-center rounded-2xl bg-ink py-4">
            <Text className="font-bodyMedium text-[15px] text-cream">{editingId ? t("save_action") : t("add_action")}</Text>
          </Pressable>
        </View>
      </RecordSheet>
    </SafeAreaView>
  );
}
