import { useState } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Linking from "expo-linking";
import { supabase } from "@/lib/supabase/client";
import { Icon } from "@/components/ui/Icon";
import { shadows } from "@/lib/shadows";
import { BackButton } from "@/components/ui/BackButton";
import { useThemeColors } from "@/lib/theme/useThemeColors";
import { useTranslation } from "@/lib/i18n/LanguageContext";

/**
 * Ekrani i fjalëkalimit të harruar.
 *
 * Login-i e lidhte këtë rrugë që në fillim, por ekrani s'ekzistonte: kush
 * harronte fjalëkalimin dhe s'kishte Google, ngelej jashtë përgjithmonë.
 *
 * Supabase dërgon një email me link që e hap app-in te `bebix://auth/callback`
 * me `type=recovery`. Atë e kap `app/auth/callback.tsx` dhe të çon te ekrani
 * i fjalëkalimit të ri.
 */
export default function ForgotPasswordScreen() {
  const theme = useThemeColors();
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSend = /\S+@\S+\.\S+/.test(email.trim()) && !loading;

  async function handleSend() {
    if (!canSend) return;
    setLoading(true);
    setError(null);
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: Linking.createURL("auth/callback"),
      });
      if (resetError) throw new Error(resetError.message);
      setSent(true);
    } catch (e: any) {
      setError(e?.message ?? t("fp_err"));
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
        <View className="flex-row items-center px-5 pt-2">
          <BackButton fallback="/(auth)/login" />
        </View>
        <View className="flex-1 items-center justify-center px-8 -mt-12">
          <View className="w-16 h-16 rounded-full bg-olive-bg items-center justify-center mb-4">
            <Icon name="send" size={26} color="#6E7452" />
          </View>
          <Text className="font-display text-xl text-ink text-center mb-2">{t("fp_sent_title")}</Text>
          <Text className="font-body text-sm text-ink-soft text-center leading-6">
            {t("fp_sent_body", { email: email.trim() })}
          </Text>
          <Text className="font-body text-xs text-ink-faint text-center mt-4 leading-5">
            {t("fp_spam_note")}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1 }}>
          <View className="flex-row items-center px-5 pt-2 mb-6">
            <BackButton fallback="/(auth)/login" className="mr-3" />
            <Text className="font-display text-2xl text-ink">{t("fp_title")}</Text>
          </View>

          <View className="px-6">
            <Text className="font-body text-sm text-ink-soft leading-6 mb-6">
              {t("fp_intro")}
            </Text>

            <Text className="font-bodyMedium text-sm text-ink-soft mb-2">{t("login_email_label")}</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="ti@example.com"
              placeholderClassName="text-ink-faint"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              returnKeyType="send"
              onSubmitEditing={handleSend}
              style={shadows.soft}
              className="bg-surface rounded-xl2 px-4 py-3 font-body text-sm text-ink mb-4"
            />

            {error && (
              <View className="bg-orange-bg rounded-xl2 p-3 mb-4">
                <Text className="font-body text-xs text-orange leading-5">{error}</Text>
              </View>
            )}

            <Pressable
              onPress={handleSend}
              disabled={!canSend}
              className="bg-olive rounded-xl2 py-3.5 items-center"
              style={{ opacity: canSend ? 1 : 0.5 }}
            >
              {loading ? (
                <ActivityIndicator color={theme.onAccent} />
              ) : (
                <Text className="font-bodySemibold text-sm text-on-accent">{t("fp_send")}</Text>
              )}
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
