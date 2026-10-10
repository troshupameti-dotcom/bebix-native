import { useCallback, useState } from "react";
import { View, Text, ScrollView, Pressable, ActivityIndicator, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { BackButton } from "@/components/ui/BackButton";
import { ExpertBadge } from "@/components/community/ExpertBadge";
import { shadows } from "@/lib/shadows";
import { useThemeColors } from "@/lib/theme/useThemeColors";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { timeAgoLabel } from "@/lib/i18n/timeAgo";
import { logWarn } from "@/lib/log";
import { categoryKey, fetchMyQuestions, markAnswersRead, statusKey, type MyQuestion } from "@/lib/community/expertQuestions";

/**
 * "Pyetjet e mia": statusi (Në pritje / U përgjigj), përgjigjja me emrin dhe
 * repartin e ekspertit. Hapja e ekranit i shënon përgjigjet si të lexuara
 * (pika e kuqe te butoni zhduket).
 */
export default function MyQuestionsScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const theme = useThemeColors();
  const [list, setList] = useState<MyQuestion[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const q = await fetchMyQuestions();
      setList(q);
      // Përgjigjet e reja i kemi treguar: tani janë të lexuara (shenja "E re" mbetet deri në hapjen tjetër).
      if (q.some((x) => x.unread)) await markAnswersRead();
    } catch (err) {
      logWarn("My expert questions load error:", err);
      setList((prev) => prev ?? []);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      <View className="mb-2 flex-row items-center px-5 pt-2">
        <BackButton fallback="/(main)/community" className="mr-3" />
        <Text className="font-display text-xl text-ink">{t("eq_my_btn")}</Text>
      </View>

      <ScrollView
        className="flex-1 px-5"
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
      >
        {list === null ? <ActivityIndicator className="mt-10 text-olive" /> : null}

        {list && list.length === 0 ? (
          <View className="items-center px-6 py-10">
            <Text className="mb-1 text-center font-bodySemibold text-sm text-ink">{t("eq_my_empty_title")}</Text>
            <Text className="mb-4 text-center font-body text-xs leading-5 text-ink-soft">{t("eq_my_empty_sub")}</Text>
            <Pressable onPress={() => router.push("/community/ask")} className="rounded-full bg-olive px-5 py-2.5">
              <Text className="font-bodySemibold text-xs text-on-accent">{t("eq_ask_btn")}</Text>
            </Pressable>
          </View>
        ) : null}

        {list?.map((q) => {
          const answered = q.status === "answered";
          return (
            <View key={q.id} style={shadows.soft} className="mb-4 rounded-xl2 bg-surface p-4">
              <View className="mb-2 flex-row items-center" style={{ gap: 8 }}>
                <View className={`rounded-full px-2.5 py-1 ${answered ? "bg-olive-bg" : "bg-cream-soft"}`}>
                  <Text className={`font-bodySemibold text-[11px] ${answered ? "text-olive" : "text-ink-soft"}`}>{t(statusKey(q.status))}</Text>
                </View>
                <Text className="font-body text-[11px] text-ink-faint">
                  {t(categoryKey(q.category))} · {timeAgoLabel(q.createdAt, t)}
                </Text>
                {q.unread ? <Text className="ml-auto font-bodySemibold text-[11px] text-orange">{t("eq_new")}</Text> : null}
              </View>
              <Text className="font-body text-sm leading-5 text-ink">{q.body}</Text>

              {answered && q.answer ? (
                <View className="mt-3 rounded-xl border-l-[3px] border-olive bg-cream-soft px-3 py-2.5">
                  {q.expert ? (
                    <View className="mb-1 flex-row flex-wrap items-center" style={{ gap: 6 }}>
                      <ExpertBadge specialty={q.expert.badge.specialty} kind={q.expert.badge.kind} compact />
                      <Text className="font-bodySemibold text-xs text-ink">{q.expert.name}</Text>
                    </View>
                  ) : null}
                  <Text className="font-body text-[13px] leading-5 text-ink">{q.answer}</Text>
                  {q.answeredAt ? <Text className="mt-1 font-body text-[10px] text-ink-faint">{timeAgoLabel(q.answeredAt, t)}</Text> : null}
                </View>
              ) : (
                <Text className="mt-2 font-body text-xs text-ink-faint">{t("eq_waiting_hint")}</Text>
              )}

              {q.publish ? <Text className="mt-2 font-body text-[11px] text-ink-faint">{t(answered ? "eq_published_note" : "eq_will_publish_note")}</Text> : null}
            </View>
          );
        })}

        {list && list.length > 0 ? <Text className="px-2 text-center font-body text-[11px] leading-4 text-ink-faint">{t("eq_disclaimer")}</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
}
