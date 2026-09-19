import { useState } from "react";
import { View, Text, TextInput, Pressable } from "react-native";
import { shadows } from "@/lib/shadows";
import { haptics } from "@/lib/haptics";
import { useTranslation } from "@/lib/i18n/LanguageContext";

/**
 * Matja me tre numra dhe një prekje.
 *
 * Matja bëhet një herë në muaj, te pesorja, me bebin në krahë — pra nuk
 * është momenti për të hapur një formular me datë, shënim dhe fusha të
 * ndara. Të tria numrat rrinë në një rresht, dhe ruhen bashkë me datën e
 * sotme. Për një matje të vjetër ose me shënim, formulari i plotë mbetet.
 */

type Props = {
  onSave: (values: { weightKg: number | null; heightCm: number | null; headCm: number | null }) => void;
};

function toNumber(text: string): number | null {
  const clean = text.trim().replace(",", ".");
  if (!clean) return null;
  const value = parseFloat(clean);
  return Number.isFinite(value) ? value : null;
}

export function QuickMeasure({ onSave }: Props) {
  const { t } = useTranslation();
  const [weight, setWeight] = useState("");
  const [height, setHeight] = useState("");
  const [head, setHead] = useState("");

  const values = {
    weightKg: toNumber(weight),
    heightCm: toNumber(height),
    headCm: toNumber(head),
  };
  const canSave = values.weightKg !== null || values.heightCm !== null || values.headCm !== null;

  function handleSave() {
    if (!canSave) return;
    haptics.success();
    onSave(values);
    setWeight("");
    setHeight("");
    setHead("");
  }

  return (
    <View style={shadows.soft} className="bg-surface rounded-xl2 p-4 mb-4">
      <Text className="font-bodyMedium text-xs text-ink-faint uppercase mb-3">{t("quick_measure_title")}</Text>

      <View className="flex-row" style={{ gap: 8 }}>
        <Field label={t("growth_weight")} unit="kg" value={weight} onChange={setWeight} />
        <Field label={t("growth_height")} unit="cm" value={height} onChange={setHeight} />
        <Field label={t("growth_head")} unit="cm" value={head} onChange={setHead} />
      </View>

      <Pressable
        onPress={handleSave}
        disabled={!canSave}
        accessibilityRole="button"
        className="bg-olive rounded-xl2 py-3 items-center mt-3"
        style={{ opacity: canSave ? 1 : 0.4 }}
      >
        <Text className="font-bodySemibold text-sm text-on-accent">{t("quick_measure_save")}</Text>
      </Pressable>
    </View>
  );
}

function Field({
  label, unit, value, onChange,
}: {
  label: string;
  unit: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <View className="flex-1">
      <Text className="font-body text-[11px] text-ink-faint mb-1.5">{label}</Text>
      <View className="flex-row items-center bg-cream-soft rounded-xl2 px-3">
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder="—"
          placeholderClassName="text-ink-faint"
          keyboardType="decimal-pad"
          maxLength={6}
          className="flex-1 py-2.5 font-bodySemibold text-base text-ink"
        />
        <Text className="font-body text-[11px] text-ink-faint ml-1">{unit}</Text>
      </View>
    </View>
  );
}
