import { useCallback, useState } from "react";
import { View, Text, ScrollView, Pressable, ActivityIndicator, RefreshControl, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { BackButton } from "@/components/ui/BackButton";
import { ExpertBadge } from "@/components/community/ExpertBadge";
import { shadows } from "@/lib/shadows";
import { haptics } from "@/lib/haptics";
import { useThemeColors } from "@/lib/theme/useThemeColors";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { timeAgoLabel } from "@/lib/i18n/timeAgo";
import { logWarn } from "@/lib/log";
import { useSpecialties } from "@/lib/community/useSpecialties";
import { specialtyLabel } from "@/lib/community/specialties";
import {
  canClose, closeQuestion, deleteQuestion, errorKey, fetchMyQuestions, markAnswerRead, statusKey, type MyQuestion,
} from "@/lib/community/expertQuestions";

/**
 * "Pyetjet e mia": statusi (Në pritje / U përgjigj / E mbyllur), reparti,
 * përgjigjja me emrin dhe repartin e ekspertit. Hapja e ekranit i shënon
 * përgjigjet si të lexuara ("E re" mbetet deri në hapjen tjetër). Prindi e
 * mbyll pyetjen në pritje ose e fshin.
 */
export default function MyQuestionsScreen() {
  const router = useRouter();
  const { t, language } = useTranslation();
  const theme = useThemeColors();
  const specialties = useSpecialties();
  const [list, setList] = useState<MyQuestion[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const q = await fetchMyQuestions();
      setList(q);
      if (q.some((x) => x.unread)) await markAnswerRead();
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

  function confirmClose(q: MyQuestion) {
    haptics.tap();
    Alert.alert(t("eq_close_title"), t("eq_close_body"), [
      { text: t("cancel"), style: "cancel" },
      {
        text: t("eq_close"),
        onPress: async () => {
          try {
            await closeQuestion(q.id);
            haptics.success();
          } catch (err) {
            Alert.alert(t("mod_error_title"), t(errorKey(err)));
          }
          void load();
        },
      },
    ]);
  }

  function confirmDelete(q: MyQuestion) {
    haptics.warning();
    Alert.alert(t("eq_delete_title"), t("eq_delete_body"), [
      { text: t("cancel"), style: "cancel" },
      {
        text: t("eq_delete"),
        style: "destructive",
        onPress: async () => {
          try {
            await deleteQuestion(q.id);
            setList((prev) => (prev ?? []).filter((x) => x.id !== q.id));
          } catch (err) {
            Alert.alert(t("mod_error_title"), t(errorKey(err)));
            void load();
          }
        },
      },
    ]);
  }

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
        {list === null ? <ActivityIndicator className="mt-10" color={theme.olive} /> : null}

        {list && list.length === 0 ? (
          <View className="items-center px-6 py-10">
            <Text className="mb-1 text-center font-bodySemibold text-sm text-ink">{t("eq_my_empty_title")}</Text>
            <Text className="mb-4 text-center font-body text-xs leading-5 text-ink-soft">{t("eq_my_empty_sub")}</Text>
            <Pressable
              onPress={() => {
                haptics.tap();
                router.push("/community/ask-expert");
              }}
              accessibilityRole="button"
              className="items-center justify-center rounded-full bg-olive px-5"
              style={{ minHeight: 48 }}
            >
              <Text className="font-bodySemibold text-xs text-on-accent">{t("eq_ask_btn")}</Text>
            </Pressable>
          </View>
        ) : null}

        {list?.map((q) => {
          const answered = q.status === "answered";
          const closed = q.status === "closed";
          return (
            <View key={q.id} style={shadows.soft} className="mb-4 rounded-xl2 bg-surface p-4">
              <View className="mb-2 flex-row flex-wrap items-center" style={{ gap: 8 }}>
                <View className={`rounded-full px-2.5 py-1 ${answered ? "bg-olive-bg" : "bg-cream-soft"}`}>
                  <Text className={`font-bodySemibold text-[11px] ${answered ? "text-olive" : "text-ink-soft"}`}>{t(statusKey(q.status))}</Text>
                </View>
                <Text className="font-body text-[11px] text-ink-faint">
                  {specialtyLabel(q.specialty, language, specialties.list) ?? q.specialty} · {timeAgoLabel(q.createdAt, t)}
                </Text>
                {q.unread ? <Text className="ml-auto font-bodySemibold text-[11px] text-orange">{t("eq_new")}</Text> : null}
              </View>
              <Text className="font-body text-sm leading-5 text-ink">{q.body}</Text>
              {q.babyAgeMonths !== null ? <Text className="mt-1 font-body text-[11px] text-ink-faint">{t("eq_baby_age", { n: q.babyAgeMonths })}</Text> : null}

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
                <Text className="mt-2 font-body text-xs text-ink-faint">{t(closed ? "eq_closed_hint" : "eq_waiting_hint")}</Text>
              )}

              <View className="mt-3 flex-row justify-end" style={{ gap: 8 }}>
                {canClose(q.status) ? (
                  <Pressable
                    onPress={() => confirmClose(q)}
                    accessibilityRole="button"
                    className="items-center justify-center rounded-full bg-cream-soft px-4"
                    style={{ minHeight: 48 }}
                  >
                    <Text className="font-bodySemibold text-xs text-ink">{t("eq_close")}</Text>
                  </Pressable>
                ) : null}
                <Pressable
                  onPress={() => confirmDelete(q)}
                  accessibilityRole="button"
                  className="items-center justify-center rounded-full px-4"
                  style={{ minHeight: 48 }}
                >
                  <Text className="font-bodySemibold text-xs text-orange">{t("eq_delete")}</Text>
                </Pressable>
              </View>
            </View>
          );
        })}

        {list && list.length > 0 ? <Text className="px-2 text-center font-body text-[11px] leading-4 text-ink-faint">{t("eq_disclaimer")}</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
}
