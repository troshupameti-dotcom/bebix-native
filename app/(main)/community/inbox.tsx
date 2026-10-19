import { useCallback, useState } from "react";
import { View, Text, FlatList, Pressable, ActivityIndicator, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { BackButton } from "@/components/ui/BackButton";
import { Avatar } from "@/components/community/PostCard";
import { haptics } from "@/lib/haptics";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { useThemeColors } from "@/lib/theme/useThemeColors";
import { timeAgoLabel } from "@/lib/i18n/timeAgo";
import { logWarn } from "@/lib/log";
import { fetchInbox, type InboxRow } from "@/lib/community/messages";

/**
 * Inbox-i: bisedat, më e reja para, me emrin, mesazhin e fundit dhe pikën për
 * të palexuarat. Bisedat nisin nga profili i dikujt që ndjek ose që të ndjek.
 */
export default function InboxScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const theme = useThemeColors();
  const [rows, setRows] = useState<InboxRow[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setRows((await fetchInbox()).rows);
    } catch (err) {
      logWarn("Inbox load error:", err);
      setRows((prev) => prev ?? []);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const preview = (r: InboxRow) => {
    const text = r.preview === "📸" ? t("dm_screenshot_preview") : r.preview;
    return r.fromMe ? `${t("dm_you")}: ${text}` : text;
  };

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      <View className="mb-2 flex-row items-center px-5 pt-2">
        <BackButton fallback="/(main)/community" className="mr-3" />
        <Text className="font-display text-xl text-ink">{t("dm_inbox")}</Text>
      </View>

      {rows === null ? <ActivityIndicator className="mt-10" color={theme.olive} /> : null}

      <FlatList
        data={rows ?? []}
        keyExtractor={(r) => r.id}
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
            tintColor={theme.olive}
            colors={[theme.olive]}
            progressBackgroundColor={theme.surface}
          />
        }
        ListEmptyComponent={
          rows ? (
            <View className="items-center px-10 py-12">
              <Text className="mb-1 text-center font-bodySemibold text-sm text-ink">{t("dm_empty_title")}</Text>
              <Text className="text-center font-body text-xs leading-5 text-ink-soft">{t("dm_empty_sub")}</Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => {
              haptics.tap();
              router.push(`/community/chat/${item.id}`);
            }}
            accessibilityRole="button"
            className="flex-row items-center px-5 py-3 active:opacity-70"
            style={{ minHeight: 68 }}
          >
            <Avatar initial={item.otherName.trim().charAt(0).toUpperCase() || "?"} accent={item.otherIsExpert ? "orange" : "olive"} size={48} userId={item.otherId} />
            <View className="ml-3 flex-1">
              <View className="flex-row items-center">
                <Text className={`flex-1 text-sm text-ink ${item.unread ? "font-bodySemibold" : "font-bodyMedium"}`} numberOfLines={1}>
                  {item.otherName}
                </Text>
                <Text className="ml-2 font-body text-[11px] text-ink-faint">{timeAgoLabel(item.lastAt, t)}</Text>
              </View>
              <View className="mt-0.5 flex-row items-center">
                <Text className={`flex-1 text-xs ${item.unread ? "font-bodyMedium text-ink" : "font-body text-ink-soft"}`} numberOfLines={1}>
                  {preview(item)}
                </Text>
                {item.unread ? <View className="ml-2 h-2.5 w-2.5 rounded-full bg-orange" accessibilityLabel={t("dm_unread")} /> : null}
              </View>
            </View>
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}
