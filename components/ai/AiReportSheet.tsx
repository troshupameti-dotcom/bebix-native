import { useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { useThemeColors } from "@/lib/theme/useThemeColors";
import type { TranslationKey } from "@/lib/i18n/translations";
import type { AiReportReason } from "@/lib/ai/chat";

const REASONS: { key: AiReportReason; label: TranslationKey }[] = [
  { key: "wrong", label: "ai_report_wrong" },
  { key: "unsafe", label: "ai_report_unsafe" },
  { key: "inappropriate", label: "ai_report_inappropriate" },
  { key: "other", label: "ai_report_other" },
];

/** Raportimi i një përgjigjeje të AI-së: arsyeja (e detyrueshme) dhe një shënim i shkurtër (opsional). */
export function AiReportSheet({
  visible,
  onClose,
  onSend,
}: {
  visible: boolean;
  onClose: () => void;
  onSend: (reason: AiReportReason, note: string) => Promise<void>;
}) {
  const { t } = useTranslation();
  const theme = useThemeColors();
  const [reason, setReason] = useState<AiReportReason | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function send() {
    if (!reason) return;
    setBusy(true);
    await onSend(reason, note);
    setBusy(false);
    setReason(null);
    setNote("");
  }

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <Text className="mb-3 font-bodySemibold text-base text-ink">{t("ai_report_title")}</Text>
      {REASONS.map((r) => {
        const on = reason === r.key;
        return (
          <Pressable
            key={r.key}
            onPress={() => setReason(r.key)}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            className="flex-row items-center border-b border-cream-line py-3.5"
          >
            <View className={`mr-3 h-5 w-5 items-center justify-center rounded-full border-2 ${on ? "border-olive" : "border-cream-line"}`}>
              {on ? <View className="h-2.5 w-2.5 rounded-full bg-olive" /> : null}
            </View>
            <Text className="flex-1 font-body text-[15px] text-ink">{t(r.label)}</Text>
          </Pressable>
        );
      })}
      <TextInput
        value={note}
        onChangeText={setNote}
        placeholder={t("ai_report_note_ph")}
        placeholderTextColor={theme.inkFaint}
        maxLength={300}
        multiline
        className="mt-4 min-h-[72px] rounded-2xl border border-cream-line bg-surface px-4 py-3 font-body text-[15px] text-ink"
        style={{ textAlignVertical: "top" }}
      />
      <Pressable
        onPress={() => void send()}
        disabled={!reason || busy}
        accessibilityRole="button"
        accessibilityState={{ disabled: !reason || busy }}
        className="mt-4 items-center rounded-full bg-ink py-3.5"
        style={{ opacity: !reason || busy ? 0.5 : 1 }}
      >
        {busy ? <ActivityIndicator color={theme.cream} /> : <Text className="font-bodySemibold text-[15px] text-cream">{t("ai_report_send")}</Text>}
      </Pressable>
    </BottomSheet>
  );
}
