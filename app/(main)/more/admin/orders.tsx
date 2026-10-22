import { useCallback, useState } from "react";
import { Image, Linking, Pressable, Text, View } from "react-native";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { MapPin, Phone } from "lucide-react-native";
import {
  AdminScreen, Btn, Card, Chips, Empty, ErrorNote, Loading, OptionSheet, Pill, SearchField, confirm, runAction, useAdminData, useDebounced,
} from "@/components/admin/AdminUI";
import { useThemeColors } from "@/lib/theme/useThemeColors";
import { PhotoViewer } from "@/components/ui/PhotoViewer";
import { ORDERS_PAGE, fetchOrderItemMeta, fetchOrders, setOrderStatus, setPaymentStatus, type AdminOrder } from "@/lib/admin/api";
import {
  ORDER_STATUS, PAYMENT_METHOD_LABEL, PAYMENT_STATUS, PERIODS, dateTime, dayLabel, eur, optionOf, sameDay, shortOrder, type PeriodKey,
} from "@/lib/admin/labels";

const STATUS_TABS = [{ key: "", label: "Çdo status" }, ...ORDER_STATUS.map((s) => ({ key: s.key, label: s.label }))];

/**
 * Porositë: sipas ditës (parazgjedhja "Sot"), statusit dhe kërkimit. Ndryshimi i statusit e njofton klientin në app
 * dhe me email, si nga paneli i webit. Lista rifreskohet vetë çdo 20 sekonda kur ekrani është i hapur.
 */
