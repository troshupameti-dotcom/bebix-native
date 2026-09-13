import { View, Text, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLanguage } from "@/lib/i18n/LanguageContext";

export function LanguageToggle() {
  const { language, setLanguage } = useLanguage();
  const insets = useSafeAreaInsets();

  return (
    <View
      pointerEvents="box-none"
      style={{ position: "absolute", top: insets.top + 8, left: 16, zIndex: 50 }}
    >
      <View
        className="flex-row rounded-full border border-ink/10 bg-cream-soft p-0.5"
        style={{
          shadowColor: "#2C271F",
          shadowOpacity: 0.1,
          shadowRadius: 6,
          shadowOffset: { width: 0, height: 2 },
          elevation: 4,
        }}
      >
        <Pressable
          onPress={() => setLanguage("sq")}
          className={`rounded-full px-3 py-1.5 ${language === "sq" ? "bg-olive" : ""}`}
        >
          <Text className={`font-bodyMedium text-xs ${language === "sq" ? "text-white" : "text-ink-soft"}`}>SQ</Text>
        </Pressable>
        <Pressable
          onPress={() => setLanguage("en")}
          className={`rounded-full px-3 py-1.5 ${language === "en" ? "bg-olive" : ""}`}
        >
          <Text className={`font-bodyMedium text-xs ${language === "en" ? "text-white" : "text-ink-soft"}`}>EN</Text>
        </Pressable>
      </View>
    </View>
  );
}