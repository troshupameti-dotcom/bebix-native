import { Text, Pressable, View } from "react-native";
import { router } from "expo-router";
import { Icon } from "@/components/ui/Icon";
import { TONES } from "@/components/baby/LogTiles";
import { shadows } from "@/lib/shadows";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { postpartumWeek, weekTipKey } from "@/lib/parent/postpartum";

/** "Për ty, mami": këshilla e javës në 12 javët pas lindjes; hap "Kujdesi për ty" për kujtesat. */
export function PostpartumCard({ babyDob, relation }: { babyDob: string | null; relation: string | null }) {
  const { t } = useTranslation();
  const week = postpartumWeek(babyDob, relation);
  if (!week) return null;
  return (
    <Pressable
      onPress={() => router.push("/(main)/baby/parent-care")}
      accessibilityRole="button"
      style={[shadows.soft, { backgroundColor: TONES.pink.tintBg }]}
      className="mt-5 rounded-xl3 p-4"
    >
      <View className="mb-1 flex-row items-center gap-2">
        <Icon name="heart" size={15} color={TONES.pink.tint} />
        <Text className="flex-1 font-bodySemibold text-[13px]" style={{ color: TONES.pink.tint }}>
          {t("pp_card_title", { n: week })}
        </Text>
        <Icon name="chevronRight" size={14} color={TONES.pink.tint} />
      </View>
      <Text className="font-bodyMedium text-[14.5px] leading-5" style={{ color: "#17212B" }}>
        {t(weekTipKey(week))}
      </Text>
    </Pressable>
  );
}
