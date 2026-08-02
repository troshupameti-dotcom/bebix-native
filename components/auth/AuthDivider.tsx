import { View, Text } from "react-native";

export function AuthDivider({ label }: { label: string }) {
  return (
    <View className="flex-row items-center gap-3">
      <View className="h-px flex-1 bg-ink/10" />
      <Text className="font-body text-xs text-ink-faint">{label}</Text>
      <View className="h-px flex-1 bg-ink/10" />
    </View>
  );
}
