import { useEffect, useState } from "react";
import { View, Text, Pressable } from "react-native";
import { MotiView } from "moti";
import { Icon } from "@/components/ui/Icon";
import { shadows } from "@/lib/shadows";
import { haptics } from "@/lib/haptics";
import { useTranslation } from "@/lib/i18n/LanguageContext";

/** Sa sekonda rri shiriti pas ruajtjes. */
export const JUST_SAVED_MS = 5000;

/**
 * Shiriti i vogël pas një shënimi me një prekje: "U shënua · Ndrysho · Fshi", për ~5 sekonda.
 * Pas kësaj, korrigjimi bëhet te lista (prekja e rreshtit hap formularin, rrëshqitja e fshin).
 * `savedKey` ndryshon me çdo shënim të ri, që shiriti të rinisë numërimin.
 */
export function JustSaved({
  savedKey,
  text,
  onEdit,
  onDelete,
  onDone,
}: {
  savedKey: string;
  text: string;
  onEdit: () => void;
  onDelete: () => void;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const [shownKey, setShownKey] = useState(savedKey);
  if (shownKey !== savedKey) setShownKey(savedKey);

  useEffect(() => {
    const id = setTimeout(onDone, JUST_SAVED_MS);
    return () => clearTimeout(id);
  }, [shownKey, onDone]);

  return (
    <MotiView
      key={shownKey}
      from={{ opacity: 0, translateY: -6 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: "timing", duration: 180 }}
      style={shadows.soft}
      className="mt-3 flex-row items-center rounded-2xl border border-ink/10 bg-surface px-4"
    >
      <Icon name="check" size={16} color="#6E7452" />
      <Text className="ml-2 flex-1 py-3 font-bodyMedium text-[13.5px] text-ink" numberOfLines={1}>
        {text}
      </Text>
      <Pressable
        onPress={() => {
          haptics.select();
          onEdit();
        }}
        accessibilityRole="button"
        hitSlop={8}
        className="px-3 py-3"
      >
        <Text className="font-bodySemibold text-[13.5px] text-olive">{t("edit_action")}</Text>
      </Pressable>
      <View className="h-5 w-px bg-ink/10" />
      <Pressable
        onPress={() => {
          haptics.warning();
          onDelete();
        }}
        accessibilityRole="button"
        hitSlop={8}
        className="py-3 pl-3"
      >
        <Text className="font-bodySemibold text-[13.5px] text-orange">{t("delete_action")}</Text>
      </Pressable>
    </MotiView>
  );
}
