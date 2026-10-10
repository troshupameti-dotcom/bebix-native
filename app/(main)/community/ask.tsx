import { useCallback, useState } from "react";
import { View, Text, ScrollView, Pressable, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Icon } from "@/components/ui/Icon";
import { BackButton } from "@/components/ui/BackButton";
import { shadows } from "@/lib/shadows";
import { haptics } from "@/lib/haptics";
import { useThemeColors } from "@/lib/theme/useThemeColors";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import {
  askExpert, BODY_MAX, BODY_MIN, CATEGORIES, categoryKey, cleanBody, errorKey, fetchMyQuestions, remainingThisWeek, type QuestionCategory,
} from "@/lib/community/expertQuestions";

/**
 * "Pyet ekspertin": pyetje private (20–600 shkronja), kategoria, dhe
 * zgjedhja "Publiko pa emër pas përgjigjes" (e fikur si parazgjedhje).
 * Pas dërgimit: mesazhi "Pyetja u dërgua…".
 */
export default function AskExpertScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const theme = useThemeColors();
  const [body, setBody] = useState("");
  const [category, setCategory] = useState<QuestionCategory | null>(null);
  const [publish, setPublish] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      fetchMyQuestions()
        .then((list) => alive && setRemaining(remainingThisWeek(list.map((q) => q.createdAt))))
        .catch(() => {});
      return () => {
        alive = false;
      };
    }, [])
  );

  const length = body.trim().length;
  const canSend = !!cleanBody(body) && !!category && !sending && remaining !== 0;

  async function send() {
    if (!canSend || !category) return;
    setSending(true);
    try {
      await askExpert(category, body, publish);
      haptics.success();
      setSent(true);
    } catch (err) {
      Alert.alert(t("mod_error_title"), t(errorKey(err)));
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-cream px-8">
        <View className="h-16 w-16 items-center justify-center rounded-full bg-olive-bg">
          <Icon name="check" size={28} color={theme.olive} />
        </View>
        <Text className="mt-4 text-center font-display text-xl text-ink">{t("eq_sent_title")}</Text>
        <Text className="mt-2 text-center font-body text-sm leading-6 text-ink-soft">{t("eq_sent_body")}</Text>
        <Pressable
          onPress={() => router.replace("/community/my-questions")}
          accessibilityRole="button"
          className="mt-6 items-center justify-center rounded-full bg-olive px-6"
          style={{ minHeight: 48 }}
        >
          <Text className="font-bodySemibold text-sm text-on-accent">{t("eq_my_btn")}</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      <View className="mb-2 flex-row items-center px-5 pt-2">
        <BackButton fallback="/(main)/community" className="mr-3" />
        <Text className="font-display text-xl text-ink">{t("eq_ask_btn")}</Text>
      </View>

      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView className="flex-1 px-5" contentContainerStyle={{ paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
          <Text className="mb-4 font-body text-sm leading-6 text-ink-soft">{t("eq_intro")}</Text>

          <Text className="mb-2 font-bodySemibold text-[13px] text-ink">{t("eq_category")}</Text>
          <View className="mb-4 flex-row flex-wrap" style={{ gap: 8 }}>
            {CATEGORIES.map((c) => (
              <Pressable
                key={c}
                onPress={() => {
                  haptics.select();
                  setCategory(c);
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: category === c }}
                className={`items-center justify-center rounded-full px-4 ${category === c ? "bg-ink" : "bg-cream-soft"}`}
                style={{ minHeight: 40 }}
              >
                <Text className={`font-bodyMedium text-[13px] ${category === c ? "text-on-accent" : "text-ink-soft"}`}>{t(categoryKey(c))}</Text>
              </Pressable>
            ))}
          </View>

          <Text className="mb-2 font-bodySemibold text-[13px] text-ink">{t("eq_question")}</Text>
          <View style={shadows.soft} className="rounded-xl2 bg-surface px-3 py-2">
            <TextInput
              value={body}
              onChangeText={setBody}
              placeholder={t("eq_placeholder")}
              placeholderTextColor={theme.inkFaint}
              multiline
              maxLength={BODY_MAX}
              className="font-body text-sm text-ink"
              style={{ minHeight: 140, textAlignVertical: "top" }}
            />
          </View>
          <View className="mt-1.5 flex-row justify-between px-1">
            <Text className="font-body text-[11px] text-ink-faint">{length < BODY_MIN ? t("eq_min_chars", { n: BODY_MIN - length }) : t("eq_no_names")}</Text>
            <Text className="font-body text-[11px] text-ink-faint">
              {length}/{BODY_MAX}
            </Text>
          </View>

          <Pressable
            onPress={() => {
              haptics.select();
              setPublish((v) => !v);
            }}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: publish }}
            className="mt-4 flex-row items-start rounded-xl2 bg-surface p-3.5"
            style={shadows.soft}
          >
            <View
              className={`mr-3 mt-0.5 h-6 w-6 items-center justify-center rounded-md border-2 ${publish ? "border-olive bg-olive" : "border-cream-line"}`}
            >
              {publish ? <Icon name="check" size={14} color={theme.onAccent} /> : null}
            </View>
            <View className="flex-1">
              <Text className="font-bodyMedium text-sm text-ink">{t("eq_publish")}</Text>
              <Text className="mt-0.5 font-body text-xs leading-5 text-ink-soft">{t("eq_publish_hint")}</Text>
            </View>
          </Pressable>

          <View className="mt-4 rounded-xl2 bg-orange-bg p-3.5">
            <Text className="font-body text-xs leading-5 text-orange">{t("eq_disclaimer")}</Text>
          </View>

          {remaining !== null ? (
            <Text className="mt-3 text-center font-body text-[11px] text-ink-faint">
              {remaining === 0 ? t("eq_err_limit") : t("eq_remaining", { n: remaining })}
            </Text>
          ) : null}
        </ScrollView>

        <View className="border-t border-cream-line bg-cream px-5 pb-4 pt-2">
          <Pressable
            onPress={() => void send()}
            disabled={!canSend}
            accessibilityRole="button"
            className={`items-center justify-center rounded-2xl ${canSend ? "bg-olive" : "bg-cream-line"}`}
            style={{ minHeight: 52 }}
          >
            {sending ? <ActivityIndicator color={theme.onAccent} /> : <Text className={`font-bodySemibold text-[15px] ${canSend ? "text-on-accent" : "text-ink-faint"}`}>{t("eq_send")}</Text>}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
