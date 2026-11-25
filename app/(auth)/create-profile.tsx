import { useState } from "react";
import { View, Text, Pressable } from "react-native";
import { KeyboardSafeView } from "@/lib/ui/keyboard";
import { router, useLocalSearchParams } from "expo-router";
import { MotiView } from "moti";
import { SafeAreaView } from "react-native-safe-area-context";
import { AuthInput } from "@/components/auth/AuthInput";
import { PrimaryButton } from "@/components/auth/PrimaryButton";
import { Icon } from "@/components/ui/Icon";
import { DueMonthPicker } from "@/components/children/DueMonthPicker";
import { useAppState } from "@/lib/state/AppStateContext";
import { savePendingProfile, parseDobInput, formatDobInput, dueFromMonth, type DueMonth } from "@/lib/babyProfile";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import type { TranslationKey } from "@/lib/i18n/translations";
import { BackButton, goBackOr } from "@/components/ui/BackButton";

/** Ku është prindi: ka bebe/fëmijë, pret bebe, ose s'ka ende fëmijë (gjyshër, dhurata, planifikim). */
type Kind = "born" | "expecting" | "none";
type Step = "kind" | "baby" | "parent" | "date" | "done";

const FLOW: Record<Kind, Step[]> = {
  born: ["kind", "baby", "parent", "date", "done"],
  expecting: ["kind", "baby", "parent", "date", "done"],
  // Pa fëmijë: vetëm emri i prindit; fëmija shtohet më vonë te "Fëmijët".
  none: ["kind", "parent", "done"],
};

const KINDS: { kind: Kind; title: TranslationKey; sub: TranslationKey }[] = [
  { kind: "born", title: "onb_kind_born", sub: "onb_kind_born_sub" },
  { kind: "expecting", title: "onb_kind_expecting", sub: "onb_kind_expecting_sub" },
  { kind: "none", title: "onb_kind_none", sub: "onb_kind_none_sub" },
];

