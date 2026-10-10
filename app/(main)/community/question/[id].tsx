import { useCallback, useRef, useState } from "react";
import { View, Text, ScrollView, Pressable, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator, Alert, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useFocusEffect } from "expo-router";
import { useAppState } from "@/lib/state/AppStateContext";
import { shadows } from "@/lib/shadows";
import { haptics } from "@/lib/haptics";
import { useCurrentUserId } from "@/lib/hooks/useCurrentUserId";
import { Icon } from "@/components/ui/Icon";
import { Avatar } from "@/components/community/PostCard";
import { ExpertBadge } from "@/components/community/ExpertBadge";
import { timeAgoLabel } from "@/lib/i18n/timeAgo";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { useThemeColors } from "@/lib/theme/useThemeColors";
import { BackButton, goBackOr } from "@/components/ui/BackButton";
import { logWarn } from "@/lib/log";
import { friendlyError } from "@/lib/errors/userMessage";
import { blockUser } from "@/lib/communityData";
import {
  ANSWER_MAX, cleanAnswer, deleteAnswer, fetchAnswers, fetchQuestionById, localDateKey, saveAnswer,
  type DailyAnswer, type DailyQuestion,
} from "@/lib/community/dailyQuestion";

function AnswerRow({ answer, mine, onLongPress, t }: { answer: DailyAnswer; mine: boolean; onLongPress: () => void; t: (key: any, params?: Record<string, string | number>) => string }) {
  const initial = answer.authorName.trim().charAt(0).toUpperCase() || "?";
  return (
    <View className="mb-4 flex-row">
      <Avatar initial={initial} accent={mine ? "orange" : "olive"} size={36} />
      <View className="ml-2.5 flex-1">
        <Pressable
          onLongPress={mine ? undefined : onLongPress}
          delayLongPress={350}
          style={shadows.soft}
          className={`rounded-xl2 bg-surface px-3 py-2.5 ${answer.expert ? "border-l-[3px] border-olive" : ""}`}
        >
          {answer.expert ? <ExpertBadge specialty={answer.expert.specialty} kind={answer.expert.kind} compact /> : null}
          <Text className="mb-0.5 font-bodySemibold text-xs text-ink">{mine ? `${answer.authorName} · ${t("dq_you")}` : answer.authorName}</Text>
          <Text className="font-body text-[13px] leading-5 text-ink-soft">{answer.text}</Text>
        </Pressable>
        <Text className="ml-1 mt-1.5 font-body text-[10px] text-ink-faint">
          {timeAgoLabel(answer.at, t)}
          {answer.edited ? ` · ${t("dq_edited")}` : ""}
        </Text>
      </View>
    </View>
  );
}

/**
 * Pyetja e ditës: të gjitha përgjigjet dhe fusha e përgjigjes (≤ 280
 * shkronja, një për prind — "Ndrysho" e mbishkruan). Pyetjet e ditëve të
 * kaluara lexohen, por s'pranojnë përgjigje të reja.
 */
