import { useCallback, useMemo, useState } from "react";
import { View, Text, Pressable } from "react-native";
import { KeyboardScrollView } from "@/lib/ui/keyboard";
import { JustSaved } from "@/components/baby/JustSaved";
import { trackRecordLogged, trackRecordUndone } from "@/lib/analytics/babyEvents";
import { SafeAreaView } from "react-native-safe-area-context";
import { Icon } from "@/components/ui/Icon";
import { RecordSheet } from "@/components/baby/RecordSheet";
import { FormField } from "@/components/baby/FormField";
import { SegmentedField } from "@/components/baby/SegmentedField";
import { DateTimeField } from "@/components/baby/DateTimeField";
import { useAppState, active } from "@/lib/state/AppStateContext";
import { useToast } from "@/lib/toast/ToastContext";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { haptics } from "@/lib/haptics";
import { formatTime } from "@/lib/dateUtils";
import {
  SOLID_MAX, SOLID_UNITS, formatNumber, isSolidUnit, mlToOz, ozToMl, parseAmount, setFeedUnits, solidAmountText, useFeedUnits, volumeText,
  type FeedUnits, type SolidUnit, type VolumeUnit,
} from "@/lib/baby/feedUnits";
import { FeedingEntry, FeedingType, BreastSide } from "@/lib/state/types";
import { BackButton } from "@/components/ui/BackButton";
import { FeedHero } from "@/components/baby/feeding/FeedHero";
import { FeedComposer, type FeedPrefill } from "@/components/baby/feeding/FeedComposer";
import { FormulaStockCard } from "@/components/baby/FormulaStockCard";
import { FeedHistory, TodayCard } from "@/components/baby/feeding/FeedDay";
import { TYPE_ICON, entryHeadline, typeLabel } from "@/components/baby/feeding/feedingStyle";

const TYPES: FeedingType[] = ["breast", "bottle", "formula", "solid", "water", "medicine"];

type FormShape = {
  type: FeedingType;
  /** Sasia si tekst, në njësinë `amountUnit` (ilaçi gjithmonë në ml). */
  amount: string;
  amountUnit: VolumeUnit;
  /** Vlera e ruajtur kur hapet formulari: s'ndryshohet nga rrumbullakimi i oz nëse prindi s'e prek fushën. */
  amountMlOrig: number | null;
  amountTouched: boolean;
  durationMin: string;
  side: BreastSide;
  foodCategory: string;
  solidAmount: string;
  solidUnit: SolidUnit;
  solidTouched: boolean;
  at: string;
  note: string;
};

/** Ilaçi s'shkruhet kurrë në oz: doza mbetet në ml. */
const usesOz = (type: FeedingType, unit: VolumeUnit) => unit === "oz" && type !== "medicine";

function amountShown(ml: number | null | undefined, type: FeedingType, unit: VolumeUnit, lang: string): string {
  if (ml == null) return "";
  return usesOz(type, unit) ? formatNumber(mlToOz(ml), lang) : String(ml);
}

function emptyForm(prefill: FeedPrefill = {}, units: FeedUnits = { volume: "ml", solid: "g" }, lang = "sq"): FormShape {
  const type = prefill.type ?? "bottle";
  return {
    type,
    amount: amountShown(prefill.amountMl, type, units.volume, lang),
    amountUnit: units.volume,
    amountMlOrig: prefill.amountMl ?? null,
    amountTouched: prefill.amountMl != null,
    durationMin: "",
    side: prefill.side ?? null,
    foodCategory: prefill.foodCategory ?? "",
    solidAmount: prefill.solidAmount ? formatNumber(prefill.solidAmount, lang) : "",
    solidUnit: isSolidUnit(prefill.solidUnit) ? prefill.solidUnit : units.solid,
    solidTouched: !!prefill.solidAmount,
    at: new Date().toISOString(),
    note: "",
  };
}
function formFromEntry(e: FeedingEntry, units: FeedUnits, lang: string): FormShape {
  return {
    type: e.type,
    amount: amountShown(e.amountMl, e.type, units.volume, lang),
    amountUnit: units.volume,
    amountMlOrig: e.amountMl,
    amountTouched: false,
    durationMin: e.durationMin != null ? String(e.durationMin) : "",
    side: e.side,
    foodCategory: e.foodCategory ?? "",
    solidAmount: e.solidAmount ? formatNumber(e.solidAmount, lang) : "",
    solidUnit: isSolidUnit(e.solidUnit) ? e.solidUnit : units.solid,
    solidTouched: false,
    at: e.at,
    note: e.note,
  };
}