export default function CreateProfileScreen() {
  const { t } = useTranslation();
  const { redirect } = useLocalSearchParams<{ redirect?: string }>();
  const { updateProfile } = useAppState();

  const [kind, setKind] = useState<Kind | null>(null);
  const [step, setStep] = useState<Step>("kind");
  const [babyName, setBabyName] = useState("");
  const [parentName, setParentName] = useState("");
  const [dobInput, setDobInput] = useState("");
  // "Pres bebe": vetëm muaji i pritur, se ditën e saktë s'e di askush.
  const [dueMonth, setDueMonth] = useState<DueMonth | null>(null);
  const [error, setError] = useState<string | null>(null);

  const flow = FLOW[kind ?? "born"];
  const index = flow.indexOf(step);
  const dots = flow.length - 1; // "done" s'ka pikë

  function goBack() {
    setError(null);
    if (step === "kind") {
      goBackOr("/(auth)/welcome");
      return;
    }
    setStep(flow[index - 1]);
  }

  function chooseKind(k: Kind) {
    setKind(k);
    setError(null);
    setStep(FLOW[k][1]);
  }

  function handleNext() {
    setError(null);
    if (step === "baby" && !babyName.trim()) {
      setError(t("create_profile_error_baby_name"));
      return;
    }
    if (step === "parent" && !parentName.trim()) {
      setError(t("create_profile_error_parent_name"));
      return;
    }
    if (step === "date" && kind === "born") {
      // E detyrueshme: pa datëlindje app-i s'di moshën dhe s'përshtatet.
      if (!dobInput.trim()) {
        setError(t("create_profile_error_dob_required"));
        return;
      }
      if (!parseDobInput(dobInput)) {
        setError(t("create_profile_error_dob"));
        return;
      }
    }
    if (step === "date" && kind === "expecting" && !(dueMonth && dueFromMonth(dueMonth))) {
      setError(t("onb_due_month_required"));
      return;
    }
    setStep(flow[index + 1]);
  }

  async function handleFinish() {
    const babyDob = kind === "born" ? parseDobInput(dobInput) : null;
    const babyDueDate = kind === "expecting" && dueMonth ? dueFromMonth(dueMonth) : null;
    const name = kind === "none" ? "" : babyName.trim();

    // Edhe në telefon menjëherë (jo vetëm te serveri pas regjistrimit): Cilësimet e bebit i shohin që në hapjen e parë.
    const [y, m, d] = (babyDob ?? "").split("-").map(Number);
    updateProfile({
      parentName: parentName.trim(),
      babyName: name || null,
      ...(babyDob ? { babyDob: new Date(y, m - 1, d).toISOString() } : {}),
    });
    await savePendingProfile({ parentName: parentName.trim(), babyName: name, babyDob, babyDueDate });

    router.push({
      pathname: "/(auth)/signup",
      params: redirect ? { redirect } : undefined,
    });
  }

  const title: Record<Exclude<Step, "done">, string> = {
    kind: t("onb_kind_title"),
    baby: t("create_profile_step_baby_title"),
    parent: t("create_profile_step_parent_title"),
    date: kind === "expecting" ? t("onb_due_month_title") : t("create_profile_step_dob_title"),
  };
  const sub = step === "date" && kind === "expecting" ? t("onb_due_month_sub") : t("create_profile_step_sub");

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top", "bottom"]}>
      <KeyboardSafeView>
        <View className="flex-row items-center justify-between px-4 pt-2">
          <BackButton onPress={goBack} />

          {step !== "done" ? (
            <View className="flex-row gap-1.5">
              {Array.from({ length: dots }, (_, i) => (
                <View key={i} className={`h-1.5 w-6 rounded-full ${i <= index ? "bg-olive" : "bg-ink/10"}`} />
              ))}
            </View>
          ) : (
            <View />
          )}

          <View className="h-10 w-10" />
        </View>

        <View className="flex-1 px-6 pt-8">
          {step !== "done" ? (
            <MotiView
              key={step}
              from={{ opacity: 0, translateY: 10 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: "timing", duration: 350 }}
            >
              <Text accessibilityRole="header" className="font-display text-2xl text-ink">
                {title[step]}
              </Text>
              <Text className="mt-2 font-body text-sm text-ink-soft">{sub}</Text>

              <View className="mt-8">
                {step === "kind" && (
                  <View style={{ gap: 12 }}>
                    {KINDS.map((k) => (
                      <Pressable
                        key={k.kind}
                        onPress={() => chooseKind(k.kind)}
                        accessibilityRole="button"
                        style={{ borderRadius: 18, borderWidth: 1, paddingHorizontal: 18, paddingVertical: 16 }}
                        className={kind === k.kind ? "border-olive bg-olive/10" : "border-cream-line bg-surface"}
                      >
                        <Text className="font-bodySemibold text-[16px] text-ink">{t(k.title)}</Text>
                        <Text className="mt-1 font-body text-[13.5px] leading-[19px] text-ink-soft">{t(k.sub)}</Text>
                      </Pressable>
                    ))}
                  </View>
                )}
                {step === "baby" && (
                  <AuthInput
                    label={t("create_profile_baby_name_label")}
                    placeholder={t("create_profile_baby_name_ph")}
                    value={babyName}
                    error={error ?? undefined}
                    onChangeText={setBabyName}
                    autoFocus
                  />
                )}
                {step === "parent" && (
                  <AuthInput
                    label={t("create_profile_parent_name_label")}
                    placeholder={t("create_profile_parent_name_ph")}
                    value={parentName}
                    error={error ?? undefined}
                    onChangeText={setParentName}
                    autoFocus
                  />
                )}
                {step === "date" && kind === "born" && (
                  <AuthInput
                    label={t("create_profile_dob_label")}
                    placeholder={t("create_profile_dob_ph")}
                    keyboardType="number-pad"
                    maxLength={10}
                    value={dobInput}
                    error={error ?? undefined}
                    onChangeText={(text) => setDobInput(formatDobInput(text))}
                    autoFocus
                  />
                )}
                {step === "date" && kind === "expecting" && (
                  <View>
                    <DueMonthPicker
                      value={dueMonth}
                      onChange={(m) => {
                        setDueMonth(m);
                        setError(null);
                      }}
                    />
                    {error ? (
                      <Text accessibilityRole="alert" className="mt-3 font-body text-[13px] text-orange">
                        {error}
                      </Text>
                    ) : null}
                  </View>
                )}
              </View>
            </MotiView>
          ) : (
            <MotiView
              from={{ opacity: 0, translateY: 10 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: "timing", duration: 400 }}
              className="flex-1 items-center justify-center"
            >
              <View className="h-16 w-16 items-center justify-center rounded-full bg-olive/10">
                <Icon name="check" size={28} color="#6E7452" />
              </View>
              <Text className="mt-6 text-center font-display text-2xl text-ink">{t("create_profile_done_title")}</Text>
              <Text className="mt-2 text-center font-body text-sm text-ink-soft">{t("create_profile_done_sub")}</Text>
            </MotiView>
          )}
        </View>

        {step !== "kind" ? (
          <View className="px-6 pb-6">
            <PrimaryButton
              label={step !== "done" ? t("create_profile_continue") : t("create_profile_create_account")}
              onPress={step !== "done" ? handleNext : handleFinish}
            />
          </View>
        ) : null}
      </KeyboardSafeView>
    </SafeAreaView>
  );
}
