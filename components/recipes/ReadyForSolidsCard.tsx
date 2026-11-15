import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Check } from "lucide-react-native";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { useThemeColors } from "@/lib/theme/useThemeColors";
import { haptics } from "@/lib/haptics";
import type { TranslationKey } from "@/lib/i18n/translations";

/** Pas "E kuptova" karta s'del më. I njëjti çelës si kur ishte te faqja kryesore, që të mos rishfaqet. */
export const READY_SEEN_KEY = "bebix_recipes_ready_seen_v1";
const SIGNS: TranslationKey[] = ["recipes_ready_sign_1", "recipes_ready_sign_2", "recipes_ready_sign_3", "recipes_ready_sign_4"];

/** Mosha kur karta ka kuptim: pak para ushqimeve të para (4–5 muaj). */
export function showsReadyCard(months: number | null): boolean {
  return months != null && months >= 4 && months < 6;
}

/**
 * "Gati për ushqimet e para?": shenjat e gatishmërisë, në krye të skedës Ushqim për bebet 4–5 muajsh, derisa prindi
 * shtyp "E kuptova". Deri më 14 nëntor rrinte te faqja kryesore bashkë me "Ide për sot".
 */
export function ReadyForSolidsCard({ months }: { months: number | null }) {
  const { t } = useTranslation();
  const c = useThemeColors();
  const show = showsReadyCard(months);
  const [seen, setSeen] = useState<boolean | null>(null);

  useEffect(() => {
    if (!show) return;
    let alive = true;
    AsyncStorage.getItem(READY_SEEN_KEY)
      .then((v) => alive && setSeen(v === "1"))
      .catch(() => alive && setSeen(false));
    return () => {
      alive = false;
    };
  }, [show]);

  if (!show || seen !== false) return null;

  const dismiss = () => {
    haptics.tap();
    setSeen(true);
    void AsyncStorage.setItem(READY_SEEN_KEY, "1").catch(() => {});
  };

  return (
    <View className="mb-4 rounded-3xl border border-cream-line bg-surface p-4">
      <Text className="font-bodySemibold text-[16px] text-ink" accessibilityRole="header">
        {t("recipes_ready_title")}
      </Text>
      <Text className="mt-1 font-body text-[13.5px] leading-5 text-ink-soft">{t("recipes_ready_body")}</Text>
      <View className="mt-3" style={{ gap: 8 }}>
        {SIGNS.map((k) => (
          <View key={k} className="flex-row items-center" style={{ gap: 10 }}>
            <View className="h-6 w-6 items-center justify-center rounded-full bg-cream-soft">
              <Check size={13} color={c.olive} strokeWidth={2.4} />
            </View>
            <Text className="flex-1 font-body text-[14.5px] text-ink">{t(k)}</Text>
          </View>
        ))}
      </View>
      <Text className="mt-3 font-body text-[12.5px] leading-[18px] text-ink-faint">{t("recipes_ready_note")}</Text>
      <Pressable onPress={dismiss} accessibilityRole="button" className="mt-4 items-center justify-center rounded-full border border-ink/10" style={{ minHeight: 44 }}>
        <Text className="font-bodyMedium text-[13.5px] text-ink">{t("recipes_ready_dismiss")}</Text>
      </Pressable>
    </View>
  );
}
