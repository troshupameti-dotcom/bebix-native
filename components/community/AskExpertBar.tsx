import { useEffect, useState } from "react";
import { View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { Icon } from "@/components/ui/Icon";
import { shadows } from "@/lib/shadows";
import { haptics } from "@/lib/haptics";
import { useThemeColors } from "@/lib/theme/useThemeColors";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { fetchQueue, fetchUnreadCount, isVerifiedExpert } from "@/lib/community/expertQuestions";

/**
 * "Pyet ekspertin" + "Pyetjet e mia" (me pikë të kuqe kur ka përgjigje të
 * palexuar). Ekspertëve të verifikuar u del edhe "Pyetje për përgjigje (N)".
 * `refreshKey` ndryshon me tërheqjen poshtë dhe kthimin te skeda.
 */
export function AskExpertBar({ refreshKey }: { refreshKey: number }) {
  const router = useRouter();
  const { t } = useTranslation();
  const theme = useThemeColors();
  const [unread, setUnread] = useState(0);
  const [queueCount, setQueueCount] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    void fetchUnreadCount().then((n) => alive && setUnread(n));
    void isVerifiedExpert().then(async (expert) => {
      if (!alive) return;
      if (!expert) return setQueueCount(null);
      try {
        const q = await fetchQueue();
        if (alive) setQueueCount(q.length);
      } catch {
        if (alive) setQueueCount(0);
      }
    });
    return () => {
      alive = false;
    };
  }, [refreshKey]);

  const go = (path: "/community/ask" | "/community/my-questions" | "/community/expert-inbox") => {
    haptics.tap();
    router.push(path);
  };

  return (
    <View className="mx-5 mt-3">
      <View className="flex-row" style={{ gap: 8 }}>
        <Pressable
          onPress={() => go("/community/ask")}
          accessibilityRole="button"
          style={shadows.soft}
          className="flex-1 flex-row items-center justify-center rounded-xl2 bg-surface px-3"
        >
          <View style={{ minHeight: 48 }} className="flex-row items-center">
            <Icon name="shield" size={16} color={theme.olive} />
            <Text className="ml-2 font-bodySemibold text-[13px] text-ink">{t("eq_ask_btn")}</Text>
          </View>
        </Pressable>
        <Pressable
          onPress={() => go("/community/my-questions")}
          accessibilityRole="button"
          accessibilityLabel={unread > 0 ? t("eq_my_unread_a11y", { n: unread }) : t("eq_my_btn")}
          style={shadows.soft}
          className="flex-1 flex-row items-center justify-center rounded-xl2 bg-surface px-3"
        >
          <View style={{ minHeight: 48 }} className="flex-row items-center">
            <Icon name="comment" size={16} color={theme.inkSoft} />
            <Text className="ml-2 font-bodySemibold text-[13px] text-ink">{t("eq_my_btn")}</Text>
            {unread > 0 ? <View className="ml-1.5 h-2.5 w-2.5 rounded-full bg-orange" /> : null}
          </View>
        </Pressable>
      </View>

      {queueCount !== null ? (
        <Pressable
          onPress={() => go("/community/expert-inbox")}
          accessibilityRole="button"
          style={shadows.soft}
          className="mt-2 flex-row items-center rounded-xl2 bg-olive px-4"
        >
          <View style={{ minHeight: 48 }} className="flex-1 flex-row items-center">
            <Icon name="comment" size={16} color={theme.onAccent} />
            <Text className="ml-2 flex-1 font-bodySemibold text-[13px] text-on-accent">{t("eq_inbox_btn", { n: queueCount })}</Text>
            <Icon name="chevronRight" size={16} color={theme.onAccent} />
          </View>
        </Pressable>
      ) : null}
    </View>
  );
}
