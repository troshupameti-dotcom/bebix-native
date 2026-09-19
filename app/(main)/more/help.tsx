import { useState } from "react";
import { View, Text, ScrollView, Pressable, Linking } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Icon } from "@/components/ui/Icon";
import { shadows } from "@/lib/shadows";
import { BackButton } from "@/components/ui/BackButton";
import { SUPPORT_EMAIL } from "@/lib/support";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import type { TranslationKey } from "@/lib/i18n/translations";

const FAQS: { q: TranslationKey; a: TranslationKey }[] = [
  { q: "help_q1", a: "help_a1" },
  { q: "help_q2", a: "help_a2" },
  { q: "help_q3", a: "help_a3" },
  { q: "help_q4", a: "help_a4" },
  { q: "help_q5", a: "help_a5" },
];

export default function HelpCenterScreen() {
  const { t } = useTranslation();
  const [open, setOpen] = useState<number | null>(null);

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      <View className="flex-row items-center px-5 pt-2 mb-4">
        <BackButton fallback="/(main)/more" className="mr-3" />
        <Text className="font-display text-xl text-ink">{t("help_title")}</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <Text className="font-bodyMedium text-xs text-ink-faint uppercase px-5 mb-2">{t("help_faq")}</Text>
        <View className="px-5 mb-6">
          {FAQS.map((f, i) => (
            <View key={f.q} style={shadows.soft} className="bg-surface rounded-xl2 mb-3 overflow-hidden">
              <Pressable onPress={() => setOpen(open === i ? null : i)} className="flex-row items-center justify-between px-4 py-3.5">
                <Text className="font-bodyMedium text-sm text-ink flex-1 mr-2">{t(f.q)}</Text>
                <Icon name={open === i ? "chevronLeft" : "chevronRight"} size={16} color="#A79D8A" />
              </Pressable>
              {open === i && (
                <View className="px-4 pb-4">
                  <Text className="font-body text-sm text-ink-soft leading-5">{t(f.a)}</Text>
                </View>
              )}
            </View>
          ))}
        </View>

        <Text className="font-bodyMedium text-xs text-ink-faint uppercase px-5 mb-2">{t("help_contact")}</Text>
        <View className="px-5">
          <Pressable
            onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(t("help_email_subject"))}`)}
            style={shadows.soft}
            className="flex-row items-center bg-surface rounded-xl2 px-4 py-3.5 mb-3"
          >
            <View className="w-8 h-8 rounded-full bg-cream-soft items-center justify-center mr-3">
              <Icon name="send" size={15} color="#6E7452" />
            </View>
            <Text className="font-bodyMedium text-sm text-ink flex-1">{t("help_send_email")}</Text>
            <Icon name="chevronRight" size={16} color="#A79D8A" />
          </Pressable>
          <Text className="font-body text-xs text-ink-faint px-1">
            {t("help_reply_time")}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}