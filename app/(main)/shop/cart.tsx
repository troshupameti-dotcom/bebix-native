import { View, Text, Pressable, Image, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAppState } from "@/lib/state/AppStateContext";
import { Icon } from "@/components/ui/Icon";
import { shadows } from "@/lib/shadows";
import { ZoomScreen } from "@/components/ZoomScreen";

export default function CartScreen() {
  const router = useRouter();
  const { state, updateCartQty, removeFromCart, clearCart, cartTotal } = useAppState();

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      <ZoomScreen>
        <View className="flex-row items-center px-5 pt-2 mb-4">
          <Pressable onPress={() => router.back()} style={shadows.soft} className="w-10 h-10 rounded-full bg-surface items-center justify-center mr-3">
            <Icon name="chevronLeft" size={18} color="#2C271F" />
          </Pressable>
          <Text className="font-display text-2xl text-ink">Shporta</Text>
        </View>

        {state.cartItems.length === 0 ? (
          <View className="items-center mt-16 px-8">
            <Icon name="cart" size={28} color="#A79D8A" />
            <Text className="font-body text-sm text-ink-soft mt-3 text-center">Shporta jote është bosh.</Text>
            <Pressable onPress={() => router.push("/shop")} className="mt-4">
              <Text className="font-bodyMedium text-sm text-olive">Shiko produktet</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <ScrollView className="px-5" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
              {state.cartItems.map((item) => (
                <View key={item.id} style={shadows.soft} className="bg-surface rounded-xl2 p-3 flex-row items-center mb-3">
                  <View className="w-16 h-16 rounded-xl bg-olive-bg items-center justify-center overflow-hidden mr-3">
                    {item.imageUrl ? (
                      <Image source={{ uri: item.imageUrl }} className="w-full h-full" resizeMode="cover" />
                    ) : (
                      <Icon name={item.icon as any} size={22} color="#6E7452" />
                    )}
                  </View>

                  <View className="flex-1">
                    <Text className="font-bodyMedium text-sm text-ink" numberOfLines={2}>{item.name}</Text>
                    <Text className="font-bodySemibold text-sm text-ink mt-1">€{item.price.toFixed(2)}</Text>

                    <View className="flex-row items-center mt-2">
                      <Pressable
                        onPress={() => updateCartQty(item.id, item.qty - 1)}
                        className="w-7 h-7 rounded-full bg-cream-soft items-center justify-center"
                      >
                        <Text className="font-bodyMedium text-sm text-ink">–</Text>
                      </Pressable>
                      <Text className="font-bodyMedium text-sm text-ink mx-3">{item.qty}</Text>
                      <Pressable
                        onPress={() => updateCartQty(item.id, item.qty + 1)}
                        className="w-7 h-7 rounded-full bg-cream-soft items-center justify-center"
                      >
                        <Text className="font-bodyMedium text-sm text-ink">+</Text>
                      </Pressable>

                      <Pressable onPress={() => removeFromCart(item.id)} className="ml-auto">
                        <Text className="font-bodyMedium text-xs text-orange">Hiqe</Text>
                      </Pressable>
                    </View>
                  </View>
                </View>
              ))}

              <Pressable onPress={clearCart} style={shadows.soft} className="bg-surface rounded-xl2 py-3 items-center mt-1">
                <Text className="font-bodyMedium text-sm text-orange">Zbraz shportën</Text>
              </Pressable>
            </ScrollView>

            <View className="px-5 pt-3 pb-6 bg-cream" style={shadows.softLg}>
              <View className="flex-row items-center justify-between mb-3">
                <Text className="font-bodyMedium text-sm text-ink-soft">Totali</Text>
                <Text className="font-display text-xl text-ink">€{cartTotal().toFixed(2)}</Text>
              </View>
              <Pressable
                onPress={() => router.push("/shop/checkout")}
                className="bg-olive rounded-xl2 py-3.5 items-center"
              >
                <Text className="font-bodyMedium text-sm text-white">Vazhdo me Porosinë</Text>
              </Pressable>
            </View>
          </>
        )}
      </ZoomScreen>
    </SafeAreaView>
  );
}