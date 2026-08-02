import { View, Text, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAppState } from "@/lib/state/AppStateContext";
import { Icon } from "@/components/ui/Icon";
import { shadows } from "@/lib/shadows";

export default function AppearanceScreen() {
  const router = useRouter();
  const { state, setDarkMode } = useAppState();

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      <View className="flex-row items-center px-5 pt-2 mb-5">
        <Pressable onPress={() => router.back()} style={shadows.soft} className="w-10 h-10 rounded-full bg-surface items-center justify-center mr-3">
          <Icon name="chevronLeft" size={18} color="#2C271F" />
        </Pressable>
        <Text className="font-display text-xl text-ink">Pamja</Text>
      </View>

      <View className="px-5">
        <Text className="font-bodySemibold text-xs text-ink-faint uppercase mb-2">Tema</Text>
        <View style={shadows.soft} className="bg-surface rounded-xl2 overflow-hidden mb-6">
          <Pressable onPress={() => setDarkMode(false)} className="flex-row items-center justify-between px-4 py-3.5 border-b border-cream-line">
            <View className="flex-row items-center">
              <Icon name="globe" size={16} color="#6E7452" />
              <Text className="font-bodyMedium text-sm text-ink ml-3">E Çelët</Text>
            </View>
            {!state.darkMode && <Icon name="check" size={16} color="#6E7452" />}
          </Pressable>
          <Pressable onPress={() => setDarkMode(true)} className="flex-row items-center justify-between px-4 py-3.5">
            <View className="flex-row items-center">
              <Icon name="moon" size={16} color="#6E7452" />
              <Text className="font-bodyMedium text-sm text-ink ml-3">E Errët</Text>
            </View>
            {state.darkMode && <Icon name="check" size={16} color="#6E7452" />}
          </Pressable>
        </View>

        <View style={shadows.soft} className="bg-olive-bg rounded-xl2 p-4">
          <Text className="font-bodySemibold text-xs text-ink mb-1">Shënim</Text>
          <Text className="font-body text-xs text-ink-soft leading-5">
            Ndryshimi këtu ruhet realisht. Vetë ngjyrat/dizajni i dark mode-it duhet të zbatohen te ekranet (p.sh. `dark:` klasa te NativeWind) —
            aktualisht sfondet janë të fiksuara te ngjyrat e çelëta. Nëse do, e ndërtojmë temën e errët për ekranet ekzistuese si hap tjetër.
          </Text>
        </View>

        <Text className="font-bodySemibold text-xs text-ink-faint uppercase mt-6 mb-2">Të tjera</Text>
        <View style={shadows.soft} className="bg-surface rounded-xl2 overflow-hidden opacity-50">
          {["Madhësia e Shkronjave", "Densiteti i Ekranit", "Animacione", "Kontrasti i Lartë"].map((label, i, arr) => (
            <View key={label} className={`flex-row items-center justify-between px-4 py-3.5 ${i < arr.length - 1 ? "border-b border-cream-line" : ""}`}>
              <Text className="font-bodyMedium text-sm text-ink-faint">{label}</Text>
              <Text className="font-body text-[10px] text-ink-faint">Së shpejti</Text>
            </View>
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
}