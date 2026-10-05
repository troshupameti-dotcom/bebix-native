import { useCallback, useState } from "react";
import { View, Text, ScrollView, Pressable, Image, ActivityIndicator, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Icon } from "@/components/ui/Icon";
import { shadows } from "@/lib/shadows";
import { useThemeColors } from "@/lib/theme/useThemeColors";
import { BackButton } from "@/components/ui/BackButton";
import {
  fetchMyOrders, orderStatusLabelKey, orderHintKeyFor, orderPaymentLabelKey, canPayByCard, ORDER_TIMELINE,
  MyOrder, OrderStatus,
} from "@/lib/shop/orders";
import { fetchGuestOrders } from "@/lib/shop/guestOrders";
import { startCardPayment } from "@/lib/shop/cardPayment";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { useAppState } from "@/lib/state/AppStateContext";

/**
 * Ngjyra e secilit status, që prindi ta kuptojë me një vështrim:
 * në pritje gri, e konfirmuar jeshile, e nisur portokalli, e dorëzuar
 * (e pranuar) kaltër, e anuluar/refuzuar e kuqe.
 */
const STATUS_TONE: Record<OrderStatus, { fg: string; bg: string }> = {
  pending: { fg: "#6B6358", bg: "#ECE8E1" },
  confirmed: { fg: "#2F7D3A", bg: "#DDF0DF" },
  shipped: { fg: "#B8641A", bg: "#F7E4CF" },
  delivered: { fg: "#2E6FA8", bg: "#D9E7F2" },
  cancelled: { fg: "#C0392B", bg: "#F8DAD6" },
};

function orderDate(iso: string, lang: string): string {
  return new Date(iso).toLocaleDateString(lang === "en" ? "en-GB" : "sq-AL", {
    day: "numeric", month: "long", year: "numeric",
  });
}

/** Vijë kohore e thjeshtë: ku është porosia tani, pa data të sajuara. */
function Timeline({ status }: { status: OrderStatus }) {
  if (status === "cancelled") return null;
  const currentIndex = ORDER_TIMELINE.indexOf(status);
  const color = STATUS_TONE[status].fg;

  return (
    <View className="flex-row items-center mt-3">
      {ORDER_TIMELINE.map((step, i) => {
        const reached = i <= currentIndex;
        return (
          <View key={step} className="flex-1 flex-row items-center">
            <View className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: reached ? color : "#E9DFCC" }} />
            {i < ORDER_TIMELINE.length - 1 && (
              <View className="flex-1 h-[2px]" style={{ backgroundColor: i < currentIndex ? color : "#E9DFCC" }} />
            )}
          </View>
        );
      })}
    </View>
  );
}

/** Ngjyra e pagesës: e paguar jeshile, në pritje portokalli, e dështuar e kuqe, e rimbursuar kaltër. */
const PAYMENT_TONE: Record<string, { fg: string; bg: string }> = {
  paid: { fg: "#2F7D3A", bg: "#DDF0DF" },
  pending: { fg: "#B8641A", bg: "#F7E4CF" },
  failed: { fg: "#C0392B", bg: "#F8DAD6" },
  refunded: { fg: "#2E6FA8", bg: "#D9E7F2" },
};

