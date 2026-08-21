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
import { useAppState } from "@/lib/state/AppStateContext";
import { active } from "@/lib/state/AppStateContext";
import { useToast } from "@/lib/toast/ToastContext";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { haptics } from "@/lib/haptics";
import { formatTime } from "@/lib/dateUtils";
import { shadows } from "@/lib/shadows";
import { FeedingEntry, FeedingType, BreastSide } from "@/lib/state/types";

const TYPES: FeedingType[] = ["breast", "bottle", "formula", "solid", "water", "medicine"];
const TYPE_ICON: Record<FeedingType, "droplet" | "bath" | "spoon" | "pill"> = {
  breast: "droplet",
  bottle: "bath",
  formula: "bath",
  solid: "spoon",
  water: "droplet",
  medicine: "pill",
};

type FormShape = {
  type: FeedingType;
  amountMl: string;
  durationMin: string;
  side: BreastSide;
  foodCategory: string;
  at: string;
  note: string;
};

function emptyForm(): FormShape {
  return { type: "bottle", amountMl: "", durationMin: "", side: null, foodCategory: "", at: new Date().toISOString(), note: "" };
}
function formFromEntry(e: FeedingEntry): FormShape {
  return {
    type: e.type,
    amountMl: e.amountMl != null ? String(e.amountMl) : "",
    durationMin: e.durationMin != null ? String(e.durationMin) : "",
    side: e.side,
    foodCategory: e.foodCategory ?? "",
    at: e.at,
    note: e.note,
  };
}

