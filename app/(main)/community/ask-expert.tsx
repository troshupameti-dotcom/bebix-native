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
import { useAppState } from "@/lib/state/AppStateContext";
import { useSpecialties } from "@/lib/community/useSpecialties";
import { specialtyEmoji, specialtyLabel } from "@/lib/community/specialties";
import {
  ageInMonths, askExpertQuestion, BODY_MAX, BODY_MIN, cleanBody, DEFAULT_SPECIALTY, errorKey, fetchRemaining,
} from "@/lib/community/expertQuestions";

/** Kutia e zgjedhjes (✓), e njëjtë për "E kuptoj" dhe "Trego moshën". */
function Check({ checked, label, hint, onPress }: { checked: boolean; label: string; hint?: string; onPress: () => void }) {
  const theme = useThemeColors();
  return (
    <Pressable
      onPress={() => {
        haptics.select();
        onPress();
      }}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      className="flex-row items-start rounded-xl2 bg-surface p-3.5"
      style={[shadows.soft, { minHeight: 48 }]}
    >
      <View className={`mr-3 mt-0.5 h-6 w-6 items-center justify-center rounded-md border-2 ${checked ? "border-olive bg-olive" : "border-cream-line"}`}>
        {checked ? <Icon name="check" size={14} color={theme.onAccent} /> : null}
      </View>
      <View className="flex-1">
        <Text className="font-bodyMedium text-sm text-ink">{label}</Text>
        {hint ? <Text className="mt-0.5 font-body text-xs leading-5 text-ink-soft">{hint}</Text> : null}
      </View>
    </Pressable>
  );
}

/**
 * "Pyet ekspertin": reparti (parazgjedhja pediatri), pyetja 20–600 shkronja dhe,
 * nëse prindi do, mosha e bebit në muaj (kurrë emri apo data). Paralajmërimi
 * mjekësor është mbi formë dhe duhet konfirmuar para dërgimit.
 */
export default function AskExpertScreen() {
  const router = useRouter();
  const { t, language } = useTranslation();
  const theme = useThemeColors();
  const { state } = useAppState();
  const specialties = useSpecialties();
  const [specialty, setSpecialty] = useState(DEFAULT_SPECIALTY);
  const [body, setBody] = useState("");
  const [ack, setAck] = useState(false);
  const [shareAge, setShareAge] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);

  const months = ageInMonths(state.profile.babyDob);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      void fetchRemaining().then((n) => alive && setRemaining(n));
      return () => {
        alive = false;
      };
    }, [])
  );

  const length = body.trim().length;
  const canSend = !!cleanBody(body) && ack && !sending && remaining !== 0;

  async function send() {
    if (!canSend) return;
    setSending(true);
    try {
      await askExpertQuestion(specialty, body, shareAge ? months : null);
      haptics.success();
      setSent(true);
    } catch (err) {
      Alert.alert(t("mod_error_title"), t(errorKey(err)));
      void fetchRemaining().then(setRemaining);
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
          onPress={() => {
            haptics.tap();
            router.replace("/community/my-questions");
          }}
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
          {/* Paralajmërimi në krye: s'dërgohet pa e konfirmuar. */}
          <View className="mb-3 rounded-xl2 bg-orange-bg p-3.5">
            <Text className="font-bodyMedium text-[13px] leading-5 text-orange">{t("eq_disclaimer")}</Text>
          </View>
          <Check checked={ack} label={t("eq_disclaimer_ack")} onPress={() => setAck((v) => !v)} />

          <Text className="mb-4 mt-4 font-body text-sm leading-6 text-ink-soft">{t("eq_intro")}</Text>

          <Text className="mb-2 font-bodySemibold text-[13px] text-ink">{t("eq_specialty")}</Text>
          <View className="mb-4 flex-row flex-wrap" style={{ gap: 8 }}>
            {specialties.list.map((s) => {
              const on = specialty === s.key;
              return (
                <Pressable
                  key={s.key}
                  onPress={() => {
                    haptics.select();
                    setSpecialty(s.key);
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  className={`flex-row items-center justify-center rounded-full px-4 ${on ? "bg-ink" : "bg-cream-soft"}`}
                  style={{ minHeight: 44 }}
                >
                  <Text className="mr-1.5 text-[13px]">{specialtyEmoji(s.key, specialties.list)}</Text>
                  <Text className={`font-bodyMedium text-[13px] ${on ? "text-on-accent" : "text-ink-soft"}`}>
                    {specialtyLabel(s.key, language, specialties.list)}
                  </Text>
                </Pressable>
              );
            })}
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

          {/* Mosha: vetëm kur dihet datëlindja; s'ndahet pa e zgjedhur prindi. */}
          {months !== null ? (
            <View className="mt-4">
              <Check checked={shareAge} label={t("eq_share_age", { n: months })} hint={t("eq_share_age_hint")} onPress={() => setShareAge((v) => !v)} />
            </View>
          ) : null}

          {remaining !== null ? (
            <Text className="mt-4 text-center font-body text-[11px] text-ink-faint">
              {remaining === 0 ? t("eq_err_limit") : t("eq_remaining", { n: remaining })}
            </Text>
          ) : null}
        </ScrollView>

        <View className="border-t border-cream-line bg-cream px-5 pb-4 pt-2">
          <Pressable
            onPress={() => void send()}
            disabled={!canSend}
            accessibilityRole="button"
            accessibilityState={{ disabled: !canSend }}
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
