import { useState } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Icon } from "@/components/ui/Icon";
import { shadows } from "@/lib/shadows";
import { BackButton, goBackOr } from "@/components/ui/BackButton";
import { useThemeColors } from "@/lib/theme/useThemeColors";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { deleteAccount } from "@/lib/account/deleteAccount";
import { SUPPORT_EMAIL } from "@/lib/support";

function Row({ icon, text }: { icon: Parameters<typeof Icon>[0]["name"]; text: string }) {
  const theme = useThemeColors();
  return (
    <View className="flex-row items-start mb-2.5">
      <View className="mt-0.5 mr-2.5">
        <Icon name={icon} size={14} color={theme.inkFaint} />
      </View>
      <Text className="flex-1 font-body text-xs text-ink-soft leading-5">{text}</Text>
    </View>
  );
}

export default function DeleteAccountScreen() {
  const theme = useThemeColors();
  const { t } = useTranslation();
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Fjala që duhet shkruar — mbrojtje nga shtypja pa dashje ("FSHIJ" / "DELETE").
  const CONFIRM_WORD = t("del_confirm_word");

  const canDelete = confirm.trim().toUpperCase() === CONFIRM_WORD && !loading;

  async function handleDelete() {
    if (!canDelete) return;
    setLoading(true);
    setError(null);

    const result = await deleteAccount();
    if (result.ok) {
      router.replace("/(auth)/welcome");
      return;
    }

    setError(result.message);
    setLoading(false);
  }

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View className="flex-row items-center px-5 pt-2 mb-4">
          <BackButton fallback="/(main)/more" className="mr-3" />
          <Text className="font-display text-xl text-ink">{t("delete_account")}</Text>
        </View>

        <ScrollView className="px-5" keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 40 }}>
          <Text className="font-body text-sm text-ink-soft leading-6 mb-5">
            {t("del_intro")}
          </Text>

          <View style={shadows.soft} className="bg-surface rounded-xl2 p-4 mb-4">
            <Text className="font-bodySemibold text-sm text-ink mb-3">{t("del_what_goes")}</Text>
            <Row icon="baby" text={t("del_goes_baby")} />
            <Row icon="camera" text={t("del_goes_moments")} />
            <Row icon="comment" text={t("del_goes_community")} />
            <Row icon="bell" text={t("del_goes_notifications")} />
          </View>

          <View style={shadows.soft} className="bg-surface rounded-xl2 p-4 mb-5">
            <Text className="font-bodySemibold text-sm text-ink mb-3">{t("del_what_stays")}</Text>
            <Row icon="cube" text={t("del_stays_orders")} />
          </View>

          <Text className="font-bodyMedium text-sm text-ink-soft mb-2">
            {t("del_type_before")}
            <Text className="font-bodySemibold text-ink">{CONFIRM_WORD}</Text>
            {t("del_type_after")}
          </Text>
          <TextInput
            value={confirm}
            onChangeText={setConfirm}
            placeholder={CONFIRM_WORD}
            placeholderClassName="text-ink-faint"
            autoCapitalize="characters"
            autoCorrect={false}
            style={shadows.soft}
            className="bg-surface rounded-xl2 px-4 py-3 font-body text-sm text-ink mb-4"
          />

          {error && (
            <View className="bg-orange-bg rounded-xl2 p-3 mb-4">
              <Text className="font-body text-xs text-orange leading-5">{error}</Text>
            </View>
          )}

          <Pressable
            onPress={handleDelete}
            disabled={!canDelete}
            accessibilityRole="button"
            className="bg-orange rounded-xl2 py-3.5 items-center"
            style={{ opacity: canDelete ? 1 : 0.5 }}
          >
            {loading ? (
              <ActivityIndicator color={theme.onAccent} />
            ) : (
              <Text className="font-bodySemibold text-sm text-on-accent">{t("del_confirm_action")}</Text>
            )}
          </Pressable>

          <Pressable onPress={() => goBackOr("/(main)/more")} className="items-center mt-4">
            <Text className="font-bodyMedium text-sm text-olive">{t("del_cancel")}</Text>
          </Pressable>

          <Text className="font-body text-[11px] text-ink-faint text-center leading-5 mt-8">
            {t("del_blocked_note", { email: SUPPORT_EMAIL })}
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