/**
 * Ushqyerja: lart "sa kohë ka kaluar" dhe kur vjen e radhës, pastaj karta e shënimit (gji me kohëmatës për çdo
 * gji, biberon me sasi, ushqim me çipa), dita e sotme në një vijë 24-orëshe dhe historiku sipas ditëve.
 * Çdo gjë tjetër (ujë, ilaç, orë e saktë, shënim) bëhet te formulari "me detaje".
 */
export default function FeedingScreen() {
  const { t, lang } = useTranslation();
  const units = useFeedUnits();
  const { state, baby } = useAppState();
  const { showToast } = useToast();
  const log = useMemo(
    () => active(state.baby.feedingLog).sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()),
    [state.baby.feedingLog]
  );

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormShape>(emptyForm());

  // Shiriti "U shënua · Ndrysho · Fshi" pas çdo shënimi të shpejtë.
  const [justSaved, setJustSaved] = useState<{ id: string; text: string } | null>(null);
  const clearJustSaved = useCallback(() => setJustSaved(null), []);

  function describe(entry: Partial<FeedingEntry>): string {
    return [
      typeLabel(entry.type ?? "bottle", t),
      entry.side ? t(`feeding_side_${entry.side}` as never) : null,
      entry.amountMl ? volumeText(entry.amountMl, entry.type === "medicine" ? "ml" : units.volume, lang) : null,
      entry.durationMin ? `${entry.durationMin} min` : null,
      entry.foodCategory || null,
      entry.type === "solid" && entry.solidAmount && isSolidUnit(entry.solidUnit) ? solidAmountText(entry.solidAmount, entry.solidUnit, lang, t) : null,
    ]
      .filter(Boolean)
      .join(" · ");
  }

  function quickLog(entry: Partial<FeedingEntry>) {
    const id = baby.addFeedingEntry(entry);
    trackRecordLogged({ kind: "feeding", source: "quick_button", at: entry.at });
    haptics.success();
    setJustSaved({ id, text: t("quick_saved_what", { what: describe(entry) }) });
  }

  function openNew(prefill: FeedPrefill = {}) {
    haptics.tap();
    setForm(emptyForm(prefill, units, lang));
    setEditingId(null);
    setSheetOpen(true);
  }
  function openEdit(entry: FeedingEntry) {
    haptics.select();
    setForm(formFromEntry(entry, units, lang));
    setEditingId(entry.id);
    setSheetOpen(true);
  }
  function closeSheet() {
    if (editingId) baby.updateFeedingEntry(editingId, computePatch());
    setSheetOpen(false);
  }

  function computePatch(): Partial<FeedingEntry> {
    const typed = parseAmount(form.amount);
    const amountMl = !form.amountTouched
      ? form.amountMlOrig
      : typed == null || typed <= 0
        ? null
        : usesOz(form.type, form.amountUnit)
          ? ozToMl(typed)
          : Math.round(typed);
    const solid = parseAmount(form.solidAmount);
    return {
      type: form.type,
      amountMl,
      durationMin: form.durationMin ? Number(form.durationMin) : null,
      side: form.side,
      foodCategory: form.foodCategory || null,
      // Sasia e ushqimit shkon vetëm kur prindi e ndryshoi (përndryshe shënimet e vjetra s'marrin ndryshime boshe).
      ...(form.solidTouched
        ? solid && solid > 0
          ? { solidAmount: Math.min(SOLID_MAX[form.solidUnit], solid), solidUnit: form.solidUnit }
          : { solidAmount: null, solidUnit: null }
        : {}),
      at: form.at,
      note: form.note,
    };
  }

  function save() {
    if (editingId) baby.updateFeedingEntry(editingId, computePatch());
    else {
      const patch = computePatch();
      baby.addFeedingEntry(patch);
      trackRecordLogged({ kind: "feeding", source: "app", at: patch.at });
    }
    haptics.success();
    setSheetOpen(false);
  }

  function remove(id: string) {
    baby.deleteFeedingEntry(id);
    showToast(t("deleted_toast"), () => baby.restoreFeedingEntry(id));
  }

  function handleDelete() {
    if (editingId) remove(editingId);
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
        <Text className="flex-1 font-display text-xl text-ink">{t("feeding_screen_title")}</Text>
        <Pressable
          onPress={() => openNew()}
          accessibilityRole="button"
          accessibilityLabel={t("add_with_details")}
          hitSlop={6}
          className="h-10 w-10 items-center justify-center rounded-full border border-ink/10 bg-surface active:opacity-80"
        >
          <Icon name="plus" size={18} color="#2C271F" />
        </Pressable>
      </View>

      <KeyboardScrollView className="flex-1 px-5" contentContainerStyle={{ paddingBottom: 40 }}>
        <FeedHero log={log} />

        <FeedComposer log={log} onLog={quickLog} onDetails={openNew} />

        {justSaved && (
          <JustSaved
            savedKey={justSaved.id}
            text={justSaved.text}
            onDone={clearJustSaved}
            onEdit={() => {
              const entry = log.find((e) => e.id === justSaved.id);
              setJustSaved(null);
              trackRecordUndone("feeding", "edit");
              if (entry) openEdit(entry);
            }}
            onDelete={() => {
              const id = justSaved.id;
              setJustSaved(null);
              trackRecordUndone("feeding", "delete");
              remove(id);
            }}
          />
        )}

        {/* Formula e mbetur, si pelenat: e plotë kur bebi pi formulë, përndryshe një rresht i vogël që hapet. */}
        <FormulaStockCard log={log} />

        {log.length === 0 ? (
          <EmptyState text={t("feeding_empty")} />
        ) : (
          <>
            <TodayCard log={log} onOpen={openEdit} />
            <FeedHistory log={log} onOpen={openEdit} onDelete={(e) => remove(e.id)} />
          </>
        )}
      </KeyboardScrollView>

      <RecordSheet
        visible={sheetOpen}
        onClose={closeSheet}
        title={editingId ? t("feeding_edit_title") : t("feeding_add")}
        isNew={!editingId}
        onDuplicate={editingId ? handleDuplicate : undefined}
        onArchive={editingId ? handleArchive : undefined}
        onDelete={handleDelete}
        lifecycle={editingEntry ?? undefined}
        shareText={editingEntry ? `${entryHeadline(editingEntry, t, { volume: units.volume, lang })} · ${formatTime(editingEntry.at, lang)}` : undefined}
      >
        <View className="gap-4">
          <SegmentedField
            label={t("feeding_screen_title")}
            options={TYPES.map((ty) => ({ value: ty, label: typeLabel(ty, t), icon: TYPE_ICON[ty] }))}
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
              label={usesOz(form.type, form.amountUnit) ? t("feeding_amount_oz_ph") : t("feeding_amount_ml_ph")}
              keyboardType={usesOz(form.type, form.amountUnit) ? "decimal-pad" : "number-pad"}
              value={form.amount}
              onChangeText={(v) => setForm((f) => ({ ...f, amount: v, amountTouched: true }))}
            />
          )}
          {needsAmount && form.type !== "medicine" && (
            <SegmentedField
              label={t("feeding_unit_label")}
              options={(["ml", "oz"] as VolumeUnit[]).map((u) => ({ value: u, label: u }))}
              value={form.amountUnit}
              onChange={(v) => {
                const unit = v as VolumeUnit;
                setFeedUnits({ volume: unit });
                // E njëjta sasi, e shkruar në njësinë e re.
                setForm((f) => {
                  const typed = parseAmount(f.amount);
                  const ml = typed == null ? null : usesOz(f.type, f.amountUnit) ? ozToMl(typed) : Math.round(typed);
                  return { ...f, amountUnit: unit, amount: amountShown(ml, f.type, unit, lang) };
                });
              }}
            />
          )}
          {needsFood && (
            <FormField
              label={t("feeding_food_category_ph")}
              value={form.foodCategory}
              onChangeText={(v) => setForm((f) => ({ ...f, foodCategory: v }))}
            />
          )}
          {needsFood && (
            <FormField
              label={t("feeding_solid_amount_title")}
              keyboardType={form.solidUnit === "g" ? "number-pad" : "decimal-pad"}
              value={form.solidAmount}
              onChangeText={(v) => setForm((f) => ({ ...f, solidAmount: v, solidTouched: true }))}
            />
          )}
          {needsFood && (
            <SegmentedField
              label={t("feeding_unit_label")}
              options={SOLID_UNITS.map((u) => ({ value: u, label: u === "spoon" ? t("feeding_unit_spoon_name") : u }))}
              value={form.solidUnit}
              onChange={(v) => {
                setFeedUnits({ solid: v as SolidUnit });
                setForm((f) => ({ ...f, solidUnit: v as SolidUnit, solidTouched: true }));
              }}
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
    <View className="items-center gap-2 py-12">
      <Icon name="spoon" size={26} color="#E9DFCC" />
      <Text className="font-body text-sm text-ink-soft">{text}</Text>
    </View>
  );
}
