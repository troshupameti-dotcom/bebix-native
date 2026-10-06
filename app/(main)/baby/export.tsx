import { useState } from "react";
import { View, Text, Pressable, ActivityIndicator, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Icon, IconName } from "@/components/ui/Icon";
import { useAppState } from "@/lib/state/AppStateContext";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import type { TranslationKey } from "@/lib/i18n/translations";
import { haptics } from "@/lib/haptics";
import { shadows } from "@/lib/shadows";
import { exportAsPDF, exportAsCSV } from "@/lib/export";
import { BackButton } from "@/components/ui/BackButton";

type Format = "pdf" | "csv";

/**
 * Eksporti: dy rreshta në një kartë (si kontaktet e emergjencës). PDF-ja është raporti shëndetësor për mjekun
 * (profili, alergjitë, rritja, vaksinat, kartela mjekësore, kontaktet), CSV-ja është ditari i plotë.
 */
export default function ExportScreen() {
  const { t, language } = useTranslation();
  const { state } = useAppState();
  const [loading, setLoading] = useState<Format | null>(null);
  const [failed, setFailed] = useState(false);
  const babyName = state.profile.babyName || t("your_baby");

  async function handleExport(format: Format) {
    haptics.tap();
    setLoading(format);
    setFailed(false);
    try {
      if (format === "pdf") await exportAsPDF(state.profile, state.baby, language === "en" ? "en" : "sq", babyName);
      else await exportAsCSV(state.baby, babyName);
      haptics.success();
    } catch {
      setFailed(true);
    } finally {
      setLoading(null);
    }
  }

  const options: { format: Format; icon: IconName; title: TranslationKey; sub: TranslationKey }[] = [
    { format: "pdf", icon: "download", title: "export_pdf_title", sub: "export_pdf_sub" },
    { format: "csv", icon: "chart", title: "export_csv_title", sub: "export_csv_sub" },
  ];

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      <View className="flex-row items-center gap-3 px-4 pb-3 pt-2">
        <BackButton fallback="/(main)/baby" />
        <Text className="font-display text-xl text-ink">{t("export_title")}</Text>
      </View>

      <ScrollView className="flex-1 px-5" contentContainerStyle={{ paddingBottom: 40 }}>
        <Text className="mb-2 mt-2 font-bodySemibold text-base text-ink">{t("export_section")}</Text>
        <View style={shadows.soft} className="rounded-xl3 border border-ink/10 bg-surface px-5">
          {options.map((opt, i) => (
            <Pressable
              key={opt.format}
              disabled={!!loading}
              onPress={() => handleExport(opt.format)}
              accessibilityRole="button"
              className={`flex-row items-center py-3.5 active:opacity-70 ${i < options.length - 1 ? "border-b border-ink/8" : ""}`}
            >
              <View className="mr-3 h-10 w-10 items-center justify-center rounded-full bg-olive-bg">
                <Icon name={opt.icon} size={17} color="#6E7452" />
              </View>
              <View className="flex-1 pr-2">
                <Text className="font-bodySemibold text-[13.5px] text-ink">{t(opt.title)}</Text>
                <Text className="font-body text-xs leading-4 text-ink-soft">{t(opt.sub)}</Text>
              </View>
              {loading === opt.format ? <ActivityIndicator className="text-ink" /> : <Icon name="chevronRight" size={16} color="#A79D8A" />}
            </Pressable>
          ))}
        </View>
        {failed ? <Text className="mt-3 font-body text-xs text-orange">{t("export_failed")}</Text> : null}
        <Text className="mt-4 font-body text-[11px] leading-4 text-ink-faint">{t("export_note")}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}
