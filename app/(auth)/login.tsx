import { useState } from "react";
import { View, Text, Pressable, ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { MotiView } from "moti";
import { SafeAreaView } from "react-native-safe-area-context";
import { AuthInput } from "@/components/auth/AuthInput";
import { AuthDivider } from "@/components/auth/AuthDivider";
import { PrimaryButton } from "@/components/auth/PrimaryButton";
import { SocialAuthRow } from "@/components/auth/SocialAuthRow";
import { supabase } from "@/lib/supabase/client";
import { markOnboardingSeen } from "@/lib/hooks/useOnboardingStatus";
import { syncPendingProfileToSupabase } from "@/lib/babyProfile";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import type { LoginFormValues, FormErrors } from "@/types/auth";
import { BackButton } from "@/components/ui/BackButton";
import { Logo } from "@/components/auth/Logo";
import { friendlyError } from "@/lib/errors/userMessage";
import { safeRedirect } from "@/lib/auth/redirect";

const initialValues: LoginFormValues = { email: "", password: "" };

export default function LoginScreen() {
  const { t } = useTranslation();
  const { redirect } = useLocalSearchParams<{ redirect?: string }>();
  const [values, setValues] = useState<LoginFormValues>(initialValues);
  const [errors, setErrors] = useState<FormErrors<LoginFormValues>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function validate(): boolean {
    const next: FormErrors<LoginFormValues> = {};
    if (!values.email.trim()) next.email = t("login_error_email_required");
    if (!values.password) next.password = t("login_error_password_required");
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit() {
    setSubmitError(null);
    if (!validate()) return;

    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({
      email: values.email.trim(),
      password: values.password,
    });

    if (error) {
      setLoading(false);
      setSubmitError(friendlyError(error, t, "err_generic"));
      return;
    }

    setLoading(false);
    await finishSignIn(data.user?.id);
  }

  // E përbashkët për email-in dhe Google/Apple: sinkronizon profilin e
  // pritshëm, shënon onboarding-un, dhe kthen te `redirect` (ose Home).
  async function finishSignIn(userId: string | undefined) {
    if (userId) {
      await syncPendingProfileToSupabase(userId);
    }
    await markOnboardingSeen();
    router.replace(safeRedirect(redirect) as never);
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
            <View className="mb-6 mt-1 items-center">
              <Logo variant="full" size="lg" />
            </View>
            <Text className="font-display text-3xl text-ink">{t("login_title")}</Text>
            <Text className="mt-2 font-body text-sm text-ink-soft">{t("login_subtitle")}</Text>

            <View className="mt-8 gap-4 rounded-xl3 border border-ink/10 bg-cream p-5">
              <AuthInput
                label={t("login_email_label")}
                keyboardType="email-address"
                autoComplete="email"
                placeholder={t("login_email_ph")}
                value={values.email}
                error={errors.email}
                onChangeText={(text) => setValues((v) => ({ ...v, email: text }))}
              />

              <AuthInput
                label={t("login_password_label")}
                isPassword
                autoComplete="current-password"
                placeholder={t("login_password_ph")}
                value={values.password}
                error={errors.password}
                onChangeText={(text) => setValues((v) => ({ ...v, password: text }))}
                trailingSlot={
                  <Pressable onPress={() => router.push("/(auth)/forgot-password" as never)}>
                    <Text className="font-body text-xs text-ink-faint underline">{t("login_forgot_password")}</Text>
                  </Pressable>
                }
              />

            </View>

            {submitError ? <Text className="mt-4 font-body text-sm text-red-500">{submitError}</Text> : null}

            <View className="mt-6 gap-5">
              <PrimaryButton label={t("login_submit")} loading={loading} onPress={handleSubmit} />
              <AuthDivider label={t("login_or_continue")} />
              <SocialAuthRow onSignedIn={finishSignIn} />
            </View>

            <View className="mt-6 mb-8 flex-row justify-center gap-1">
              <Text className="font-body text-sm text-ink-soft">{t("login_no_account")}</Text>
              <Pressable
                onPress={() =>
                  router.push({ pathname: "/(auth)/create-profile", params: redirect ? { redirect } : undefined })
                }
              >
                <Text className="font-bodyMedium text-sm text-orange">{t("login_signup_link")}</Text>
              </Pressable>
            </View>
          </MotiView>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}