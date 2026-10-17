import { useEffect } from "react";
import { BackHandler, Pressable, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChevronRight, X, type LucideIcon } from "lucide-react-native";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { useThemeColors } from "@/lib/theme/useThemeColors";
import type { ThemedTone } from "@/lib/theme/tone";
import { haptics } from "@/lib/haptics";

export type QuickOption = {
  key: string;
  label: string;
  hint?: string;
  icon: LucideIcon;
  tone: ThemedTone;
  onPress: () => void;
};

/** Kreu i app-it: aty kthehet "Mbyll" dhe "mbrapa", sepse zgjedhja shpesh hapet si ekrani i parë (widget, ikona). */
export const QUICK_HOME = "/(main)/baby";

export function closeQuick() {
  haptics.tap();
  router.replace(QUICK_HOME);
}

/**
 * Zgjedhja e shpejtë që hapet nga widget-i dhe nga prekja e gjatë e ikonës: një titull dhe disa butona të mëdhenj
 * (një prekje = shënimi). "Mbrapa" i Android-it dhe "Mbyll" çojnë te kreu, jo jashtë app-it.
 */
export function QuickChooser({ title, options }: { title: string; options: QuickOption[] }) {
  const { t } = useTranslation();
  const theme = useThemeColors();

  useEffect(() => {
    // setTimeout: regjistrohet pas trajtuesit të navigimit, që ky të thirret i pari.
    let sub: { remove: () => void } | null = null;
    const id = setTimeout(() => {
      sub = BackHandler.addEventListener("hardwareBackPress", () => {
        closeQuick();
        return true;
      });
    }, 0);
    return () => {
      clearTimeout(id);
      sub?.remove();
    };
  }, []);

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top", "bottom"]}>
      <View className="flex-row items-center justify-between px-5 pt-2 pb-3">
        <Text className="font-display text-2xl text-ink" accessibilityRole="header">
          {title}
        </Text>
        <Pressable
          onPress={closeQuick}
          accessibilityRole="button"
          accessibilityLabel={t("quick_close")}
          hitSlop={8}
          className="h-10 w-10 items-center justify-center rounded-full bg-surface-alt"
        >
          <X size={20} color={theme.ink} strokeWidth={2.2} />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24, gap: 10 }}>
        {options.map(({ key, label, hint, icon: Glyph, tone, onPress }) => (
          <Pressable
            key={key}
            onPress={onPress}
            accessibilityRole="button"
            accessibilityLabel={hint ? `${label}, ${hint}` : label}
            style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1, backgroundColor: tone.tintBg })}
            className="min-h-[72px] flex-row items-center rounded-3xl px-4 py-3"
          >
            <View style={{ backgroundColor: tone.chip }} className="h-11 w-11 items-center justify-center rounded-2xl">
              <Glyph size={22} color={tone.tint} strokeWidth={2.2} />
            </View>
            <View className="ml-3 flex-1">
              <Text style={{ color: tone.ink }} className="font-bodySemibold text-lg">
                {label}
              </Text>
              {hint ? (
                <Text style={{ color: tone.inkSoft }} className="font-body text-sm">
                  {hint}
                </Text>
              ) : null}
            </View>
            <ChevronRight size={20} color={tone.inkSoft} strokeWidth={2} />
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
