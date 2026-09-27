import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Icon } from "@/components/ui/Icon";
import { retrySync, useSyncStatus } from "@/lib/baby/syncStatus";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { timeAgoLabel } from "@/lib/i18n/timeAgo";

/**
 * Rresht i vogël që i thotë prindit nëse shënimet kanë arritur në llogari
 * (dhe pra te webi / te partneri). Pa internet, shënimet mbeten në telefon
 * dhe dërgohen vetë kur kthehet lidhja — kjo i thuhet qartë, që prindi të
 * mos i rishkruajë.
 */
export function SyncBadge() {
  const { t } = useTranslation();
  const { phase, lastSyncedAt } = useSyncStatus();

  // "para 2 min" duhet të ecë edhe kur s'ndodh asgjë tjetër në ekran.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  if (phase === "idle" && !lastSyncedAt) return null;

  if (phase === "error") {
    return (
      <Pressable onPress={retrySync} hitSlop={6} className="mt-2 flex-row items-center gap-1.5 self-start">
        <View className="h-1.5 w-1.5 rounded-full bg-[#C98A5B]" />
        <Text className="font-body text-[11.5px] text-ink-soft">{t("sync_offline")}</Text>
        <Text className="font-bodySemibold text-[11.5px] text-olive">{t("sync_retry")}</Text>
      </Pressable>
    );
  }

  const label =
    phase === "syncing" && !lastSyncedAt
      ? t("sync_syncing")
      : t("sync_done", { when: timeAgoLabel(lastSyncedAt ? new Date(lastSyncedAt).toISOString() : null, t, now).toLowerCase() });

  return (
    <View className="mt-2 flex-row items-center gap-1.5 self-start">
      <Icon name="check" size={11} color="#6E7452" />
      <Text className="font-body text-[11.5px] text-ink-faint">{label}</Text>
    </View>
  );
}
