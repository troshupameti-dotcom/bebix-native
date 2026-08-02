import { View, Text, ScrollView, Pressable } from "react-native";
import { router } from "expo-router";
import { MotiView } from "moti";
import { SafeAreaView } from "react-native-safe-area-context";
import { Icon, IconName } from "@/components/ui/Icon";
import { useAppState } from "@/lib/state/AppStateContext";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { formatDate, formatTime } from "@/lib/dateUtils";
import { shadows } from "@/lib/shadows";
import { RecordKind } from "@/lib/state/types";

const KIND_ICON: Record<RecordKind, IconName> = {
  growthHistory: "chart",
  feeding: "spoon",
  sleep: "moon",
  diaper: "baby",
  vaccine: "syringe",
  moment: "camera",
  medical: "shield",
  timeline: "sparkle",
};

const KIND_LABEL_KEY: Record<RecordKind, string> = {
  growthHistory: "growth_screen_title",
  feeding: "feeding_screen_title",
  sleep: "sleep_screen_title",
  diaper: "diaper_screen_title",
  vaccine: "vaccine_screen_title",
  moment: "moments_screen_title",
  medical: "medical_screen_title",
  timeline: "baby_tab_timeline",
};

/** Best-effort human label for a raw field key — falls back to the key itself. */
const FIELD_LABELS: Record<string, string> = {
  value: "value_field",
  note: "note_field",
  weightKg: "growth_weight_ph",
  heightCm: "growth_height_ph",
  headCm: "growth_head",
  amountMl: "feeding_amount_ml_ph",
  durationMin: "feeding_duration_ph",
  type: "label_field",
  quality: "sleep_quality",
  givenDate: "vaccine_status_done",
  dueDate: "vaccine_due_ph",
  done: "baby_tab_milestones",
  title: "moment_title_ph",
  at: "date_field",
  date: "date_field",
};

export default function AuditLogScreen() {
  const { t, lang } = useTranslation();
  const { state } = useAppState();
  const entries = [...state.baby.auditLog].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      <View className="flex-row items-center gap-3 px-4 pb-3 pt-2">
        <Pressable onPress={() => router.back()} hitSlop={8} className="h-9 w-9 items-center justify-center">
          <Icon name="chevronLeft" size={20} color="#2C271F" />
        </Pressable>
        <Text className="font-display text-xl text-ink">{t("audit_log_title")}</Text>
      </View>

      <ScrollView className="flex-1 px-5" contentContainerStyle={{ paddingBottom: 24 }}>
        {entries.length === 0 ? (
          <View className="items-center gap-2 py-16">
            <Icon name="edit" size={26} color="#E9DFCC" />
            <Text className="font-body text-sm text-ink-soft">{t("audit_empty")}</Text>
          </View>
        ) : (
          entries.map((entry, i) => {
            const fieldLabelKey = FIELD_LABELS[entry.field];
            const fieldLabel = fieldLabelKey ? t(fieldLabelKey as never) : entry.field;
            return (
              <MotiView
                key={entry.id}
                from={{ opacity: 0, translateY: 6 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{ type: "timing", duration: 200, delay: Math.min(i, 8) * 25 }}
                style={shadows.press}
                className="mb-2.5 rounded-xl2 border border-ink/10 bg-white p-3.5"
              >
                <View className="flex-row items-center gap-2.5">
                  <View className="h-8 w-8 items-center justify-center rounded-lg bg-cream-soft">
                    <Icon name={KIND_ICON[entry.recordKind]} size={14} color="#6B6154" />
                  </View>
                  <Text className="flex-1 font-bodySemibold text-[13.5px] text-ink">
                    {t(KIND_LABEL_KEY[entry.recordKind] as never)} · {fieldLabel} {t("audit_changed")}
                  </Text>
                </View>
                <View className="mt-2.5 flex-row items-center gap-2 pl-[42px]">
                  <Text className="font-body text-[12.5px] text-ink-soft line-through">{entry.oldValue}</Text>
                  <Icon name="chevronRight" size={12} color="#A79D8A" />
                  <Text className="font-bodySemibold text-[12.5px] text-ink">{entry.newValue}</Text>
                </View>
                <Text className="mt-1.5 pl-[42px] font-body text-[10.5px] text-ink-faint">
                  {formatDate(entry.at, lang)} · {formatTime(entry.at, lang)}
                </Text>
              </MotiView>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
