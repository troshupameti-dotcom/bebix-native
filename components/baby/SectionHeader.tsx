import { View, Text, Pressable } from "react-native";
import { useTranslation } from "@/lib/i18n/LanguageContext";

type SectionHeaderProps = {
  title: string;
  editable?: boolean;
  editing?: boolean;
  onToggleEdit?: () => void;
  trailing?: React.ReactNode;
};

/** Section title row, optionally with a Modifiko/Kryer edit-mode toggle. */
export function SectionHeader({ title, editable, editing, onToggleEdit, trailing }: SectionHeaderProps) {
  const { t } = useTranslation();
  return (
    <View className="mt-6 mb-2.5 flex-row items-center justify-between">
      <Text className="font-display text-lg text-ink dark:text-cream">{title}</Text>
      {trailing}
      {editable && (
        <Pressable onPress={onToggleEdit} hitSlop={8}>
          <Text className="font-bodySemibold text-[13px] text-orange">
            {editing ? t("done_action") : t("edit_action")}
          </Text>
        </Pressable>
      )}
    </View>
  );
}
