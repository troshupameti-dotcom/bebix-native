import { Pressable } from "react-native";
import { Icon } from "@/components/ui/Icon";

type AddTileProps = {
  onPress: () => void;
  style?: object;
};

export function AddTile({ onPress, style }: AddTileProps) {
  return (
    <Pressable
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