export default function AdminOrders() {
  const theme = useThemeColors();
  const params = useLocalSearchParams<{ status?: string }>();
  const initialStatus = STATUS_TABS.some((t) => t.key === params.status) ? (params.status ?? "") : "";
  const [status, setStatus] = useState(initialStatus);
  // Statusi i ardhur nga pasqyra (p.sh. "Në pritje") shikon të gjitha ditët, që porositë e vjetra të mos fshihen.
  const [period, setPeriod] = useState<PeriodKey>(initialStatus ? "all" : "today");
  const [query, setQuery] = useState("");
  const q = useDebounced(query);
  const [limit, setLimit] = useState(ORDERS_PAGE);
  const [picker, setPicker] = useState<{ order: AdminOrder; kind: "status" | "payment" } | null>(null);
  // Fotoja e produktit e zmadhuar (prekja mbi foton e vogël).
  const [photo, setPhoto] = useState<{ uri: string; caption: string } | null>(null);

  const { data, error, refreshing, reload, pull } = useAdminData(async () => {
    const res = await fetchOrders({ status, q, period, limit });
    const meta = await fetchOrderItemMeta([...new Set(res.orders.flatMap((o) => o.items.map((i) => i.id)))]);
    return { ...res, meta };
  }, [status, q, period, limit]);

  // Rifreskim i heshtur çdo 20 sekonda, vetëm kur ekrani shihet.
  useFocusEffect(
    useCallback(() => {
      const id = setInterval(() => void reload(), 20_000);
      return () => clearInterval(id);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [status, q, period, limit])
  );

  function pick(next: string) {
    if (!picker) return;
    const { order, kind } = picker;
    const save = () => void runAction(() => (kind === "status" ? setOrderStatus(order.id, next) : setPaymentStatus(order.id, next)), reload);
    // Porosia e mbyllur: rihapja ndryshon stokun dhe i dërgon klientit email të ri.
    if (kind === "status" && (order.status === "delivered" || order.status === "cancelled")) {
      confirm("Porosi e mbyllur", "Kjo porosi është e mbyllur. Të ndryshohet statusi? Klienti do të marrë email të ri.", "Ndrysho", save, false);
      return;
    }
    save();
  }

  const orders = data?.orders ?? [];
  const periodLabel = PERIODS.find((p) => p.key === period)?.label ?? "";

  return (
    <AdminScreen title="Porositë" subtitle="Ndrysho statusin: klienti e sheh në app dhe merr email." refreshing={refreshing} onRefresh={pull}>
      <Chips items={PERIODS} value={period} onChange={(k) => { setPeriod(k); setLimit(ORDERS_PAGE); }} />
      <Chips items={STATUS_TABS} value={status} onChange={(k) => { setStatus(k); setLimit(ORDERS_PAGE); }} />
      <SearchField value={query} onChangeText={(v) => { setQuery(v); setLimit(ORDERS_PAGE); }} placeholder="Kërko klientin, telefonin, qytetin ose adresën" />
      <ErrorNote message={error} />

      {data?.summary ? (
        <View className="mb-3">
          <Text className="mb-2 px-1 font-bodySemibold text-[13px] text-ink-soft">{periodLabel}</Text>
          <View className="flex-row gap-2">
            <Stat label="Porosi" value={String(data.summary.live)} />
            <Stat label="Të ardhura" value={eur(data.summary.revenue)} />
            <Stat label="Me kartë" value={String(data.summary.paidByCard)} />
            <Stat label="Anuluar" value={String(data.summary.cancelled)} />
          </View>
        </View>
      ) : null}

      {!data && !error ? <Loading /> : null}
      {data && orders.length === 0 ? (
        <Empty title="Asnjë porosi." body={period !== "all" ? `Nuk ka porosi për ${periodLabel.toLowerCase()}${status || q ? " me këtë filtër" : ""}.` : "Provo një filtër tjetër."} />
      ) : null}

      {orders.map((o, i) => (
        <View key={o.id}>
          {i === 0 || !sameDay(o.createdAt, orders[i - 1].createdAt) ? (
            <Text className="mb-2 mt-2 px-1 font-bodySemibold text-[12px] uppercase tracking-wide text-ink-faint">{dayLabel(o.createdAt)}</Text>
          ) : null}
          <OrderCard
            order={o}
            meta={data?.meta}
            muted={theme.inkFaint}
            onStatus={() => setPicker({ order: o, kind: "status" })}
            onPayment={() => setPicker({ order: o, kind: "payment" })}
            onPhoto={(uri, caption) => setPhoto({ uri, caption })}
          />
        </View>
      ))}

      {data && orders.length < data.total ? (
        <View className="mt-1 items-center">
          <Btn label={`Ngarko më shumë (${data.total - orders.length})`} kind="light" onPress={() => setLimit((n) => n + ORDERS_PAGE)} />
        </View>
      ) : null}

      <OptionSheet
        visible={!!picker}
        title={picker?.kind === "payment" ? "Statusi i pagesës" : "Statusi i porosisë"}
        options={picker?.kind === "payment" ? PAYMENT_STATUS : ORDER_STATUS}
        value={picker ? (picker.kind === "payment" ? picker.order.paymentStatus : picker.order.status) : null}
        onPick={pick}
        onClose={() => setPicker(null)}
      />
      {photo ? <PhotoViewer uri={photo.uri} caption={photo.caption} onClose={() => setPhoto(null)} /> : null}
    </AdminScreen>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-1 rounded-2xl border border-cream-line bg-surface px-2.5 py-2.5">
      <Text className="font-body text-[11px] text-ink-faint" numberOfLines={1}>{label}</Text>
      <Text className="mt-0.5 font-bodySemibold text-[15px] text-ink" numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
    </View>
  );
}

function OrderCard({
  order: o,
  meta,
  muted,
  onStatus,
  onPayment,
  onPhoto,
}: {
  order: AdminOrder;
  meta?: Map<string, { img: string | null; code: string }>;
  muted: string;
  onStatus: () => void;
  onPayment: () => void;
  onPhoto: (uri: string, caption: string) => void;
}) {
  const status = optionOf(ORDER_STATUS, o.status);
  const payment = optionOf(PAYMENT_STATUS, o.paymentStatus);
  const units = o.items.reduce((n, i) => n + i.qty, 0);
  // Llogaria e fshirë i heq adresën: pa këtë dilte një presje e vetme.
  const place = [o.address, o.city].filter((v) => v && v.trim()).join(", ");
  return (
    <Card>
      <View className="flex-row items-start justify-between">
        <View>
          <Text className="font-bodySemibold text-[15px] text-ink">{shortOrder(o.id)}</Text>
          <Text className="mt-0.5 font-body text-xs text-ink-faint">{dateTime(o.createdAt)} · {units} copë</Text>
        </View>
        <View className="items-end">
          <Text className="font-display text-lg text-ink">{eur(o.total)}</Text>
          {o.shippingFee > 0 ? <Text className="font-body text-[11px] text-ink-faint">me dërgesë {eur(o.shippingFee)}{o.country ? ` · ${o.country}` : ""}</Text> : null}
        </View>
      </View>

      <View className="mt-3 gap-1.5">
        <Text className="font-bodyMedium text-sm text-ink">{o.fullName || "—"}</Text>
        {o.phone ? (
          <Pressable onPress={() => void Linking.openURL(`tel:${o.phone}`).catch(() => {})} accessibilityRole="link" className="flex-row items-center gap-1.5 self-start">
            <Phone size={13} color={muted} strokeWidth={2} />
            <Text className="font-bodyMedium text-[13px] text-olive">{o.phone}</Text>
          </Pressable>
        ) : null}
        <View className="flex-row items-start gap-1.5">
          <MapPin size={13} color={muted} strokeWidth={2} style={{ marginTop: 2 }} />
          <Text className="flex-1 font-body text-[13px] text-ink-soft">{place || "—"}</Text>
        </View>
      </View>

      <View className="mt-3 gap-2.5 border-t border-cream-line pt-3">
        {o.items.map((item) => {
          const m = meta?.get(item.id);
          const img = item.imageUrl ?? m?.img ?? null;
          return (
            <View key={item.id} className="flex-row items-center">
              {img ? (
                <Pressable onPress={() => onPhoto(img, `${item.name} × ${item.qty}`)} accessibilityRole="imagebutton" accessibilityLabel={`Zmadho foton: ${item.name}`} className="mr-3">
                  <Image source={{ uri: img }} className="h-14 w-14 rounded-lg border border-cream-line" style={{ backgroundColor: "#FFFFFF" }} resizeMode="contain" />
                </Pressable>
              ) : (
                <View className="mr-3 h-14 w-14 rounded-lg bg-cream-soft" />
              )}
              <View className="flex-1">
                <Text className="font-bodyMedium text-[13px] text-ink" numberOfLines={2}>{item.name} × {item.qty}</Text>
                <Text className="mt-0.5 font-body text-[11px] text-ink-faint">Kodi: {m?.code ?? item.id.slice(0, 8).toUpperCase()} · {eur(item.price * item.qty)}</Text>
              </View>
            </View>
          );
        })}
      </View>

      <View className="mt-3 flex-row flex-wrap items-center gap-2 border-t border-cream-line pt-3">
        <Pill label={status.label} tone={status.tone} onPress={onStatus} />
        <Text className="ml-1 font-body text-xs text-ink-faint">{PAYMENT_METHOD_LABEL[o.paymentMethod] ?? o.paymentMethod}</Text>
        <Pill label={payment.label} tone={payment.tone} onPress={onPayment} />
      </View>
    </Card>
  );
}
