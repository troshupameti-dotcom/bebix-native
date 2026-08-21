import { useState } from "react";
import { View, Text, Pressable, ScrollView, KeyboardAvoidingView, Platform, Switch } from "react-native";
import { router } from "expo-router";
import { MotiView } from "moti";
import { SafeAreaView } from "react-native-safe-area-context";
import { AuthInput } from "@/components/auth/AuthInput";
import { PrimaryButton } from "@/components/auth/PrimaryButton";
import { Icon } from "@/components/ui/Icon";
import { supabase } from "@/lib/supabase/client";
import { markOnboardingSeen } from "@/lib/hooks/useOnboardingStatus";
import type { SignupFormValues, FormErrors } from "@/types/auth";

const initialValues: SignupFormValues = {
  fullName: "",
  email: "",
  password: "",
  confirmPassword: "",
  acceptedTerms: false,
};

export default function SignupScreen() {
  const [values, setValues] = useState<SignupFormValues>(initialValues);
  const [errors, setErrors] = useState<FormErrors<SignupFormValues>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function validate(): boolean {
    const next: FormErrors<SignupFormValues> = {};
    if (!values.fullName.trim()) next.fullName = "Full name is required.";
    if (!values.email.trim()) next.email = "Email is required.";
    if (values.password.length < 8) next.password = "Use at least 8 characters.";
    if (values.confirmPassword !== values.password) next.confirmPassword = "Passwords don't match.";
    if (!values.acceptedTerms) next.acceptedTerms = "Please accept the Terms to continue.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit() {
    setSubmitError(null);
    if (!validate()) return;

    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: values.email.trim(),
      password: values.password,
      options: { data: { full_name: values.fullName.trim() } },
    });
    setLoading(false);

    if (error) {
      setSubmitError(error.message);
      return;
    }

    await markOnboardingSeen();
    router.replace("/(main)/home");
  }

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top", "bottom"]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1">
        <View className="flex-row px-4 pt-2">
          <Pressable onPress={() => router.back()} hitSlop={8} className="h-10 w-10 items-center justify-center">
            <Icon name="chevronLeft" size={20} color="#2C271F" />
          </Pressable>
        </View>

        <ScrollView className="px-6" keyboardShouldPersistTaps="handled">
          <MotiView
            from={{ opacity: 0, translateY: 10 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: "timing", duration: 400 }}
          >
            <Text className="font-display text-3xl text-ink">Create Account</Text>
            <Text className="mt-2 font-body text-sm text-ink-soft">
              Join Bebix and start your little one&apos;s journey.
            </Text>

            <View className="mt-8 gap-4 rounded-xl3 border border-ink/10 bg-cream p-5">
              <AuthInput
                label="Full Name"
                autoComplete="name"
                placeholder="Sarah Johnson"
                value={values.fullName}
                error={errors.fullName}
                onChangeText={(text) => setValues((v) => ({ ...v, fullName: text }))}
              />
              <AuthInput
                label="Email"
                keyboardType="email-address"
                autoComplete="email"
                placeholder="sarah@email.com"
                value={values.email}
                error={errors.email}
                onChangeText={(text) => setValues((v) => ({ ...v, email: text }))}
              />
              <AuthInput
                label="Password"
                isPassword
                autoComplete="new-password"
                placeholder="At least 8 characters"
                value={values.password}
                error={errors.password}
                onChangeText={(text) => setValues((v) => ({ ...v, password: text }))}
              />
              <AuthInput
                label="Confirm Password"
                isPassword
                autoComplete="new-password"
                placeholder="Re-enter your password"
                value={values.confirmPassword}
                error={errors.confirmPassword}
                onChangeText={(text) => setValues((v) => ({ ...v, confirmPassword: text }))}
              />

              <View className="flex-row items-start gap-2.5 pt-1">
                <Switch
                  value={values.acceptedTerms}
                  onValueChange={(v) => setValues((prev) => ({ ...prev, acceptedTerms: v }))}
                  trackColor={{ true: "#6E7452", false: "#E9DFCC" }}
                />
                <Text className="flex-1 font-body text-sm text-ink-soft">
                  I agree to the <Text className="font-bodySemibold text-ink underline">Terms</Text> and{" "}
                  <Text className="font-bodySemibold text-ink underline">Privacy Policy</Text>.
                </Text>
              </View>
              {errors.acceptedTerms ? (
                <Text className="font-body text-xs text-red-500">{errors.acceptedTerms}</Text>
              ) : null}
            </View>

            {submitError ? (
              <Text className="mt-4 font-body text-sm text-red-500">{submitError}</Text>
            ) : null}

            <View className="mt-6">
              <PrimaryButton label="Create Account" loading={loading} onPress={handleSubmit} />
            </View>

            <View className="mt-6 mb-8 flex-row justify-center gap-1">
              <Text className="font-body text-sm text-ink-soft">Already have an account?</Text>
              <Pressable onPress={() => router.push("/(auth)/login")}>
                <Text className="font-bodyMedium text-sm text-orange">Log In</Text>
              </Pressable>
            </View>
          </MotiView>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
