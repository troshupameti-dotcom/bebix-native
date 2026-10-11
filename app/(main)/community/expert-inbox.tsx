import { useCallback, useState } from "react";
import { View, Text, ScrollView, Pressable, TextInput, ActivityIndicator, Alert, RefreshControl, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { BackButton } from "@/components/ui/BackButton";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { shadows } from "@/lib/shadows";
import { haptics } from "@/lib/haptics";
import { useThemeColors } from "@/lib/theme/useThemeColors";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { useToast } from "@/lib/toast/ToastContext";
import { logWarn } from "@/lib/log";
import { useSpecialties } from "@/lib/community/useSpecialties";
import { specialtyLabel } from "@/lib/community/specialties";
import {
  ANSWER_MAX, ANSWER_MIN, answerQuestion, claimQuestion, cleanAnswer, errorKey, fetchInbox, isVerifiedExpert, passQuestion, waitingHours, waitingLabel,
  type InboxQuestion,
} from "@/lib/community/expertQuestions";

/**
 * "Pyetje për ty" (vetëm ekspertët e verifikuar): pyetjet në pritje të
 * repartit të ekspertit, më të vjetrat para, me kohën e pritjes. Eksperti sheh
 * vetëm tekstin, repartin dhe moshën e bebit në muaj kur prindi e ka ndarë —
 * asnjë emër, asnjë foto.
 */
export default function ExpertInboxScreen() {
  const { t, language } = useTranslation();
  const theme = useThemeColors();
  const { showToast } = useToast();
  const specialties = useSpecialties();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [queue, setQueue] = useState<InboxQuestion[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [open, setOpen] = useState<InboxQuestion | null>(null);
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState<"send" | "pass" | null>(null);

  const load = useCallback(async () => {
    try {
      const ok = await isVerifiedExpert();
      setAllowed(ok);
      setQueue(ok ? await fetchInbox() : []);
    } catch (err) {
      logWarn("Expert inbox load error:", err);
      setQueue((prev) => prev ?? []);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  async function openQuestion(q: InboxQuestion) {
    haptics.select();
    try {
      // E merr pyetjen, që një ekspert tjetër të mos përgjigjet njëkohësisht.
      const ok = await claimQuestion(q.id);
      if (!ok) {
        showToast(t("eq_err_taken"));
        void load();
        return;
      }
      setAnswer("");
      setOpen(q);
    } catch (err) {
      Alert.alert(t("mod_error_title"), t(errorKey(err)));
    }
  }

  const valid = !!cleanAnswer(answer);
  const length = answer.trim().length;

  async function send() {
    if (!open || !valid || busy) return;
    setBusy("send");
    try {
      await answerQuestion(open.id, answer);
      haptics.success();
      setOpen(null);
      showToast(t("eq_answer_sent"));
      await load();
    } catch (err) {
      Alert.alert(t("mod_error_title"), t(errorKey(err)));
    } finally {
      setBusy(null);
    }
  }

  async function pass() {
    if (!open || busy) return;
    setBusy("pass");
    try {
      await passQuestion(open.id);
      haptics.select();
      setOpen(null);
      await load();
    } catch (err) {
      Alert.alert(t("mod_error_title"), t(errorKey(err)));
    } finally {
      setBusy(null);
    }
  }

  const meta = (q: InboxQuestion) =>
    [specialtyLabel(q.specialty, language, specialties.list) ?? q.specialty, q.babyAgeMonths !== null ? t("eq_baby_age", { n: q.babyAgeMonths }) : null]
      .filter(Boolean)
      .join(" · ");

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      <View className="mb-2 flex-row items-center px-5 pt-2">
        <BackButton fallback="/(main)/community" className="mr-3" />
        <Text className="font-display text-xl text-ink">{t("eq_inbox_title")}</Text>
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
        <Text className="mb-4 font-body text-xs leading-5 text-ink-soft">{t("eq_inbox_intro")}</Text>
        {queue === null ? <ActivityIndicator className="mt-10" color={theme.olive} /> : null}
        {allowed === false ? <Text className="mt-6 text-center font-body text-sm text-ink-soft">{t("eq_inbox_only_experts")}</Text> : null}
        {allowed && queue && queue.length === 0 ? <Text className="mt-6 text-center font-body text-sm text-ink-soft">{t("eq_inbox_empty")}</Text> : null}

        {queue?.map((q) => {
          const late = waitingHours(q.createdAt) >= 24;
          return (
            <Pressable key={q.id} onPress={() => void openQuestion(q)} accessibilityRole="button" style={shadows.soft} className="mb-3 rounded-xl2 bg-surface p-4">
              <View className="mb-2 flex-row flex-wrap items-center" style={{ gap: 8 }}>
                <View className="rounded-full bg-cream-soft px-2.5 py-1">
                  <Text className="font-bodySemibold text-[11px] text-ink-soft">{meta(q)}</Text>
                </View>
                <Text className={`font-body text-[11px] ${late ? "text-orange" : "text-ink-faint"}`}>{waitingLabel(q.createdAt, t)}</Text>
                {q.claimedByMine ? <Text className="ml-auto font-bodySemibold text-[11px] text-olive">{t("eq_claimed_by_me")}</Text> : null}
              </View>
              <Text className="font-body text-sm leading-5 text-ink" numberOfLines={4}>
                {q.body}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <BottomSheet visible={!!open} onClose={() => (busy ? null : setOpen(null))} maxHeightPct={90}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 8 }}>
            {open ? (
              <>
                <Text className="font-bodySemibold text-[11px] text-ink-faint">
                  {meta(open)} · {waitingLabel(open.createdAt, t)}
                </Text>
                <Text className="mt-1 font-body text-[15px] leading-6 text-ink">{open.body}</Text>
                <View style={shadows.soft} className="mt-4 rounded-xl2 bg-surface px-3 py-2">
                  <TextInput
                    value={answer}
                    onChangeText={setAnswer}
                    placeholder={t("eq_answer_ph")}
                    placeholderTextColor={theme.inkFaint}
                    multiline
                    maxLength={ANSWER_MAX}
                    className="font-body text-sm text-ink"
                    style={{ minHeight: 140, textAlignVertical: "top" }}
                  />
                </View>
                <View className="mt-1.5 flex-row justify-between px-1">
                  <Text className="font-body text-[11px] text-ink-faint">{length < ANSWER_MIN ? t("eq_min_chars", { n: ANSWER_MIN - length }) : ""}</Text>
                  <Text className="font-body text-[11px] text-ink-faint">
                    {length}/{ANSWER_MAX}
                  </Text>
                </View>
                <Text className="mt-1 font-body text-[11px] leading-4 text-ink-faint">{t("eq_expert_note")}</Text>
                <View className="mt-4 flex-row" style={{ gap: 8 }}>
                  <Pressable
                    onPress={() => void pass()}
                    disabled={!!busy}
                    accessibilityRole="button"
                    className="items-center justify-center rounded-2xl bg-cream-soft px-5"
                    style={{ minHeight: 52 }}
                  >
                    {busy === "pass" ? <ActivityIndicator color={theme.ink} /> : <Text className="font-bodySemibold text-sm text-ink">{t("eq_skip")}</Text>}
                  </Pressable>
                  <Pressable
                    onPress={() => void send()}
                    disabled={!valid || !!busy}
                    accessibilityRole="button"
                    accessibilityState={{ disabled: !valid || !!busy }}
                    className={`flex-1 items-center justify-center rounded-2xl ${valid ? "bg-olive" : "bg-cream-line"}`}
                    style={{ minHeight: 52 }}
                  >
                    {busy === "send" ? (
                      <ActivityIndicator color={theme.onAccent} />
                    ) : (
                      <Text className={`font-bodySemibold text-sm ${valid ? "text-on-accent" : "text-ink-faint"}`}>{t("eq_send_answer")}</Text>
                    )}
                  </Pressable>
                </View>
              </>
            ) : null}
          </ScrollView>
        </KeyboardAvoidingView>
      </BottomSheet>
    </SafeAreaView>
  );
}
