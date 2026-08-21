import { View, Text, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAppState } from "@/lib/state/AppStateContext";
import { Icon } from "@/components/ui/Icon";
import { shadows } from "@/lib/shadows";
import { ZoomScreen } from "@/components/ZoomScreen";

export default function WishlistScreen() {
  const router = useRouter();
  const { state, toggleFavorite } = useAppState();

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      <ZoomScreen>
        <View className="flex-row items-center px-5 pt-2 mb-4">
          <Pressable onPress={() => router.back()} style={shadows.soft} className="w-10 h-10 rounded-full bg-surface items-center justify-center mr-3">
            <Icon name="chevronLeft" size={18} color="#2C271F" />
          </Pressable>
          <Text className="font-display text-2xl text-ink">Të Preferuarat</Text>
        </View>

        <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
          {state.favorites.length === 0 ? (
            <View className="items-center mt-16 px-8">
              <Icon name="heart" size={28} color="#A79D8A" />
              <Text className="font-body text-sm text-ink-soft mt-3 text-center">
                Ende s'ke shtuar produkte te të preferuarat. Shtyp ikonën e zemrës te ndonjë produkt për ta ruajtur këtu.
              </Text>
            </View>
          ) : (
            <View className="px-5">
              {state.favorites.map((f) => (
                <Pressable
                  key={f.id}
                  onPress={() => router.push(`/shop/${f.id}`)}
                  style={shadows.soft}
                  className="flex-row items-center bg-surface rounded-xl2 p-3 mb-3"
                >
                  <View className="w-12 h-12 rounded-xl bg-olive-bg items-center justify-center mr-3">
                    <Icon name={f.icon as any} size={20} color="#6E7452" />
                  </View>
                  <View className="flex-1">
                    <Text className="font-bodyMedium text-sm text-ink" numberOfLines={1}>{f.name}</Text>
                    <Text className="font-bodySemibold text-sm text-ink-soft mt-0.5">{f.price}</Text>
                  </View>
                  <Pressable onPress={() => toggleFavorite(f)} className="p-2">
                    <Icon name="close" size={16} color="#A79D8A" />
                  </Pressable>
                </Pressable>
              ))}
            </View>
          )}
        </ScrollView>
      </ZoomScreen>
    </SafeAreaView>
  );
}