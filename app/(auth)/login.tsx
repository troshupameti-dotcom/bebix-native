import { useState } from "react";
import { View, Text, Pressable, ScrollView, KeyboardAvoidingView, Platform, Switch } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { MotiView } from "moti";
import { SafeAreaView } from "react-native-safe-area-context";
import { AuthInput } from "@/components/auth/AuthInput";
import { AuthDivider } from "@/components/auth/AuthDivider";
import { PrimaryButton } from "@/components/auth/PrimaryButton";
import { SocialAuthRow } from "@/components/auth/SocialAuthRow";
import { Icon } from "@/components/ui/Icon";
import { supabase } from "@/lib/supabase/client";
import { markOnboardingSeen } from "@/lib/hooks/useOnboardingStatus";
import { syncPendingProfileToSupabase } from "@/lib/babyProfile";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import type { LoginFormValues, FormErrors } from "@/types/auth";

const initialValues: LoginFormValues = { email: "", password: "", rememberMe: true };

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
      setSubmitError(error.message);
      return;
    }

    if (data.user) {
      await syncPendingProfileToSupabase(data.user.id);
    }

    setLoading(false);
    await markOnboardingSeen();
    router.replace((redirect as string | undefined) ?? "/(main)/home");
  }

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top", "bottom"]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1">
        <View className="flex-row px-4 pt-2">
          <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace("/(auth)/welcome"))} hitSlop={8} className="h-10 w-10 items-center justify-center">
            <Icon name="chevronLeft" size={20} color="#2C271F" />
          </Pressable>
        </View>

        <ScrollView className="px-6" keyboardShouldPersistTaps="handled">
          <MotiView
            from={{ opacity: 0, translateY: 10 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: "timing", duration: 400 }}
          >
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

              <View className="flex-row items-center gap-2.5 pt-1">
                <Switch
                  value={values.rememberMe}
                  onValueChange={(v) => setValues((prev) => ({ ...prev, rememberMe: v }))}
                  trackColor={{ true: "#6E7452", false: "#E9DFCC" }}
                />
                <Text className="font-body text-sm text-ink-soft">{t("login_remember_me")}</Text>
              </View>
            </View>

            {submitError ? <Text className="mt-4 font-body text-sm text-red-500">{submitError}</Text> : null}

            <View className="mt-6 gap-5">
              <PrimaryButton label={t("login_submit")} loading={loading} onPress={handleSubmit} />
              <AuthDivider label={t("login_or_continue")} />
              <SocialAuthRow />
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