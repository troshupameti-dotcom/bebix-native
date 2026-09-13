import { View, Text, Pressable } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { MotiView } from "moti";
import { SafeAreaView } from "react-native-safe-area-context";
import { PrimaryButton } from "@/components/auth/PrimaryButton";
import { Icon } from "@/components/ui/Icon";
import { useTranslation } from "@/lib/i18n/LanguageContext";

export default function RequireAccountScreen() {
  const { t } = useTranslation();
  const { redirect } = useLocalSearchParams<{ redirect?: string }>();

  function handleCreateProfile() {
    router.push({ pathname: "/(auth)/create-profile", params: redirect ? { redirect } : undefined });
  }

  function handleLogin() {
    router.push({ pathname: "/(auth)/login", params: redirect ? { redirect } : undefined });
  }

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top", "bottom"]}>
      <View className="flex-row px-4 pt-2">
        <Pressable onPress={() => router.back()} hitSlop={8} className="h-10 w-10 items-center justify-center">
          <Icon name="chevronLeft" size={20} color="#2C271F" />
        </Pressable>
      </View>

      <View className="flex-1 items-center justify-center px-8">
        <MotiView
          from={{ opacity: 0, translateY: 12 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: "timing", duration: 400 }}
          className="items-center"
        >
          <View className="h-16 w-16 items-center justify-center rounded-full bg-olive/10">
            <Icon name="baby" size={28} color="#6E7452" />
          </View>

          <Text className="mt-6 text-center font-display text-2xl text-ink">{t("require_account_title")}</Text>
          <Text className="mt-3 text-center font-body text-sm text-ink-soft">{t("require_account_sub")}</Text>
        </MotiView>
      </View>

      <View className="gap-4 px-6 pb-6">
        <PrimaryButton label={t("require_account_create")} onPress={handleCreateProfile} />
        <Pressable onPress={handleLogin} className="items-center py-2">
          <Text className="font-body text-sm text-ink-soft">
            {t("require_account_have_account")} <Text className="font-bodyMedium text-orange">{t("require_account_login")}</Text>
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}