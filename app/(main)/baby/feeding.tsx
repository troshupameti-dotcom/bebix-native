import { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, ScrollView, Pressable, TextInput } from "react-native";
import { shadows } from "@/lib/shadows";
import { JustSaved } from "@/components/baby/JustSaved";
import {
  elapsedSeconds, finishTimer, formatElapsed, loadTimer, saveTimer, startTimer, suggestedSide, switchSide, type BreastTimer,
} from "@/lib/baby/breastTimer";
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
import { FeedingEntry, FeedingType, BreastSide } from "@/lib/state/types";
import { BackButton } from "@/components/ui/BackButton";
import { SinceHero, LogRow, TONES, type Tone } from "@/components/baby/LogTiles";

/** Ngjyra e çdo lloji: gjiri rozë, shishja kaltër, ushqimi jeshil. */
const TYPE_TONE: Record<FeedingType, Tone> = {
  breast: TONES.pink,
  bottle: TONES.blue,
  formula: TONES.blue,
  solid: TONES.green,
  water: TONES.blue,
  medicine: TONES.purple,
};

/** Sasitë e shpejta të biberonit; e fundit e përdorur shtohet kur s'është mes tyre. */
const QUICK_ML = [60, 90, 120];

function quickAmounts(last: number | null): number[] {
  return last != null && !QUICK_ML.includes(last) ? [...QUICK_ML, last].sort((a, b) => a - b) : QUICK_ML;
}

/** Tri llojet e shënimit të shpejtë. Formula, uji dhe ilaçi shënohen te "Shto me detaje". */
type QuickType = "breast" | "bottle" | "solid";
const QUICK_TYPES: QuickType[] = ["breast", "bottle", "solid"];
const QUICK_TONE: Record<QuickType, Tone> = { breast: TONES.pink, bottle: TONES.blue, solid: TONES.green };

