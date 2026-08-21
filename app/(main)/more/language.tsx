import { View, Text, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { Icon } from "@/components/ui/Icon";
import { shadows } from "@/lib/shadows";

const ACTIVE = [
  { code: "sq" as const, label: "Shqip" },
  { code: "en" as const, label: "English" },
];

const PLANNED = ["Deutsch", "Français", "Italiano", "Español", "Türkçe", "العربية"];

export default function LanguageScreen() {
  const router = useRouter();
  const { lang, setLang } = useTranslation();

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      <View className="flex-row items-center px-5 pt-2 mb-5">
        <Pressable onPress={() => router.back()} style={shadows.soft} className="w-10 h-10 rounded-full bg-surface items-center justify-center mr-3">
          <Icon name="chevronLeft" size={18} color="#2C271F" />
        </Pressable>
        <Text className="font-display text-xl text-ink">Gjuha</Text>
      </View>

      <View className="px-5">
        <Text className="font-bodyMedium text-xs text-ink-faint uppercase mb-2">Aktive</Text>
        <View style={shadows.soft} className="bg-surface rounded-xl2 overflow-hidden mb-6">
          {ACTIVE.map((l, i) => (
            <Pressable
              key={l.code}
              onPress={() => setLang(l.code)}
              className={`flex-row items-center justify-between px-4 py-3.5 ${i < ACTIVE.length - 1 ? "border-b border-cream-line" : ""}`}
            >
              <Text className="font-bodyMedium text-sm text-ink">{l.label}</Text>
              {lang === l.code && <Icon name="check" size={16} color="#6E7452" />}
            </Pressable>
          ))}
        </View>

        <Text className="font-bodyMedium text-xs text-ink-faint uppercase mb-2">Së shpejti</Text>
        <View style={shadows.soft} className="bg-surface rounded-xl2 overflow-hidden opacity-50">
          {PLANNED.map((l, i) => (
            <View key={l} className={`flex-row items-center justify-between px-4 py-3.5 ${i < PLANNED.length - 1 ? "border-b border-cream-line" : ""}`}>
              <Text className="font-bodyMedium text-sm text-ink-faint">{l}</Text>
              <Text className="font-body text-[10px] text-ink-faint">Kërkon përkthim</Text>
            </View>
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
}