export default function DailyQuestionScreen() {
  const { t, language } = useTranslation();
  const theme = useThemeColors();
  const { id, compose } = useLocalSearchParams<{ id: string; compose?: string }>();
  const { state } = useAppState();
  const myId = useCurrentUserId();
  const inputRef = useRef<TextInput>(null);
  // "Ndrysho përgjigjen" nga karta: hapet një herë drejt e në ndryshim.
  const composeHandled = useRef(false);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [question, setQuestion] = useState<DailyQuestion | null>(null);
  const [answers, setAnswers] = useState<DailyAnswer[]>([]);
  const [mine, setMine] = useState<DailyAnswer | null>(null);
  const [draft, setDraft] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const load = useCallback(
    async (quiet = false) => {
      if (!id) return;
      if (!quiet) setLoading(true);
      try {
        const [q, a] = await Promise.all([fetchQuestionById(id, language === "en" ? "en" : "sq"), fetchAnswers(id)]);
        setQuestion(q);
        setAnswers(a.answers);
        setMine(a.mine);
        if (compose === "1" && !composeHandled.current) {
          composeHandled.current = true;
          if (a.mine) setDraft(a.mine.text);
        }
      } catch (err) {
        logWarn("Daily question detail load error:", err);
      } finally {
        setLoading(false);
      }
    },
    [id, language, compose]
  );

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load(true);
    setRefreshing(false);
  }, [load]);

  // Pyetjet e ditëve të tjera lexohen, por përgjigjet pranohen vetëm sot (si në server, ±1 ditë).
  const open = !!question && Math.abs(new Date(`${question.date}T12:00:00`).getTime() - new Date(`${localDateKey()}T12:00:00`).getTime()) <= 86_400_000;
  const editing = draft !== null;
  const text = draft ?? "";
  const canSend = !!cleanAnswer(text) && !sending;
  const others = answers.filter((a) => a.authorId !== myId);

  function startEdit() {
    haptics.select();
    setDraft(mine?.text ?? "");
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  async function send() {
    if (!canSend || !id) return;
    setSending(true);
    try {
      await saveAnswer(id, text, state.profile.parentName ?? "");
      haptics.success();
      setDraft(null);
      await load(true);
    } catch (err) {
      Alert.alert(t("mod_error_title"), friendlyError(err, t, "dq_save_failed"));
    } finally {
      setSending(false);
    }
  }

  function remove() {
    if (!mine) return;
    Alert.alert(t("dq_delete_title"), t("dq_delete_body"), [
      { text: t("cancel_action"), style: "cancel" },
      {
        text: t("delete_action"),
        style: "destructive",
        onPress: async () => {
          try {
            await deleteAnswer(mine.id);
            setMine(null);
            setDraft(null);
            await load(true);
          } catch (err) {
            Alert.alert(t("mod_error_title"), friendlyError(err, t, "dq_save_failed"));
          }
        },
      },
    ]);
  }

  function block(a: DailyAnswer) {
    haptics.select();
    Alert.alert(t("dq_block_title", { name: a.authorName }), t("dq_block_body"), [
      { text: t("cancel_action"), style: "cancel" },
      {
        text: t("dq_block_action"),
        style: "destructive",
        onPress: async () => {
          try {
            await blockUser(a.authorId);
            await load(true);
          } catch (err) {
            Alert.alert(t("mod_error_title"), friendlyError(err, t, "dq_save_failed"));
          }
        },
      },
    ]);
  }

  if (loading && !question) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-cream">
        <ActivityIndicator className="text-olive" />
      </SafeAreaView>
    );
  }

  if (!question) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-cream px-8">
        <Text className="mb-6 text-center font-bodySemibold text-base text-ink">{t("dq_not_found")}</Text>
        <Pressable onPress={() => goBackOr("/(main)/community")} className="rounded-full bg-olive px-5 py-3">
          <Text className="font-bodySemibold text-sm text-on-accent">{t("cpost_back")}</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      <View className="mb-2 flex-row items-center px-5 pt-2">
        <BackButton fallback="/(main)/community" className="mr-3" />
        <Text className="font-display text-xl text-ink">{t("dq_label")}</Text>
      </View>

      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={90}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 24 }}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.olive} colors={[theme.olive]} progressBackgroundColor={theme.surface} />}
        >
          <View style={shadows.soft} className="mx-5 mb-4 rounded-xl2 bg-surface p-4">
            <Text className="font-bodySemibold text-[17px] leading-7 text-ink">{question.text}</Text>
            <Text className="mt-1 font-body text-xs text-ink-faint">
              {answers.length === 1 ? t("dq_count_one") : t("dq_count", { n: answers.length })}
            </Text>
          </View>

          <View className="px-5">
            {mine && !editing ? (
              <View className="mb-2">
                <AnswerRow answer={mine} mine onLongPress={() => {}} t={t} />
                {open ? (
                  <View className="-mt-2 mb-4 ml-11 flex-row" style={{ gap: 16 }}>
                    <Pressable onPress={startEdit} hitSlop={10} accessibilityRole="button" style={{ minHeight: 32, justifyContent: "center" }}>
                      <Text className="font-bodySemibold text-xs text-olive">{t("dq_edit_answer")}</Text>
                    </Pressable>
                    <Pressable onPress={remove} hitSlop={10} accessibilityRole="button" style={{ minHeight: 32, justifyContent: "center" }}>
                      <Text className="font-bodyMedium text-xs text-orange">{t("delete_action")}</Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>
            ) : null}

            {others.length === 0 && !mine ? (
              <Text className="mb-4 font-body text-xs text-ink-faint">{t("dq_be_first")}</Text>
            ) : (
              others.map((a) => <AnswerRow key={a.id} answer={a} mine={false} onLongPress={() => block(a)} t={t} />)
            )}
          </View>
        </ScrollView>

        {open && (!mine || editing) ? (
          <View className="border-t border-cream-line bg-cream px-5 pb-3 pt-2">
            <View style={shadows.soft} className="flex-row items-end rounded-xl2 bg-surface px-3 py-2">
              <TextInput
                ref={inputRef}
                value={text}
                onChangeText={(v) => setDraft(v)}
                placeholder={t("dq_placeholder")}
                placeholderTextColor={theme.inkFaint}
                multiline
                maxLength={ANSWER_MAX}
                autoFocus={compose === "1"}
                className="max-h-28 flex-1 py-1.5 font-body text-sm text-ink"
              />
              <Pressable
                onPress={() => void send()}
                disabled={!canSend}
                accessibilityRole="button"
                accessibilityLabel={t("cpost_send")}
                className={`ml-2 h-9 w-9 items-center justify-center rounded-full ${canSend ? "bg-olive" : "bg-cream-line"}`}
              >
                {sending ? <ActivityIndicator className="text-on-accent" size="small" /> : <Icon name="send" size={16} color={canSend ? "#FFFFFF" : theme.inkFaint} />}
              </Pressable>
            </View>
            <View className="mt-1.5 flex-row items-center justify-between px-1">
              {editing && mine ? (
                <Pressable onPress={() => setDraft(null)} hitSlop={10} accessibilityRole="button">
                  <Text className="font-bodyMedium text-[11px] text-ink-faint">{t("cancel_action")}</Text>
                </Pressable>
              ) : (
                <Text className="font-body text-[11px] text-ink-faint">{t("dq_one_answer_hint")}</Text>
              )}
              <Text className={`font-body text-[11px] ${text.length > ANSWER_MAX - 20 ? "text-orange" : "text-ink-faint"}`}>
                {text.length}/{ANSWER_MAX}
              </Text>
            </View>
          </View>
        ) : null}
        {!open ? (
          <View className="border-t border-cream-line px-5 py-3">
            <Text className="text-center font-body text-xs text-ink-faint">{t("dq_closed")}</Text>
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