function quickTypeOf(type: FeedingType | undefined): QuickType {
  if (type === "solid") return "solid";
  if (type === "bottle" || type === "formula") return "bottle";
  return "breast";
}

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

  /** Sasia e fundit e shishes: prindi jep te njejten disa dite me radhe. */
  const lastBottleMl = useMemo(() => {
    const last = log.find((e) => e.amountMl != null && (e.type === "bottle" || e.type === "formula"));
    return last?.amountMl ?? null;
  }, [log]);
  const lastBreastSide = useMemo(() => log.find((e) => e.type === "breast")?.side ?? null, [log]);

  // ---- Shënimi me një prekje ----
  // Lloji i parazgjedhur është ai i shënimit të fundit; "Ushqeva tani" e ruan menjëherë me orën aktuale.
  const [pickedType, setPickedType] = useState<QuickType | null>(null);
  const quickType: QuickType = pickedType ?? quickTypeOf(log[0]?.type);
  const [pickedSide, setPickedSide] = useState<"left" | "right" | null>(null);
  const side = pickedSide ?? suggestedSide(lastBreastSide);
  const [pickedMl, setPickedMl] = useState<number | null>(null);
  const [otherMl, setOtherMl] = useState("");
  const typedMl = Number(otherMl.replace(",", "."));
  const bottleMl = otherMl.trim() && typedMl > 0 && typedMl <= 500 ? Math.round(typedMl) : pickedMl ?? lastBottleMl;

  // Timeri i gjirit (start/stop si te gjumi): ruhet te telefoni, mbijeton mbylljen e app-it.
  const [timer, setTimer] = useState<BreastTimer | null>(null);
  const [tick, setTick] = useState(() => new Date());
  useEffect(() => {
    let alive = true;
    void loadTimer().then((v) => alive && setTimer(v));
    return () => {
      alive = false;
    };
  }, []);
  useEffect(() => {
    if (!timer) return;
    const id = setInterval(() => setTick(new Date()), 1000);
    return () => clearInterval(id);
  }, [timer]);

  // Shiriti "U shënua · Ndrysho · Fshi" pas çdo shënimi të shpejtë.
  const [justSaved, setJustSaved] = useState<{ id: string; text: string } | null>(null);
  const clearJustSaved = useCallback(() => setJustSaved(null), []);

  function describe(entry: Partial<FeedingEntry>): string {
    return [
      t(`feeding_type_${entry.type}` as never),
      entry.side ? t(`feeding_side_${entry.side}` as never) : null,
      entry.amountMl ? `${entry.amountMl} ml` : null,
      entry.durationMin ? `${entry.durationMin} min` : null,
    ]
      .filter(Boolean)
      .join(" · ");
  }

  function quickLog(entry: Partial<FeedingEntry>) {
    const id = baby.addFeedingEntry(entry);
    haptics.success();
    setOtherMl("");
    setPickedMl(null);
    setJustSaved({ id, text: t("quick_saved_what", { what: describe(entry) }) });
  }

  function startBreastTimer() {
    haptics.tap();
    const next = startTimer(side);
    setTimer(next);
    setTick(new Date());
    void saveTimer(next);
  }
  function changeTimerSide(s: "left" | "right") {
    setPickedSide(s);
    if (!timer) return;
    haptics.select();
    const next = switchSide(timer, s);
    setTimer(next);
    void saveTimer(next);
  }
  function stopBreastTimer() {
    if (!timer) return;
    const done = finishTimer(timer);
    setTimer(null);
    void saveTimer(null);
    quickLog({ type: "breast", side: done.side, at: done.at, durationMin: done.durationMin });
  }

  /** "Ushqeva tani": ruan menjëherë sipas llojit të zgjedhur (gjiri me timer në ecje: e ndal dhe e ruan). */
  function feedNow() {
    if (quickType === "breast") {
      if (timer) stopBreastTimer();
      else quickLog({ type: "breast", side });
    } else if (quickType === "bottle") {
      quickLog({ type: "bottle", amountMl: bottleMl ?? null });
    } else {
      quickLog({ type: "solid" });
    }
  }

  const tone = QUICK_TONE[quickType];
  const elapsed = timer ? formatElapsed(elapsedSeconds(timer, tick)) : null;

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
        <BackButton fallback="/(main)/baby" />
        <Text className="font-display text-xl text-ink">{t("feeding_screen_title")}</Text>
      </View>

      <ScrollView className="flex-1 px-5" contentContainerStyle={{ paddingBottom: 24 }}>
        <SinceHero
          title={t("feeding_last_title")}
          lastAt={log[0]?.at ?? null}
          emptyText={t("feeding_hero_empty")}
          detail={
            log[0]
              ? `${t(`feeding_type_${log[0].type === "medicine" ? "medicine_short" : log[0].type}` as never)}${
                  log[0].side ? ` · ${t(`feeding_side_${log[0].side}` as never)}` : ""
                }${log[0].amountMl ? ` · ${log[0].amountMl} ml` : ""} · ${t("today_count", { n: stats.today })}`
              : undefined
          }
          icon="droplet"
          tone={log[0] ? TYPE_TONE[log[0].type] : TONES.pink}
        />

        <Text className="mb-2 font-bodyMedium text-xs uppercase text-ink-faint">{t("quick_log_title")}</Text>

        {/* Lloji: Gji / Biberon / Ushqim i ngurtë. Parazgjedhja: lloji i shënimit të fundit. */}
        <View className="flex-row rounded-2xl bg-cream-soft p-1" accessibilityRole="tablist">
          {QUICK_TYPES.map((qt) => {
            const on = quickType === qt;
            return (
              <Pressable
                key={qt}
                onPress={() => {
                  haptics.select();
                  setPickedType(qt);
                }}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                style={{ minHeight: 48, backgroundColor: on ? QUICK_TONE[qt].tint : "transparent" }}
                className="flex-1 flex-row items-center justify-center gap-1.5 rounded-xl"
              >
                <Icon name={TYPE_ICON[qt]} size={15} color={on ? "#FFFFFF" : QUICK_TONE[qt].tint} />
                <Text className="font-bodySemibold text-[13.5px]" style={{ color: on ? "#FFFFFF" : QUICK_TONE[qt].tint }} numberOfLines={1}>
                  {t(`feeding_type_${qt}` as never)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {quickType === "breast" && (
          <View style={[shadows.soft, { backgroundColor: tone.tintBg }]} className="mt-3 rounded-xl3 p-4">
            <View className="flex-row" style={{ gap: 8 }}>
              {(["left", "right"] as const).map((s) => {
                const on = (timer ? timer.side : side) === s;
                return (
                  <Pressable
                    key={s}
                    onPress={() => changeTimerSide(s)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: on }}
                    style={{ minHeight: 48, backgroundColor: on ? tone.tint : "#FFFFFF" }}
                    className="flex-1 items-center justify-center rounded-2xl"
                  >
                    <Text className="font-bodySemibold text-[14px]" style={{ color: on ? "#FFFFFF" : tone.tint }}>
                      {t(`feeding_side_${s}` as never)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {timer ? (
              <View className="mt-4 items-center">
                <Text className="font-bodyMedium text-[13px]" style={{ color: tone.tint }}>
                  {t("feeding_timer_running", { side: t(`feeding_side_${timer.side}` as never) })}
                </Text>
                <Text className="mt-1 font-display text-[44px] leading-[52px] text-ink" accessibilityLiveRegion="polite">
                  {elapsed}
                </Text>
                <Text className="mt-1 text-center font-body text-[12px] text-ink-soft">{t("feeding_timer_hint")}</Text>
              </View>
            ) : (
              <Pressable
                onPress={startBreastTimer}
                accessibilityRole="button"
                style={{ minHeight: 56, borderColor: tone.tint }}
                className="mt-3 flex-row items-center justify-center gap-2 rounded-2xl border-2 bg-surface"
              >
                <Icon name="play" size={16} color={tone.tint} />
                <Text className="font-bodySemibold text-[15px]" style={{ color: tone.tint }}>{t("feeding_timer_start")}</Text>
              </Pressable>
            )}
          </View>
        )}

        {quickType === "bottle" && (
          <View style={[shadows.soft, { backgroundColor: tone.tintBg }]} className="mt-3 rounded-xl3 p-4">
            <View className="flex-row flex-wrap" style={{ gap: 8 }}>
              {quickAmounts(lastBottleMl).map((ml) => {
                const on = !otherMl.trim() && bottleMl === ml;
                return (
                  <Pressable
                    key={ml}
                    onPress={() => {
                      haptics.select();
                      setOtherMl("");
                      setPickedMl(ml);
                    }}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: on }}
                    style={{ minHeight: 48, backgroundColor: on ? tone.tint : "#FFFFFF" }}
                    className="items-center justify-center rounded-full px-5"
                  >
                    <Text className="font-bodySemibold text-[15px]" style={{ color: on ? "#FFFFFF" : tone.tint }}>{ml} ml</Text>
                  </Pressable>
                );
              })}
            </View>
            <TextInput
              value={otherMl}
              onChangeText={(v) => setOtherMl(v.replace(/[^0-9.,]/g, "").slice(0, 4))}
              keyboardType="number-pad"
              placeholder={t("feeding_other_amount")}
              placeholderClassName="text-ink-faint"
              accessibilityLabel={t("feeding_other_amount")}
              className="mt-3 rounded-2xl border border-ink/10 bg-surface px-4 py-3 font-body text-[15px] text-ink"
              style={{ minHeight: 48 }}
            />
          </View>
        )}

        {/* Butoni kryesor: një prekje, me orën e tanishme. */}
        <Pressable
          onPress={feedNow}
          accessibilityRole="button"
          accessibilityHint={quickType === "bottle" && bottleMl ? `${bottleMl} ml` : undefined}
          style={[shadows.soft, { minHeight: 64, backgroundColor: tone.tint }]}
          className="mt-3 flex-row items-center justify-center gap-2.5 rounded-2xl px-5 active:opacity-85"
        >
          <Icon name={quickType === "breast" && timer ? "check" : TYPE_ICON[quickType]} size={20} color="#FFFFFF" />
          <Text className="font-bodySemibold text-[17px] text-white" numberOfLines={1}>
            {quickType === "breast" && timer
              ? `${t("feeding_now_stop")} · ${elapsed}`
              : quickType === "bottle" && bottleMl
                ? `${t("feeding_now")} · ${bottleMl} ml`
                : t("feeding_now")}
          </Text>
        </Pressable>

        {justSaved && (
          <JustSaved
            savedKey={justSaved.id}
            text={justSaved.text}
            onDone={clearJustSaved}
            onEdit={() => {
              const entry = log.find((e) => e.id === justSaved.id);
              setJustSaved(null);
              if (entry) openEdit(entry);
            }}
            onDelete={() => {
              const id = justSaved.id;
              setJustSaved(null);
              baby.deleteFeedingEntry(id);
              showToast(t("deleted_toast"), () => baby.restoreFeedingEntry(id));
            }}
          />
        )}

        <View className="mt-5" />
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
              <LogRow
                onPress={() => openEdit(entry)}
                onDelete={() => {
                  baby.deleteFeedingEntry(entry.id);
                  showToast(t("deleted_toast"), () => baby.restoreFeedingEntry(entry.id));
                }}
                deleteLabel={t("delete_action")}
                icon={TYPE_ICON[entry.type]}
                tone={TYPE_TONE[entry.type]}
                title={t(`feeding_type_${entry.type === "medicine" ? "medicine_short" : entry.type}` as never)}
                detail={[
                  entry.amountMl ? `${entry.amountMl} ml` : null,
                  entry.durationMin ? `${entry.durationMin} min` : null,
                  entry.side ? t(`feeding_side_${entry.side}` as never) : null,
                  entry.foodCategory,
                  formatTime(entry.at, lang),
                ]
                  .filter(Boolean)
                  .join(" · ")}
              />
            </MotiView>
          ))
        )}
      </ScrollView>

      <View className="px-5 pb-6">
        {/* Dytësore: shumica e shënimeve bëhen me pllakat lart. */}
        <Pressable onPress={openNew} className="flex-row items-center justify-center gap-2 rounded-2xl border border-ink/10 bg-surface py-3.5">
          <Icon name="plus" size={16} color="#2C271F" />
          <Text className="font-bodyMedium text-[14px] text-ink">{t("add_with_details")}</Text>
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
