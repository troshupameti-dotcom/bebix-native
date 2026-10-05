import { View, Text } from "react-native";
import { Icon } from "@/components/ui/Icon";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { useSpecialties } from "@/lib/community/useSpecialties";
import { specialtyEmoji, specialtyLabel } from "@/lib/community/specialties";

/**
 * Emblema e mjekut/ekspertit: reparti i tij ("Pediatër · i verifikuar"). Kur s'i është caktuar reparte
 * (ekspert i vjetër ose para migrimit), del emri i përgjithshëm "Ekspert i verifikuar" ose teksti i lirë i specializimit.
 *
 * `compact` = versioni i vogël për komente (vetëm ikona dhe emri i repartit).
 */
export function ExpertBadge({
  specialty,
  kind,
  compact = false,
}: {
  specialty: string | null;
  kind?: string | null;
  compact?: boolean;
}) {
  const { t, language } = useTranslation();
  const { list } = useSpecialties();
  const label = specialtyLabel(specialty, language, list) ?? (kind?.trim() || null);

  if (compact) {
    return (
      <View className="flex-row items-center bg-olive-bg self-start rounded-full px-2 py-0.5 mb-1">
        <Icon name="shield" size={10} color="#6E7452" />
        <Text className="font-bodySemibold text-[10px] text-olive ml-1" numberOfLines={1}>
          {label ?? t("pc_verified_expert")}
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-row items-center bg-olive-bg self-start rounded-full px-2.5 py-1 mb-3">
      {specialty ? (
        <Text className="text-[11px] mr-1">{specialtyEmoji(specialty, list)}</Text>
      ) : (
        <Icon name="shield" size={11} color="#6E7452" />
      )}
      <Text className="font-bodySemibold text-[10px] text-olive ml-0.5" numberOfLines={1}>
        {label ? t("pc_verified_specialty", { specialty: label }) : t("pc_verified_expert")}
      </Text>
    </View>
  );
}
