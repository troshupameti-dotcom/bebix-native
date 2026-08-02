import { View, Text, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAppState } from "@/lib/state/AppStateContext";
import { Icon } from "@/components/ui/Icon";
import { shadows } from "@/lib/shadows";

/**
 * Ekran bazë i shportës. Për tani gjurmohet vetëm numri total i artikujve
 * (state.cartCount) — jo lista e detajuar e produkteve. Kur të duash
 * checkout të vërtetë (me çmim total, sasi për artikull, heqje artikujsh),
 * na duhet të zgjerojmë AppStateContext me një listë reale `cartItems[]`.
 */
export default function CartScreen() {
  const router = useRouter();
  const { state, bumpCart } = useAppState();

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      <View className="flex-row items-center px-5 pt-2 mb-4">
        <Pressable onPress={() => router.back()} style={shadows.soft} className="w-10 h-10 rounded-full bg-surface items-center justify-center mr-3">
          <Icon name="chevronLeft" size={18} color="#2C271F" />
        </Pressable>
        <Text className="font-display text-2xl text-ink">Shporta</Text>
      </View>

      {state.cartCount === 0 ? (
        <View className="items-center mt-16 px-8">
          <Icon name="cart" size={28} color="#A79D8A" />
          <Text className="font-body text-sm text-ink-soft mt-3 text-center">Shporta jote është bosh.</Text>
          <Pressable onPress={() => router.push("/shop")} className="mt-4">
            <Text className="font-bodySemibold text-sm text-olive">Shiko produktet</Text>
          </Pressable>
        </View>
      ) : (
        <View className="px-5">
          <View style={shadows.soft} className="bg-surface rounded-xl2 p-4 flex-row items-center justify-between mb-4">
            <Text className="font-bodyMedium text-sm text-ink">Artikuj në shportë</Text>
            <Text className="font-display text-lg text-ink">{state.cartCount}</Text>
          </View>
          <Text className="font-body text-xs text-ink-faint mb-4">
            Lista e detajuar e produkteve (me çmime dhe sasi individuale) vjen te faza tjetër, kur shtojmë checkout të vërtetë.
          </Text>
          <Pressable
            onPress={() => bumpCart(-state.cartCount)}
            style={shadows.soft}
            className="bg-surface rounded-xl2 py-3 items-center"
          >
            <Text className="font-bodyMedium text-sm text-orange">Zbraz shportën</Text>
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}