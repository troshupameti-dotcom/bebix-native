import { Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Icon } from "@/components/ui/Icon";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import type { TranslationKey } from "@/lib/i18n/translations";

const POINTS: TranslationKey[] = ["ai_consent_b1", "ai_consent_b2", "ai_consent_b3", "ai_consent_b4"];

/**
 * Pëlqimi para përdorimit të parë të asistentit AI: çfarë është, ku shkojnë pyetjet, çfarë nuk ruhet, për kë është.
 * Apple (5.1.2) kërkon leje të shprehur para se të dhënat t'i shkojnë një AI-je të jashtme; GDPR-i po ashtu.
 */
export function AiConsent({ onAccept, onLater }: { onAccept: () => void; onLater: () => void }) {
  const { t } = useTranslation();
  const router = useRouter();
  return (
    <ScrollView className="flex-1 px-5" contentContainerStyle={{ paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
      <View className="rounded-2xl border border-cream-line bg-surface p-5">
        <View className="mb-3 h-12 w-12 items-center justify-center rounded-full bg-olive-bg">
          <Icon name="sparkle" size={22} color="#6E7452" />
        </View>
        <Text className="font-display text-xl text-ink">{t("ai_consent_title")}</Text>
        <View className="mt-4 gap-3">
          {POINTS.map((key) => (
            <View key={key} className="flex-row">
              <Text className="mr-2 font-bodySemibold text-sm text-olive">•</Text>
              <Text className="flex-1 font-body text-sm leading-5 text-ink-soft">{t(key)}</Text>
            </View>
          ))}
        </View>
        <Pressable
          onPress={() => router.push({ pathname: "/more/legal", params: { section: "ai" } })}
          accessibilityRole="link"
          className="mt-4 self-start"
          hitSlop={8}
        >
          <Text className="font-bodySemibold text-sm text-olive">{t("ai_consent_more")}</Text>
        </Pressable>
        <Pressable onPress={onAccept} accessibilityRole="button" className="mt-5 items-center rounded-full bg-ink py-3.5">
          <Text className="font-bodySemibold text-[15px] text-cream">{t("ai_consent_accept")}</Text>
        </Pressable>
        <Pressable onPress={onLater} accessibilityRole="button" className="mt-2 items-center py-3">
          <Text className="font-bodyMedium text-sm text-ink-soft">{t("ai_consent_later")}</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
