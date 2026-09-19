import { View, Text, Pressable, FlatList } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { BackButton } from "@/components/ui/BackButton";
import { Icon } from "@/components/ui/Icon";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { timeAgoLabel } from "@/lib/i18n/timeAgo";
import { useInbox, type InboxEntry } from "@/lib/notifications/useInbox";
import { haptics } from "@/lib/haptics";
import { shadows } from "@/lib/shadows";

/**
 * Lista e njoftimeve (zilja te Home). Njoftimet ndërtohen nga historiku i
 * bebit — vaksina që afrojnë, kohë nga ushqyerja, gjumi dhe pelena e fundit —
 * dhe secili të çon te ekrani përkatës.
 */
export default function NotificationsInboxScreen() {
  const { t } = useLanguage();
  const { entries, unreadCount, markRead, markAllRead } = useInbox();

  function open(entry: InboxEntry) {
    haptics.tap();
    markRead(entry.id);
    router.push(entry.route);
  }

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      <View className="flex-row items-center px-5 pt-2 mb-4">
        <BackButton fallback="/(main)/baby" className="mr-3" />
        <Text className="flex-1 font-display text-xl text-ink">{t("inbox_title")}</Text>
      </View>

      <FlatList
        data={entries}
        keyExtractor={(e) => e.id}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40, flexGrow: 1 }}
        ItemSeparatorComponent={() => <View className="h-2.5" />}
        ListHeaderComponent={
          unreadCount > 0 ? (
            <Pressable
              onPress={() => {
                haptics.select();
                markAllRead();
              }}
              accessibilityRole="button"
              className="mb-3 self-end py-1"
            >
              <Text className="font-bodyMedium text-xs text-olive">{t("inbox_mark_all")}</Text>
            </Pressable>
          ) : null
        }
        ListEmptyComponent={
          <View className="flex-1 items-center justify-center px-6 pb-16">
            <View className="mb-4 h-16 w-16 items-center justify-center rounded-full bg-olive-bg">
              <Icon name="bell" size={26} color="#6E7452" />
            </View>
            <Text className="font-bodySemibold text-base text-ink">{t("inbox_empty_title")}</Text>
            <Text className="mt-1.5 text-center font-body text-sm text-ink-soft">{t("inbox_empty_sub")}</Text>
          </View>
        }
        renderItem={({ item }) => <InboxRow entry={item} onPress={() => open(item)} />}
        ListFooterComponent={
          <Pressable
            onPress={() => router.push("/(main)/more/notifications")}
            accessibilityRole="button"
            className="mt-6 flex-row items-center justify-center gap-1.5 py-2"
          >
            <Text className="font-bodyMedium text-xs text-ink-faint">{t("inbox_settings_link")}</Text>
            <Icon name="chevronRight" size={13} color="#7A7062" />
          </Pressable>
        }
      />
    </SafeAreaView>
  );
}

function InboxRow({ entry, onPress }: { entry: InboxEntry; onPress: () => void }) {
  const { t } = useLanguage();
  const isOrange = entry.accent === "orange";

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${entry.title}. ${entry.body}`}
      style={shadows.soft}
      className="flex-row items-start rounded-xl2 bg-surface p-4 active:opacity-80"
    >
      <View
        className={`mr-3 h-10 w-10 items-center justify-center rounded-full ${isOrange ? "bg-orange-bg" : "bg-olive-bg"}`}
      >
        <Icon name={entry.icon} size={18} color={isOrange ? "#C9702E" : "#6E7452"} />
      </View>

      <View className="flex-1">
        <View className="flex-row items-center">
          <Text
            numberOfLines={1}
            className={`flex-1 text-sm text-ink ${entry.read ? "font-bodyMedium" : "font-bodySemibold"}`}
          >
            {entry.title}
          </Text>
          <Text className="ml-2 font-body text-[11px] text-ink-faint">{timeAgoLabel(entry.at, t)}</Text>
        </View>
        <Text numberOfLines={2} className="mt-0.5 font-body text-xs text-ink-soft">
          {entry.body}
        </Text>
      </View>

      {!entry.read ? <View className="ml-2 mt-1.5 h-2 w-2 rounded-full bg-orange" /> : null}
    </Pressable>
  );
}
