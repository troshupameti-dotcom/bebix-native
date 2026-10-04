import { Pressable } from "react-native";
import { Icon } from "@/components/ui/Icon";
import { useTranslation } from "@/lib/i18n/LanguageContext";

type AddTileProps = {
  onPress: () => void;
  style?: object;
};

export function AddTile({ onPress, style }: AddTileProps) {
  const { t } = useTranslation();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t("a11y_add")}
      onPress={onPress}
      className="border-cream-line"
      style={[
        {
          flex: 1,
          minHeight: 74,
          borderRadius: 22,
          borderWidth: 1.5,
          borderStyle: "dashed",
          alignItems: "center",
          justifyContent: "center",
        },
        style,
      ]}
    >
      <Icon name="plus" size={20} color="#A79D8A" />
    </Pressable>
  );
}
