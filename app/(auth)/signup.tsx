import { useEffect, useState } from "react";
import { View, Text, Pressable, ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import { ThemedSwitch } from "@/components/ui/ThemedSwitch";
import { router, useLocalSearchParams } from "expo-router";
import { MotiView } from "moti";
import { SafeAreaView } from "react-native-safe-area-context";
import { AuthInput } from "@/components/auth/AuthInput";
import { PrimaryButton } from "@/components/auth/PrimaryButton";
import { AuthDivider } from "@/components/auth/AuthDivider";
import { SocialAuthRow } from "@/components/auth/SocialAuthRow";
import { supabase } from "@/lib/supabase/client";
import { markOnboardingSeen } from "@/lib/hooks/useOnboardingStatus";
import { useAppState } from "@/lib/state/AppStateContext";
import { syncPendingProfileToSupabase } from "@/lib/babyProfile";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import type { SignupFormValues, FormErrors } from "@/types/auth";
import { BackButton } from "@/components/ui/BackButton";

const initialValues: SignupFormValues = {
  fullName: "",
  email: "",
  password: "",
  confirmPassword: "",
  acceptedTerms: false,
};

export default function SignupScreen() {
  const { t } = useTranslation();
  const { redirect } = useLocalSearchParams<{ redirect?: string }>();
  const { state } = useAppState();
  const [values, setValues] = useState<SignupFormValues>(initialValues);
  const [errors, setErrors] = useState<FormErrors<SignupFormValues>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (state.profile.parentName) {
      // State-i fillestar varet nga te dhena asinkrone (AsyncStorage / rrjeti),
      // prandaj mbushja behet ne efekt pas montimit.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setValues((v) => (v.fullName ? v : { ...v, fullName: state.profile.parentName ?? "" }));
    }
  }, [state.profile.parentName]);

  function validate(): boolean {
    const next: FormErrors<SignupFormValues> = {};
    if (!values.fullName.trim()) next.fullName = t("signup_error_fullname");
    if (!values.email.trim()) next.email = t("signup_error_email");
    if (values.password.length < 8) next.password = t("signup_error_password");
    if (values.confirmPassword !== values.password) next.confirmPassword = t("signup_error_confirm_password");
    if (!values.acceptedTerms) next.acceptedTerms = t("signup_error_terms");
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit() {
    setSubmitError(null);
    if (!validate()) return;

    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: values.email.trim(),
      password: values.password,
      options: { data: { full_name: values.fullName.trim() } },
    });

    if (error) {
      setLoading(false);
      setSubmitError(error.message);
      return;
    }

    setLoading(false);
    await finishSignIn(data.session ? data.user?.id : undefined);
  }

  // Google/Apple kërkojnë po ashtu pranimin e Kushteve, si regjistrimi me email.
  function checkTermsForSocial(): boolean {
    if (values.acceptedTerms) {
      setErrors((e) => ({ ...e, acceptedTerms: undefined }));
      return true;
    }
    setErrors((e) => ({ ...e, acceptedTerms: t("signup_error_terms") }));
    return false;
  }

  // E përbashkët për email-in dhe Google/Apple: sinkronizon profilin e
  // pritshëm (nga create-profile), shënon onboarding-un, dhe kthen te `redirect`.
  async function finishSignIn(userId: string | undefined) {
    if (userId) {
      await syncPendingProfileToSupabase(userId);
    }
    await markOnboardingSeen();
    router.replace((redirect as string | undefined) ?? "/(main)/baby");
  }

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top", "bottom"]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1">
        <View className="flex-row px-4 pt-2">
          <BackButton fallback="/(auth)/welcome" />
        </View>

        <ScrollView className="px-6" keyboardShouldPersistTaps="handled">
          <MotiView
            from={{ opacity: 0, translateY: 10 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: "timing", duration: 400 }}
          >
            <Text className="font-display text-3xl text-ink">{t("signup_title")}</Text>
            <Text className="mt-2 font-body text-sm text-ink-soft">{t("signup_subtitle")}</Text>

            <View className="mt-8 gap-4 rounded-xl3 border border-ink/10 bg-cream p-5">
              <AuthInput
                label={t("signup_fullname_label")}
                autoComplete="name"
                placeholder={t("signup_fullname_ph")}
                value={values.fullName}
                error={errors.fullName}
                onChangeText={(text) => setValues((v) => ({ ...v, fullName: text }))}
              />
              <AuthInput
                label={t("signup_email_label")}
                keyboardType="email-address"
                autoComplete="email"
                placeholder={t("signup_email_ph")}
                value={values.email}
                error={errors.email}
                onChangeText={(text) => setValues((v) => ({ ...v, email: text }))}
              />
              <AuthInput
                label={t("signup_password_label")}
                isPassword
                autoComplete="new-password"
                placeholder={t("signup_password_ph")}
                value={values.password}
                error={errors.password}
                onChangeText={(text) => setValues((v) => ({ ...v, password: text }))}
              />
              <AuthInput
                label={t("signup_confirm_password_label")}
                isPassword
                autoComplete="new-password"
                placeholder={t("signup_confirm_password_ph")}
                value={values.confirmPassword}
                error={errors.confirmPassword}
                onChangeText={(text) => setValues((v) => ({ ...v, confirmPassword: text }))}
              />

              <View className="flex-row items-start gap-2.5 pt-1">
                <ThemedSwitch
                  value={values.acceptedTerms}
                  onValueChange={(v) => setValues((prev) => ({ ...prev, acceptedTerms: v }))}
                />
                <Text className="flex-1 font-body text-sm text-ink-soft">
                  {t("signup_terms_agree")} <Text className="font-bodySemibold text-ink underline">{t("signup_terms")}</Text>{" "}
                  {t("signup_and")} <Text className="font-bodySemibold text-ink underline">{t("signup_privacy")}</Text>.
                </Text>
              </View>
              {errors.acceptedTerms ? <Text className="font-body text-xs text-red-500">{errors.acceptedTerms}</Text> : null}
            </View>

            {submitError ? <Text className="mt-4 font-body text-sm text-red-500">{submitError}</Text> : null}

            <View className="mt-6 gap-5">
              <PrimaryButton label={t("signup_submit")} loading={loading} onPress={handleSubmit} />
              <AuthDivider label={t("login_or_continue")} />
              <SocialAuthRow onSignedIn={finishSignIn} beforeStart={checkTermsForSocial} />
            </View>

            <View className="mt-6 mb-8 flex-row justify-center gap-1">
              <Text className="font-body text-sm text-ink-soft">{t("signup_have_account")}</Text>
              <Pressable
                onPress={() => router.push({ pathname: "/(auth)/login", params: redirect ? { redirect } : undefined })}
              >
                <Text className="font-bodyMedium text-sm text-orange">{t("signup_login_link")}</Text>
              </Pressable>
            </View>
          </MotiView>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}