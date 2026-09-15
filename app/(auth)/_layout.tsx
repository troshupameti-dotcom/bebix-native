import { View } from "react-native";
import { Stack } from "expo-router";
import { LanguageToggle } from "@/components/ui/LanguageToggle";

export default function AuthLayout() {
  return (
    <View style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false, animation: "slide_from_right" }} />
      <LanguageToggle />
    </View>
  );
}