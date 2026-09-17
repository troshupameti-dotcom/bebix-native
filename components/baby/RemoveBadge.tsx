import { Pressable, Text } from "react-native";

type RemoveBadgeProps = {
  onPress: () => void;
  style?: object;
};

export function RemoveBadge({ onPress, style }: RemoveBadgeProps) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      className="border-cream"
      style={[
        {
          position: "absolute",
          top: -6,
          right: -6,
          width: 22,
          height: 22,
          borderRadius: 11,
          backgroundColor: "#E2604A",
          alignItems: "center",
          justifyContent: "center",
          borderWidth: 2,
          zIndex: 2,
        },
        style,
      ]}
    >
      <Text style={{ color: "#fff", fontSize: 13, lineHeight: 14, fontWeight: "600" }}>×</Text>
    </Pressable>
  );
}
