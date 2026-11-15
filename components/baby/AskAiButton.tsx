import { Pressable, View } from "react-native";
import { router } from "expo-router";
import { MessageCircle, Sparkles } from "lucide-react-native";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { useThemeColors } from "@/lib/theme/useThemeColors";
import { haptics } from "@/lib/haptics";
import { shadows } from "@/lib/shadows";

/** Rrethi i butonit. Faqja kryesore lë 120 bosh në fund të listës, ndaj në fund s'mbulon asgjë. */
const SIZE = 58;

/**
 * Butoni i bisedës me asistentin AI, poshtë djathtas te faqja kryesore (si ikona e bisedës te Huckleberry).
 * AI-ja doli nga shiriti poshtë, ku tani rri "Ushqim"; biseda vetë mbetet e njëjta faqe (`/ai-chat`).
 */
export function AskAiButton() {
  const { t } = useTranslation();
  const c = useThemeColors();
  return (
    <Pressable
      onPress={() => {
        haptics.tap();
        router.push("/(main)/ai-chat");
      }}
      accessibilityRole="button"
      accessibilityLabel={t("ai_home_button")}
      hitSlop={6}
      className="active:opacity-85"
      style={[shadows.softLg, { position: "absolute", right: 20, bottom: 18, width: SIZE, height: SIZE, borderRadius: SIZE / 2, backgroundColor: c.olive, alignItems: "center", justifyContent: "center" }]}
    >
      <MessageCircle size={26} color={c.onAccent} strokeWidth={2} />
      {/* Yllthi tregon që biseda është me AI-në, jo me një njeri. */}
      <View
        style={{ position: "absolute", top: 2, right: 2, width: 20, height: 20, borderRadius: 10, backgroundColor: c.orange, borderWidth: 2, borderColor: c.cream, alignItems: "center", justifyContent: "center" }}
      >
        <Sparkles size={10} color={c.onAccent} strokeWidth={2.4} />
      </View>
    </Pressable>
  );
}