export default function FeedingScreen() {
  const { t, lang } = useTranslation();
  const { state, baby } = useAppState();
  const { showToast } = useToast();
  const log = active(state.baby.feedingLog).sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormShape>(emptyForm());

  const stats = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfWeek = now.getTime() - 6 * 86400000;
    const today = log.filter((e) => new Date(e.at).getTime() >= startOfToday);
    const thisWeek = log.filter((e) => new Date(e.at).getTime() >= startOfWeek);

    let avgIntervalText = "–";
    if (today.length >= 2) {
      const sorted = [...today].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
      let totalMin = 0;
      for (let i = 1; i < sorted.length; i++) {
        totalMin += (new Date(sorted[i].at).getTime() - new Date(sorted[i - 1].at).getTime()) / 60000;
      }
      const avg = Math.round(totalMin / (sorted.length - 1));
      const h = Math.floor(avg / 60);
      const m = avg % 60;
      avgIntervalText = h > 0 ? `${h}h${m > 0 ? ` ${m}m` : ""}` : `${m}m`;
    }

    return {
      today: today.length,
      week: thisWeek.length,
      avgInterval: avgIntervalText,
    };
  }, [log]);

  function openNew() {
    haptics.tap();
    setForm(emptyForm());
    setEditingId(null);
    setSheetOpen(true);
  }
  function openEdit(entry: FeedingEntry) {
    haptics.select();
    setForm(formFromEntry(entry));
    setEditingId(entry.id);
    setSheetOpen(true);
  }
  function closeSheet() {
    if (editingId) baby.updateFeedingEntry(editingId, computePatch());
    setSheetOpen(false);
  }

  function computePatch() {
    return {
      type: form.type,
      amountMl: form.amountMl ? Number(form.amountMl) : null,
      durationMin: form.durationMin ? Number(form.durationMin) : null,
      side: form.side,
      foodCategory: form.foodCategory || null,
      at: form.at,
      note: form.note,
    };
  }

  function save() {
    if (editingId) baby.updateFeedingEntry(editingId, computePatch());
    else baby.addFeedingEntry(computePatch());
    haptics.success();
    setSheetOpen(false);
  }

  function handleDelete() {
    if (!editingId) return;
    const id = editingId;
    baby.deleteFeedingEntry(id);
    showToast(t("deleted_toast"), () => baby.restoreFeedingEntry(id));
  }

  function handleArchive() {
    if (!editingId) return;
    baby.archiveFeedingEntry(editingId);
  }

  function handleDuplicate() {
    if (!editingId) return;
    baby.duplicateFeedingEntry(editingId);
  }

  const editingEntry = editingId ? log.find((e) => e.id === editingId) : null;

  const needsAmount = form.type === "bottle" || form.type === "formula" || form.type === "water" || form.type === "medicine";
  const needsSide = form.type === "breast";
  const needsFood = form.type === "solid";

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      <View className="flex-row items-center gap-3 px-4 pb-3 pt-2">
        <Pressable onPress={() => router.back()} hitSlop={8} className="h-9 w-9 items-center justify-center">
          <Icon name="chevronLeft" size={20} color="#2C271F" />
        </Pressable>
        <Text className="font-display text-xl text-ink">{t("feeding_screen_title")}</Text>
      </View>

      <ScrollView className="flex-1 px-5" contentContainerStyle={{ paddingBottom: 24 }}>
        <StatsRow
          stats={[
            { label: t("feeding_stats_today"), value: String(stats.today) },
            { label: t("feeding_stats_week"), value: String(stats.week) },
            { label: t("feeding_stats_avg_interval"), value: stats.avgInterval },
          ]}
        />

        {log.length === 0 ? (
          <EmptyState text={t("feeding_empty")} />
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
                className="mb-2.5 flex-row items-center gap-3 rounded-xl2 border border-ink/10 bg-white p-3.5 active:opacity-80"
              >
                <View className="h-10 w-10 items-center justify-center rounded-xl bg-orange-bg">
                  <Icon name={TYPE_ICON[entry.type]} size={17} color="#C9702E" />
                </View>
                <View className="flex-1">
                  <Text className="font-bodySemibold text-[14px] text-ink">
                    {t(`feeding_type_${entry.type === "medicine" ? "medicine_short" : entry.type}` as never)}
                  </Text>
                  <Text className="font-body text-xs text-ink-soft" numberOfLines={1}>
                    {[
                      entry.amountMl ? `${entry.amountMl} ml` : null,
                      entry.durationMin ? `${entry.durationMin} min` : null,
                      entry.side ? t(`feeding_side_${entry.side}` as never) : null,
                      entry.foodCategory,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                    {" · "}
                    {formatTime(entry.at, lang)}
                  </Text>
                </View>
                <Icon name="chevronRight" size={16} color="#A79D8A" />
              </Pressable>
            </MotiView>
          ))
        )}
      </ScrollView>

      <View className="px-5 pb-6">
        <Pressable onPress={openNew} className="flex-row items-center justify-center gap-2 rounded-2xl bg-ink py-4">
          <Icon name="plus" size={16} color="#FBF6EE" />
          <Text className="font-bodyMedium text-[15px] text-cream">{t("feeding_add")}</Text>
        </Pressable>
      </View>

      <RecordSheet
        visible={sheetOpen}
        onClose={closeSheet}
        title={t("feeding_edit_title")}
        isNew={!editingId}
        onDuplicate={editingId ? handleDuplicate : undefined}
        onArchive={editingId ? handleArchive : undefined}
        onDelete={handleDelete}
        lifecycle={editingEntry ?? undefined}
        shareText={
          editingId
            ? `${t(`feeding_type_${form.type === "medicine" ? "medicine_short" : form.type}` as never)} · ${formatTime(form.at, lang)}`
            : undefined
        }
      >
        <View className="gap-4">
          <SegmentedField
            label={t("feeding_screen_title")}
            options={TYPES.map((ty) => ({
              value: ty,
              label: t(`feeding_type_${ty === "medicine" ? "medicine_short" : ty}` as never),
              icon: TYPE_ICON[ty],
            }))}
            value={form.type}
            onChange={(v) => setForm((f) => ({ ...f, type: v }))}
          />

          {needsSide && (
            <SegmentedField
              label={t("feeding_side")}
              options={(["left", "right", "both"] as BreastSide[]).map((s) => ({
                value: s as string,
                label: t(`feeding_side_${s}` as never),
              }))}
              value={form.side ?? "left"}
              onChange={(v) => setForm((f) => ({ ...f, side: v as BreastSide }))}
            />
          )}
          {needsSide && (
            <FormField
              label={t("feeding_duration_ph")}
              keyboardType="number-pad"
              value={form.durationMin}
              onChangeText={(v) => setForm((f) => ({ ...f, durationMin: v }))}
            />
          )}
          {needsAmount && (
            <FormField
              label={t("feeding_amount_ml_ph")}
              keyboardType="number-pad"
              value={form.amountMl}
              onChangeText={(v) => setForm((f) => ({ ...f, amountMl: v }))}
            />
          )}
          {needsFood && (
            <FormField
              label={t("feeding_food_category_ph")}
              value={form.foodCategory}
              onChangeText={(v) => setForm((f) => ({ ...f, foodCategory: v }))}
            />
          )}

          <DateTimeField
            label={`${t("date_field")} · ${t("time_field")}`}
            mode="datetime"
            value={form.at}
            onChange={(iso) => setForm((f) => ({ ...f, at: iso }))}
          />

          <FormField
            label={t("note_field")}
            placeholder={t("note_ph")}
            value={form.note}
            onChangeText={(v) => setForm((f) => ({ ...f, note: v }))}
            multiline
          />

          <Pressable onPress={save} className="mt-1 items-center rounded-2xl bg-ink py-4">
            <Text className="font-bodyMedium text-[15px] text-cream">
              {editingId ? t("save_action") : t("add_action")}
            </Text>
          </Pressable>
        </View>
      </RecordSheet>
    </SafeAreaView>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <View className="items-center gap-2 py-16">
      <Icon name="spoon" size={26} color="#E9DFCC" />
      <Text className="font-body text-sm text-ink-soft">{text}</Text>
    </View>
  );
}
