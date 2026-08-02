import { View, Text, ScrollView, Pressable, Switch } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAppState } from "@/lib/state/AppStateContext";
import { NotificationPrefs } from "@/lib/state/types";
import { Icon } from "@/components/ui/Icon";
import { shadows } from "@/lib/shadows";

const GROUPS: { title: string; rows: { key: keyof NotificationPrefs; label: string }[] }[] = [
  {
    title: "Kanalet",
    rows: [
      { key: "pushEnabled", label: "Njoftime Push" },
      { key: "emailEnabled", label: "Njoftime me Email" },
      { key: "smsEnabled", label: "Njoftime me SMS" },
    ],
  },
  {
    title: "Kujtesat e Bebit",
    rows: [
      { key: "feedingReminders", label: "Ushqyerje" },
      { key: "sleepReminders", label: "Gjumë" },
      { key: "medicineReminders", label: "Ilaçe" },
      { key: "vaccinationReminders", label: "Vaksina" },
    ],
  },
  {
    title: "Dyqani",
    rows: [
      { key: "shoppingNotifications", label: "Oferta & Njoftime Dyqani" },
      { key: "deliveryUpdates", label: "Përditësime Dërgese" },
    ],
  },
  {
    title: "Komuniteti & AI",
    rows: [
      { key: "communityNotifications", label: "Aktiviteti i Komunitetit" },
      { key: "aiRecommendations", label: "Rekomandime AI" },
    ],
  },
  {
    title: "Raporte",
    rows: [
      { key: "weeklyReports", label: "Raport Javor" },
      { key: "monthlyReports", label: "Raport Mujor" },
    ],
  },
  {
    title: "Të Tjera",
    rows: [
      { key: "marketing", label: "Marketing & Promocione" },
      { key: "emergencyAlerts", label: "Alarme Urgjente" },
    ],
  },
];

export default function NotificationsScreen() {
  const router = useRouter();
  const { state, setNotificationPref } = useAppState();

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      <View className="flex-row items-center px-5 pt-2 mb-4">
        <Pressable onPress={() => router.back()} style={shadows.soft} className="w-10 h-10 rounded-full bg-surface items-center justify-center mr-3">
          <Icon name="chevronLeft" size={18} color="#2C271F" />
        </Pressable>
        <Text className="font-display text-xl text-ink">Njoftimet</Text>
      </View>

      <View className="mx-5 mb-4 bg-olive-bg rounded-xl2 p-3" style={shadows.soft}>
        <Text className="font-body text-xs text-ink-soft leading-5">
          Preferencat këtu ruhen realisht. Dërgimi aktual i push/email/SMS ende s'është lidhur (kërkon backend) — kur të lidhet, do ta respektojë saktësisht çfarë zgjedh këtu.
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {GROUPS.map((group) => (
          <View key={group.title} className="mb-5">
            <Text className="font-bodySemibold text-xs text-ink-faint uppercase px-5 mb-2">{group.title}</Text>
            <View style={shadows.soft} className="mx-5 bg-surface rounded-xl2 overflow-hidden">
              {group.rows.map((row, i) => (
                <View
                  key={row.key}
                  className={`flex-row items-center justify-between px-4 py-3 ${i < group.rows.length - 1 ? "border-b border-cream-line" : ""}`}
                >
                  <Text className="font-bodyMedium text-sm text-ink">{row.label}</Text>
                  <Switch
                    value={state.notificationPrefs[row.key]}
                    onValueChange={(v) => setNotificationPref(row.key, v)}
                    trackColor={{ false: "#E9DFCC", true: "#6E7452" }}
                    thumbColor="#FFFFFF"
                  />
                </View>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}