function OrderCard({ order, onPaymentOpened }: { order: MyOrder; onPaymentOpened: () => void }) {
  const theme = useThemeColors();
  const router = useRouter();
  const { addToCart } = useAppState();
  const { t, language } = useTranslation();
  const [payBusy, setPayBusy] = useState(false);
  const [payFailed, setPayFailed] = useState(false);
  const tone = STATUS_TONE[order.status];
  const itemCount = order.items.reduce((sum, i) => sum + i.qty, 0);
  const payTone = order.paymentMethod !== "cod" ? PAYMENT_TONE[order.paymentStatus] : undefined;
  // Dërgesa shfaqet kur ka çmim, ose kur është falas sepse paguhet me kartë (porositë e vjetra pa dërgesë s'e kanë rreshtin).
  const showShipping = order.shippingFee > 0 || order.paymentMethod === "card";

  async function payByCard() {
    if (!order.clientRef || payBusy) return;
    setPayBusy(true);
    setPayFailed(false);
    const opened = await startCardPayment(order.id, order.clientRef, language === "en" ? "en" : "sq");
    setPayBusy(false);
    setPayFailed(!opened);
    // Pas mbylljes së faqes së pagesës rifreskohet lista: porosia duhet të dalë "paguar".
    if (opened) onPaymentOpened();
  }

  return (
    <View style={[shadows.soft, { borderLeftWidth: 4, borderLeftColor: tone.fg }]} className="bg-surface rounded-xl2 p-4 mb-3">
      <View className="flex-row items-center justify-between mb-1">
        <Text className="font-bodySemibold text-sm text-ink">#{order.id.slice(0, 8).toUpperCase()}</Text>
        <View className="flex-row items-center gap-1.5 rounded-full px-3 py-1" style={{ backgroundColor: tone.bg }}>
          <View className="h-2 w-2 rounded-full" style={{ backgroundColor: tone.fg }} />
          <Text className="font-bodySemibold text-[12px]" style={{ color: tone.fg }}>{t(orderStatusLabelKey(order.status))}</Text>
        </View>
      </View>
      <Text className="font-body text-xs text-ink-faint">{orderDate(order.createdAt, language)}</Text>

      <Timeline status={order.status} />
      <Text className="font-body text-xs text-ink-soft leading-5 mt-2.5">{t(orderHintKeyFor(order))}</Text>

      {payTone ? (
        <View className="flex-row items-center self-start gap-1.5 rounded-full px-3 py-1 mt-2.5" style={{ backgroundColor: payTone.bg }}>
          <View className="h-2 w-2 rounded-full" style={{ backgroundColor: payTone.fg }} />
          <Text className="font-bodySemibold text-[12px]" style={{ color: payTone.fg }}>{t(orderPaymentLabelKey(order))}</Text>
        </View>
      ) : null}

      <View className="mt-3 pt-3 border-t border-cream-line">
        {order.items.map((item) => (
          <View key={item.id} className="flex-row items-center mb-2.5">
            <View
              className={`w-11 h-11 rounded-xl items-center justify-center overflow-hidden mr-3 ${item.imageUrl ? "" : "bg-cream-soft"}`}
              style={item.imageUrl ? { backgroundColor: "#FFFFFF", padding: 3 } : undefined}
            >
              {item.imageUrl ? (
                <Image source={{ uri: item.imageUrl }} className="w-full h-full" resizeMode="contain" />
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

      {showShipping ? (
        <View className="flex-row items-center justify-between pb-2">
          <Text className="font-body text-xs text-ink-soft">{t("myorders_shipping")}</Text>
          <Text className="font-bodyMedium text-xs text-ink">
            {order.shippingFee > 0 ? `€${order.shippingFee.toFixed(2)}` : t("myorders_shipping_free")}
          </Text>
        </View>
      ) : null}

      <View className="flex-row items-center justify-between pt-2 border-t border-cream-line">
        <Text className="flex-1 mr-3 font-body text-xs text-ink-soft">
          {itemCount} {itemCount === 1 ? t("myorders_items_one") : t("myorders_items_many")} · {t(orderPaymentLabelKey(order))}
        </Text>
        <Text className="font-bodySemibold text-base text-ink">€{order.total.toFixed(2)}</Text>
      </View>

      <Text className="font-body text-[11px] text-ink-faint mt-2" numberOfLines={1}>
        {order.address}, {order.city} · {order.phone}
      </Text>

      {/* Pagesa me kartë e pa përfunduar (faqja u mbyll para kohe): paguhet nga këtu, pa porosi të re. */}
      {canPayByCard(order) ? (
        <>
          <Pressable
            onPress={payByCard}
            disabled={payBusy}
            accessibilityRole="button"
            className={`mt-3 items-center rounded-full bg-olive py-2.5 ${payBusy ? "opacity-50" : ""}`}
          >
            {payBusy ? <ActivityIndicator className="text-on-accent" size="small" /> : (
              <Text className="font-bodySemibold text-xs text-on-accent">{t("myorders_pay_card")}</Text>
            )}
          </Pressable>
          {payFailed ? <Text className="font-body text-xs text-orange leading-5 mt-2">{t("myorders_pay_card_failed")}</Text> : null}
        </>
      ) : null}

      {/* Porosit përsëri: të njëjtat artikuj në shportë. Çmimi dhe stoku rikontrollohen te arkëtimi. */}
      {order.status !== "cancelled" && order.items.length > 0 ? (
        <Pressable
          onPress={() => {
            for (const i of order.items) addToCart({ id: i.id, name: i.name, price: i.price, imageUrl: i.imageUrl ?? null, icon: i.icon ?? "cube" }, i.qty);
            router.push("/shop/cart");
          }}
          accessibilityRole="button"
          className="mt-3 items-center rounded-full border border-cream-line py-2.5"
        >
          <Text className="font-bodySemibold text-xs text-ink">{t("myorders_reorder")}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export default function MyOrdersScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const [orders, setOrders] = useState<MyOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      // Porositë e llogarisë, plus ato të bëra si mysafir nga kjo pajisje
      // (të ruajtura lokalisht): mysafiri i sheh edhe pasi kthehet.
      const [mine, guest] = await Promise.all([fetchMyOrders(), fetchGuestOrders().catch(() => [])]);
      const seen = new Set(mine.map((o) => o.id));
      const merged = [...mine, ...guest.filter((o) => !seen.has(o.id))];
      merged.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      setOrders(merged);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("myorders_load_error"));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [t]);

  // Statusi ndryshohet nga admini (konfirmim, nisje) dhe nga Stripe (pagesa): lista rifreskohet vetë çdo 12 sekonda
  // sa është ekrani i hapur, që klienti të mos duhet ta tërheqë poshtë.
  useFocusEffect(
    useCallback(() => {
      void load();
      const id = setInterval(() => void load(), 12_000);
      return () => clearInterval(id);
    }, [load])
  );

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      <View className="flex-row items-center px-5 pt-2 mb-4">
        <BackButton fallback="/(main)/shop" className="mr-3" />
        <Text className="font-display text-2xl text-ink">{t("myorders_title")}</Text>
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
                <Text className="font-bodyMedium text-sm text-olive">{t("myorders_retry")}</Text>
              </Pressable>
            </View>
          ) : orders.length === 0 ? (
            <View className="items-center mt-16 px-6">
              <Icon name="cube" size={28} color="#A79D8A" />
              <Text className="font-bodySemibold text-sm text-ink mt-3 mb-1">{t("myorders_empty_title")}</Text>
              <Text className="font-body text-xs text-ink-soft text-center leading-5 mb-4">
                {t("myorders_empty_body")}
              </Text>
              <Pressable onPress={() => router.push("/shop")} className="bg-olive px-5 py-2.5 rounded-full">
                <Text className="font-bodySemibold text-xs text-on-accent">{t("cart_see_products")}</Text>
              </Pressable>
            </View>
          ) : (
            orders.map((order) => <OrderCard key={order.id} order={order} onPaymentOpened={() => void load()} />)
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
