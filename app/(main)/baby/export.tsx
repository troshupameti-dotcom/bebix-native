import { useState } from "react";
import { View, Text, Pressable, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Icon, IconName } from "@/components/ui/Icon";
import { useAppState } from "@/lib/state/AppStateContext";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { haptics } from "@/lib/haptics";
import { shadows } from "@/lib/shadows";
import { exportAsPDF, exportAsCSV, exportAsJSON } from "@/lib/export";

type Format = "pdf" | "csv" | "json";

export default function ExportScreen() {
  const { t } = useTranslation();
  const { state } = useAppState();
  const [loading, setLoading] = useState<Format | null>(null);
  const babyName = state.profile.babyName || "Baby";

  async function handleExport(format: Format) {
    haptics.tap();
    setLoading(format);
    try {
      if (format === "pdf") await exportAsPDF(state.baby, babyName);
      else if (format === "csv") await exportAsCSV(state.baby, babyName);
      else await exportAsJSON(state.baby, babyName);
      haptics.success();
    } catch {
      // Sharing cancelled or unavailable — no-op.
    } finally {
      setLoading(null);
    }
  }

  const options: { format: Format; icon: IconName; labelKey: string }[] = [
    { format: "pdf", icon: "download", labelKey: "export_pdf" },
    { format: "csv", icon: "chart", labelKey: "export_csv" },
    { format: "json", icon: "cube", labelKey: "export_json" },
  ];

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      <View className="flex-row items-center gap-3 px-4 pb-3 pt-2">
        <Pressable onPress={() => router.back()} hitSlop={8} className="h-9 w-9 items-center justify-center">
          <Icon name="chevronLeft" size={20} color="#2C271F" />
        </Pressable>
        <Text className="font-display text-xl text-ink">{t("export_title")}</Text>
      </View>

      <View className="gap-3 px-5 pt-4">
        {options.map((opt) => (
          <Pressable
            key={opt.format}
            disabled={!!loading}
            onPress={() => handleExport(opt.format)}
            style={shadows.soft}
            className="flex-row items-center gap-3.5 rounded-xl2 border border-ink/10 bg-white p-4"
          >
            <View className="h-11 w-11 items-center justify-center rounded-xl bg-olive-bg">
              <Icon name={opt.icon} size={19} color="#6E7452" />
            </View>
            <Text className="flex-1 font-bodySemibold text-[15px] text-ink">{t(opt.labelKey as never)}</Text>
            {loading === opt.format ? <ActivityIndicator color="#2C271F" /> : <Icon name="chevronRight" size={16} color="#A79D8A" />}
          </Pressable>
        ))}
      </View>
    </SafeAreaView>
  );
}
