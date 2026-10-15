import { Text, View } from "react-native";
import { Icon } from "@/components/ui/Icon";
import { useTones } from "@/lib/theme/tone";
import { shadows } from "@/lib/shadows";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { postpartumWeek, weekTipKey } from "@/lib/parent/postpartum";

/** "Për ty, mami": këshilla e javës në 12 javët pas lindjes. ("Kujdesi për ty" u hoq më 15 tetor.) */
export function PostpartumCard({ babyDob, relation }: { babyDob: string | null; relation: string | null }) {
  const tones = useTones();
  const { t } = useTranslation();
  const week = postpartumWeek(babyDob, relation);
  if (!week) return null;
  return (
    <View
      style={[shadows.soft, { backgroundColor: tones.pink.tintBg }]}
      className="mt-5 rounded-xl3 p-4"
    >
      <View className="mb-1 flex-row items-center gap-2">
        <Icon name="heart" size={15} color={tones.pink.tint} />
        <Text className="flex-1 font-bodySemibold text-[13px]" style={{ color: tones.pink.tint }}>
          {t("pp_card_title", { n: week })}
        </Text>
      </View>
      <Text className="font-bodyMedium text-[14.5px] leading-5" style={{ color: tones.ink }}>
        {t(weekTipKey(week))}
      </Text>
    </View>
  );
}
