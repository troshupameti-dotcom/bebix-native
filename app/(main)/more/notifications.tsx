import { View, Text, ScrollView } from "react-native";
import { ThemedSwitch } from "@/components/ui/ThemedSwitch";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack } from "expo-router";
import { useAppState } from "@/lib/state/AppStateContext";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { Icon, IconName } from "@/components/ui/Icon";
import { shadows } from "@/lib/shadows";
import type { NotificationPrefs } from "@/lib/state/types";
import type { TranslationKey } from "@/lib/i18n/translations";

type ToggleRow = {
  key: keyof NotificationPrefs;
  icon: IconName;
  labelKey: TranslationKey;
};

function ToggleGroup({
  title,
  rows,
  prefs,
  onToggle,
  t,
  isLast,
}: {
  title: string;
  rows: ToggleRow[];
  prefs: NotificationPrefs;
  onToggle: (key: keyof NotificationPrefs, value: boolean) => void;
  t: (k: TranslationKey) => string;
  isLast?: boolean;
}) {
  return (
    <View className={isLast ? "mb-2" : "mb-6"}>
      <Text className="font-bodyMedium text-xs text-ink-faint uppercase px-5 mb-2">{title}</Text>
      <View className="mx-5 bg-surface rounded-xl2 overflow-hidden" style={shadows.soft}>
        {rows.map((r, i) => (
          <View
            key={r.key}
            className={`flex-row items-center px-4 py-3.5 ${
              i < rows.length - 1 ? "border-b border-cream-line" : ""
            }`}
          >
            <View className="w-8 h-8 rounded-full bg-cream-soft items-center justify-center mr-3">
              <Icon name={r.icon} size={16} color="#6E7452" />
            </View>
            <Text className="font-bodyMedium text-sm text-ink flex-1">{t(r.labelKey)}</Text>
            <ThemedSwitch
              value={prefs[r.key]}
              onValueChange={(value) => onToggle(r.key, value)}
            />
          </View>
        ))}
      </View>
    </View>
  );
}

export default function NotificationsScreen() {
  const { state, setNotificationPref } = useAppState();
  const { t } = useLanguage();
  const prefs = state.notificationPrefs;

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      <Stack.Screen options={{ title: t("notif_title") }} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: 16, paddingBottom: 40 }}>
        <ToggleGroup
          title={t("notif_channels")}
          t={t}
          prefs={prefs}
          onToggle={setNotificationPref}
          rows={[
            { key: "pushEnabled", icon: "bell", labelKey: "notif_push" },
            { key: "emailEnabled", icon: "comment", labelKey: "notif_email" },
            { key: "smsEnabled", icon: "comment", labelKey: "notif_sms" },
          ]}
        />

        <ToggleGroup
          title={t("notif_baby")}
          t={t}
          prefs={prefs}
          onToggle={setNotificationPref}
          rows={[
            { key: "medicineReminders", icon: "shield", labelKey: "notif_medicine" },
            { key: "vaccinationReminders", icon: "syringe", labelKey: "notif_vaccination" },
            { key: "sleepReminders", icon: "moon", labelKey: "notif_sleep" },
            { key: "feedingReminders", icon: "sparkle", labelKey: "notif_feeding" },
          ]}
        />

        <ToggleGroup
          title={t("notif_shopping")}
          t={t}
          prefs={prefs}
          onToggle={setNotificationPref}
          rows={[
            { key: "shoppingNotifications", icon: "cube", labelKey: "notif_shopping_updates" },
            { key: "deliveryUpdates", icon: "cube", labelKey: "notif_delivery" },
          ]}
        />

        <ToggleGroup
          title={t("notif_community")}
          t={t}
          prefs={prefs}
          onToggle={setNotificationPref}
          rows={[
            { key: "communityNotifications", icon: "family", labelKey: "notif_community_notif" },
            { key: "aiRecommendations", icon: "sparkle", labelKey: "notif_ai" },
          ]}
        />

        <ToggleGroup
          title={t("notif_reports")}
          t={t}
          prefs={prefs}
          onToggle={setNotificationPref}
          rows={[
            { key: "weeklyReports", icon: "chart", labelKey: "notif_weekly" },
            { key: "monthlyReports", icon: "chart", labelKey: "notif_monthly" },
          ]}
        />

        <ToggleGroup
          title={t("notif_other")}
          t={t}
          prefs={prefs}
          onToggle={setNotificationPref}
          isLast
          rows={[
            { key: "marketing", icon: "flame", labelKey: "notif_marketing" },
            { key: "emergencyAlerts", icon: "shield", labelKey: "notif_emergency" },
          ]}
        />
      </ScrollView>
    </SafeAreaView>
  );
}