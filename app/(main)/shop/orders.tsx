import { useCallback, useState } from "react";
import { View, Text, ScrollView, Pressable, Image, ActivityIndicator, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Icon } from "@/components/ui/Icon";
import { shadows } from "@/lib/shadows";
import { useThemeColors } from "@/lib/theme/useThemeColors";
import { BackButton } from "@/components/ui/BackButton";
import {
  fetchMyOrders, orderStatusLabel, orderStatusHint, ORDER_TIMELINE,
  MyOrder, OrderStatus,
} from "@/lib/shop/orders";

function statusStyle(status: OrderStatus): { bg: string; text: string } {
  if (status === "delivered") return { bg: "bg-olive-bg", text: "text-olive" };
  if (status === "cancelled") return { bg: "bg-cream-soft", text: "text-ink-faint" };
  return { bg: "bg-orange-bg", text: "text-orange" };
}

function orderDate(iso: string): string {
  return new Date(iso).toLocaleDateString("sq-AL", { day: "numeric", month: "long", year: "numeric" });
}

/** Vijë kohore e thjeshtë: ku është porosia tani, pa data të sajuara. */
function Timeline({ status }: { status: OrderStatus }) {
  if (status === "cancelled") return null;
  const currentIndex = ORDER_TIMELINE.indexOf(status);

  return (
    <View className="flex-row items-center mt-3">
      {ORDER_TIMELINE.map((step, i) => {
        const reached = i <= currentIndex;
        return (
          <View key={step} className="flex-1 flex-row items-center">
            <View className={`w-2.5 h-2.5 rounded-full ${reached ? "bg-olive" : "bg-cream-line"}`} />
            {i < ORDER_TIMELINE.length - 1 && (
              <View className={`flex-1 h-[2px] ${i < currentIndex ? "bg-olive" : "bg-cream-line"}`} />
            )}
          </View>
        );
      })}
    </View>
  );
}

function OrderCard({ order }: { order: MyOrder }) {
  const theme = useThemeColors();
  const badge = statusStyle(order.status);
  const itemCount = order.items.reduce((sum, i) => sum + i.qty, 0);

  return (
    <View style={shadows.soft} className="bg-surface rounded-xl2 p-4 mb-3">
      <View className="flex-row items-center justify-between mb-1">
        <Text className="font-bodySemibold text-sm text-ink">#{order.id.slice(0, 8).toUpperCase()}</Text>
        <View className={`rounded-full px-2.5 py-1 ${badge.bg}`}>
          <Text className={`font-bodySemibold text-[11px] ${badge.text}`}>{orderStatusLabel(order.status)}</Text>
        </View>
      </View>
      <Text className="font-body text-xs text-ink-faint">{orderDate(order.createdAt)}</Text>

      <Timeline status={order.status} />
      <Text className="font-body text-xs text-ink-soft leading-5 mt-2.5">{orderStatusHint(order.status)}</Text>

      <View className="mt-3 pt-3 border-t border-cream-line">
        {order.items.map((item) => (
          <View key={item.id} className="flex-row items-center mb-2.5">
            <View className="w-11 h-11 rounded-xl bg-cream-soft items-center justify-center overflow-hidden mr-3">
              {item.imageUrl ? (
                <Image source={{ uri: item.imageUrl }} className="w-full h-full" resizeMode="cover" />
              ) : (
                <Icon name="cube" size={18} color={theme.inkFaint} />
              )}
            </View>
            <Text className="flex-1 font-body text-xs text-ink" numberOfLines={2}>{item.name}</Text>
            <Text className="font-body text-xs text-ink-faint mx-2">×{item.qty}</Text>
            <Text className="font-bodyMedium text-xs text-ink">€{(item.price * item.qty).toFixed(2)}</Text>
          </View>
        ))}
      </View>

      <View className="flex-row items-center justify-between pt-2 border-t border-cream-line">
        <Text className="font-body text-xs text-ink-soft">
          {itemCount} {itemCount === 1 ? "artikull" : "artikuj"} · paguhet në dorëzim
        </Text>
        <Text className="font-bodySemibold text-base text-ink">€{order.total.toFixed(2)}</Text>
      </View>

      <Text className="font-body text-[11px] text-ink-faint mt-2" numberOfLines={1}>
        {order.address}, {order.city} · {order.phone}
      </Text>
    </View>
  );
}

export default function MyOrdersScreen() {
  const router = useRouter();
  const [orders, setOrders] = useState<MyOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      setOrders(await fetchMyOrders());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Porositë nuk u ngarkuan.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      <View className="flex-row items-center px-5 pt-2 mb-4">
        <BackButton fallback="/(main)/shop" className="mr-3" />
        <Text className="font-display text-2xl text-ink">Porositë e mia</Text>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator className="text-olive" />
        </View>
      ) : (
        <ScrollView
          className="px-5"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 40 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />
          }
        >
          {error ? (
            <View style={shadows.soft} className="bg-surface rounded-xl2 p-4">
              <Text className="font-body text-sm text-ink-soft mb-3">{error}</Text>
              <Pressable onPress={load}>
                <Text className="font-bodyMedium text-sm text-olive">Provo përsëri</Text>
              </Pressable>
            </View>
          ) : orders.length === 0 ? (
            <View className="items-center mt-16 px-6">
              <Icon name="cube" size={28} color="#A79D8A" />
              <Text className="font-bodySemibold text-sm text-ink mt-3 mb-1">Ende nuk ke porosi</Text>
              <Text className="font-body text-xs text-ink-soft text-center leading-5 mb-4">
                Porositë që bën te dyqani shfaqen këtu, bashkë me statusin e tyre.
              </Text>
              <Pressable onPress={() => router.push("/shop")} className="bg-olive px-5 py-2.5 rounded-full">
                <Text className="font-bodySemibold text-xs text-on-accent">Shiko produktet</Text>
              </Pressable>
            </View>
          ) : (
            orders.map((order) => <OrderCard key={order.id} order={order} />)
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
