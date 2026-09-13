import { useState } from "react";
import { View, Text, Pressable, KeyboardAvoidingView, Platform } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { MotiView } from "moti";
import { SafeAreaView } from "react-native-safe-area-context";
import { AuthInput } from "@/components/auth/AuthInput";
import { PrimaryButton } from "@/components/auth/PrimaryButton";
import { Icon } from "@/components/ui/Icon";
import { useAppState } from "@/lib/state/AppStateContext";
import { savePendingProfile, parseDobInput, formatDobInput } from "@/lib/babyProfile";
import { useTranslation } from "@/lib/i18n/LanguageContext";

type Step = 0 | 1 | 2 | 3;

export default function CreateProfileScreen() {
  const { t } = useTranslation();
  const { redirect } = useLocalSearchParams<{ redirect?: string }>();
  const { updateProfile } = useAppState();

  const [step, setStep] = useState<Step>(0);
  const [babyName, setBabyName] = useState("");
  const [parentName, setParentName] = useState("");
  const [dobInput, setDobInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  function goBack() {
    if (step === 0) {
      router.back();
      return;
    }
    setError(null);
    setStep((s) => (s - 1) as Step);
  }

  function handleNext() {
    setError(null);

    if (step === 0) {
      if (!babyName.trim()) {
        setError(t("create_profile_error_baby_name"));
        return;
      }
      setStep(1);
      return;
    }

    if (step === 1) {
      if (!parentName.trim()) {
        setError(t("create_profile_error_parent_name"));
        return;
      }
      setStep(2);
      return;
    }

    if (step === 2) {
      if (dobInput.trim() && !parseDobInput(dobInput)) {
        setError(t("create_profile_error_dob"));
        return;
      }
      setStep(3);
    }
  }

  async function handleFinish() {
    const babyDob = dobInput.trim() ? parseDobInput(dobInput) : null;

    updateProfile({ parentName: parentName.trim() });
    await savePendingProfile({
      parentName: parentName.trim(),
      babyName: babyName.trim(),
      babyDob,
    });

    router.push({
      pathname: "/(auth)/signup",
      params: redirect ? { redirect } : undefined,
    });
  }

  const stepTitles = [
    t("create_profile_step_baby_title"),
    t("create_profile_step_parent_title"),
    t("create_profile_step_dob_title"),
  ];

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top", "bottom"]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1">
        <View className="flex-row items-center justify-between px-4 pt-2">
          <Pressable onPress={goBack} hitSlop={8} className="h-10 w-10 items-center justify-center">
            <Icon name="chevronLeft" size={20} color="#2C271F" />
          </Pressable>

          {step < 3 ? (
            <View className="flex-row gap-1.5">
              {[0, 1, 2].map((i) => (
                <View key={i} className={`h-1.5 w-6 rounded-full ${i <= step ? "bg-olive" : "bg-ink/10"}`} />
              ))}
            </View>
          ) : (
            <View />
          )}

          <View className="h-10 w-10" />
        </View>

        <View className="flex-1 px-6 pt-8">
          {step < 3 ? (
            <MotiView
              key={step}
              from={{ opacity: 0, translateY: 10 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: "timing", duration: 350 }}
            >
              <Text className="font-display text-2xl text-ink">{stepTitles[step]}</Text>
              <Text className="mt-2 font-body text-sm text-ink-soft">{t("create_profile_step_sub")}</Text>

              <View className="mt-8">
                {step === 0 && (
                  <AuthInput
                    label={t("create_profile_baby_name_label")}
                    placeholder={t("create_profile_baby_name_ph")}
                    value={babyName}
                    error={error ?? undefined}
                    onChangeText={setBabyName}
                    autoFocus
                  />
                )}
                {step === 1 && (
                  <AuthInput
                    label={t("create_profile_parent_name_label")}
                    placeholder={t("create_profile_parent_name_ph")}
                    value={parentName}
                    error={error ?? undefined}
                    onChangeText={setParentName}
                    autoFocus
                  />
                )}
                {step === 2 && (
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

        <View className="px-6 pb-6">
          <PrimaryButton
            label={step < 3 ? t("create_profile_continue") : t("create_profile_create_account")}
            onPress={step < 3 ? handleNext : handleFinish}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}