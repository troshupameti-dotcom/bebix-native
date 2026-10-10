import { useEffect, useState } from "react";
import { Modal, View, Text, Pressable, ScrollView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { Icon } from "@/components/ui/Icon";
import { TONES, type Tone } from "@/components/baby/LogTiles";
import { shadows } from "@/lib/shadows";
import { haptics } from "@/lib/haptics";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { itemsFor, whatsNewDecision, WHATS_NEW_KEY, WHATS_NEW_VERSION, type WhatsNewItem } from "@/lib/whatsNew";

const TONE_CYCLE: Tone[] = [TONES.purple, TONES.amber, TONES.pink, TONES.green, TONES.blue, TONES.orange];

/** Lista e veçorive të reja; prekja e një rreshti çon te veçoria. */
export function WhatsNewList({ onOpen }: { onOpen?: (item: WhatsNewItem) => void }) {
  const { t } = useTranslation();
  return (
    <View style={{ gap: 10 }}>
      {itemsFor(Platform.OS).map((item, i) => {
        const tone = TONE_CYCLE[i % TONE_CYCLE.length];
        return (
          <Pressable
            key={item.key}
            onPress={item.route ? () => onOpen?.(item) : undefined}
            disabled={!item.route}
            accessibilityRole={item.route ? "button" : "text"}
            style={shadows.soft}
            className="flex-row items-start gap-3 rounded-2xl bg-surface p-4"
          >
            <View className="h-10 w-10 items-center justify-center rounded-full" style={{ backgroundColor: tone.tintBg }}>
              <Icon name={item.icon} size={18} color={tone.tint} />
            </View>
            <View className="flex-1">
              <Text className="font-bodySemibold text-[15px] text-ink">{t(item.titleKey)}</Text>
              <Text className="mt-0.5 font-body text-[13px] leading-5 text-ink-soft">{t(item.bodyKey)}</Text>
            </View>
            {item.route ? <Icon name="chevronRight" size={16} color={tone.tint} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * Del një herë pas përditësimit (shih lib/whatsNew.ts). `hasHistory`: a e ka
 * përdorur app-in më parë — përdoruesi i ri s'e sheh.
 * `onVisibleChange`: Home e pret këtë para se të tregojë festimet.
 */
export function WhatsNewModal({ hasHistory, onVisibleChange }: { hasHistory: boolean; onVisibleChange?: (visible: boolean) => void }) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(WHATS_NEW_KEY)
      .then((seen) => {
        if (!alive) return;
        const decision = whatsNewDecision(seen, hasHistory);
        if (decision === "show") setVisible(true);
        if (decision === "mark-seen") AsyncStorage.setItem(WHATS_NEW_KEY, WHATS_NEW_VERSION).catch(() => {});
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
    // Vendoset një herë, në hapjen e parë të faqes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    onVisibleChange?.(visible);
  }, [visible, onVisibleChange]);

  function close(then?: () => void) {
    haptics.select();
    setVisible(false);
    AsyncStorage.setItem(WHATS_NEW_KEY, WHATS_NEW_VERSION).catch(() => {});
    then?.();
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => close()}>
      <SafeAreaView className="flex-1 bg-cream" edges={["top", "bottom"]}>
        <ScrollView className="flex-1 px-5" contentContainerStyle={{ paddingTop: 24, paddingBottom: 16 }}>
          <Text style={{ fontSize: 40 }}>✨</Text>
          <Text className="mt-2 font-display text-[28px] leading-9 text-ink">{t("wn_title")}</Text>
          <Text className="mb-5 mt-1 font-body text-[14px] leading-6 text-ink-soft">{t("wn_intro")}</Text>
          <WhatsNewList onOpen={(item) => close(() => item.route && router.push(item.route))} />
        </ScrollView>
        <View className="px-5 pb-4 pt-2">
          <Pressable onPress={() => close()} accessibilityRole="button" className="items-center justify-center rounded-2xl bg-ink" style={{ minHeight: 56 }}>
            <Text className="font-bodySemibold text-[15px] text-cream">{t("wn_start")}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </Modal>
  );
}
