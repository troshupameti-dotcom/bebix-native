import { View, Text, ScrollView, Pressable } from "react-native";
import { router } from "expo-router";
import { MotiView } from "moti";
import { SafeAreaView } from "react-native-safe-area-context";
import { Icon, IconName } from "@/components/ui/Icon";
import { useAppState, archived } from "@/lib/state/AppStateContext";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { haptics } from "@/lib/haptics";
import { formatDate } from "@/lib/dateUtils";
import { shadows } from "@/lib/shadows";

type Row = { kind: string; id: string; title: string; subtitle: string; icon: IconName; restore: () => void };

export default function ArchivedRecordsScreen() {
  const { t, lang } = useTranslation();
  const { state, baby } = useAppState();
  const b = state.baby;

  const rows: Row[] = [
    ...archived(b.feedingLog).map((e) => ({
      kind: "feeding", id: e.id, icon: "spoon" as IconName,
      title: t(`feeding_type_${e.type === "medicine" ? "medicine_short" : e.type}` as never),
      subtitle: formatDate(e.at, lang),
      restore: () => baby.unarchiveFeedingEntry(e.id),
    })),
    ...archived(b.sleepLog).map((e) => ({
      kind: "sleep", id: e.id, icon: "moon" as IconName,
      title: t("sleep_screen_title"), subtitle: formatDate(e.startAt, lang),
      restore: () => baby.unarchiveSleepEntry(e.id),
    })),
    ...archived(b.diaperLog).map((e) => ({
      kind: "diaper", id: e.id, icon: "baby" as IconName,
      title: t(`diaper_type_${e.type}` as never), subtitle: formatDate(e.at, lang),
      restore: () => baby.unarchiveDiaperEntry(e.id),
    })),
    ...archived(b.growthHistory).map((e) => ({
      kind: "growth", id: e.id, icon: "chart" as IconName,
      title: t("growth_screen_title"), subtitle: formatDate(e.date, lang),
      restore: () => baby.unarchiveGrowthHistoryEntry(e.id),
    })),
    ...archived(b.vaccines).map((e) => ({
      kind: "vaccine", id: e.id, icon: "syringe" as IconName,
      title: e.name, subtitle: formatDate(e.dueDate, lang),
      restore: () => baby.unarchiveVaccine(e.id),
    })),
    ...archived(b.medicalRecords).map((e) => ({
      kind: "medical", id: e.id, icon: "shield" as IconName,
      title: e.title, subtitle: formatDate(e.at, lang),
      restore: () => baby.unarchiveMedicalRecord(e.id),
    })),
    ...archived(b.timeline).map((e) => ({
      kind: "event", id: e.id, icon: "sparkle" as IconName,
      title: e.title, subtitle: e.date,
      restore: () => baby.unarchiveTimelineEvent(e.id),
    })),
    ...archived(b.moments).map((e) => ({
      kind: "moment", id: e.id, icon: "camera" as IconName,
      title: e.title || formatDate(e.date, lang), subtitle: formatDate(e.date, lang),
      restore: () => baby.unarchiveMoment(e.id),
    })),
  ];

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      <View className="flex-row items-center gap-3 px-4 pb-3 pt-2">
        <Pressable onPress={() => router.back()} hitSlop={8} className="h-9 w-9 items-center justify-center">
          <Icon name="chevronLeft" size={20} color="#2C271F" />
        </Pressable>
        <Text className="font-display text-xl text-ink">{t("archived_records_title")}</Text>
      </View>

      <ScrollView className="flex-1 px-5" contentContainerStyle={{ paddingBottom: 24 }}>
        {rows.length === 0 ? (
          <View className="items-center gap-2 py-16">
            <Icon name="download" size={26} color="#E9DFCC" />
            <Text className="font-body text-sm text-ink-soft">{t("archived_empty")}</Text>
          </View>
        ) : (
          rows.map((row, i) => (
            <MotiView
              key={`${row.kind}-${row.id}`}
              from={{ opacity: 0, translateX: -8 }}
              animate={{ opacity: 1, translateX: 0 }}
              transition={{ type: "timing", duration: 200, delay: Math.min(i, 8) * 25 }}
              style={shadows.press}
              className="mb-2.5 flex-row items-center gap-3 rounded-xl2 border border-ink/10 bg-white p-3.5"
            >
              <View className="h-10 w-10 items-center justify-center rounded-xl bg-cream-soft">
                <Icon name={row.icon} size={17} color="#6B6154" />
              </View>
              <View className="flex-1">
                <Text className="font-bodySemibold text-[14px] text-ink">{row.title}</Text>
                <Text className="font-body text-xs text-ink-soft">{row.subtitle}</Text>
              </View>
              <Pressable
                onPress={() => {
                  haptics.success();
                  row.restore();
                }}
                className="rounded-full bg-ink px-3 py-1.5"
              >
                <Text className="font-bodySemibold text-[11px] text-cream">{t("restore_action")}</Text>
              </Pressable>
            </MotiView>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
