import { useState } from "react";
import { Image, ScrollView, Text, View } from "react-native";
import { useToast } from "@/lib/toast/ToastContext";
import { AdminScreen, Btn, Card, Empty, ErrorNote, Loading, TextSheet, runAction, useAdminData } from "@/components/admin/AdminUI";
import { fetchProductRequests, reviewProduct } from "@/lib/admin/api";
import { dateTime, eur } from "@/lib/admin/labels";

/** Produktet që shtuan partnerët: pas aprovimit shfaqen menjëherë në dyqan; refuzimi i tregon partnerit arsyen. */
export default function AdminRequests() {
  const { showToast } = useToast();
  const { data, error, refreshing, reload, pull } = useAdminData(fetchProductRequests, []);
  const [busy, setBusy] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);

  async function approve(id: string) {
    setBusy(id);
    await runAction(() => reviewProduct(id, true, null), () => {
      showToast("Produkti u aprovua dhe tani shitet.");
      reload();
    });
    setBusy(null);
  }

  return (
    <AdminScreen title="Produkte për aprovim" subtitle="Produktet që shtuan partnerët." refreshing={refreshing} onRefresh={pull}>
      <ErrorNote message={error} />
      {!data && !error ? <Loading /> : null}
      {data && data.length === 0 ? <Empty title="S'ka produkte që presin aprovimin." /> : null}
      {data?.map((p) => (
        <Card key={p.id}>
          {p.images.length ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} className="mb-3">
              {p.images.map((u) => (
                <Image key={u} source={{ uri: u }} className="h-28 w-28 rounded-xl border border-cream-line" style={{ backgroundColor: "#FFFFFF" }} resizeMode="contain" />
              ))}
            </ScrollView>
          ) : null}
          <Text className="font-bodySemibold text-[15px] text-ink">{p.name}</Text>
          <Text className="mt-0.5 font-body text-xs text-ink-soft">nga {p.partner ?? "—"} · {dateTime(p.createdAt)}</Text>
          <View className="mt-3 gap-1">
            <Line label="Çmimi" value={`${eur(p.price)}${p.compareAt ? `  (ishte ${eur(p.compareAt)})` : ""}`} />
            <Line label="Stoku" value={`${p.stock ?? "—"} · SKU ${p.sku ?? "—"}`} />
            <Line label="Kategoria" value={`${p.category ?? "—"} · Marka ${p.brand ?? "—"}${p.freeDelivery ? " · Dërgesë falas" : ""}`} />
          </View>
          {p.description ? <Text className="mt-3 font-body text-[13px] leading-5 text-ink-soft">{p.description.slice(0, 600)}</Text> : null}
          <View className="mt-4 flex-row gap-2">
            <View className="flex-1"><Btn label="Aprovo" busy={busy === p.id} onPress={() => void approve(p.id)} /></View>
            <View className="flex-1"><Btn label="Refuzo" kind="light" disabled={busy === p.id} onPress={() => setRejecting(p.id)} /></View>
          </View>
        </Card>
      ))}

      <TextSheet
        visible={!!rejecting}
        title="Arsyeja e refuzimit"
        placeholder="Partneri e sheh këtë arsye (të paktën 3 shkronja)"
        confirmLabel="Refuzo"
        minLength={3}
        danger
        onClose={() => setRejecting(null)}
        onConfirm={async (reason) => {
          const id = rejecting;
          if (!id) return;
          await runAction(() => reviewProduct(id, false, reason), () => {
            setRejecting(null);
            showToast("Produkti u refuzua.");
            reload();
          });
        }}
      />
    </AdminScreen>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <Text className="font-body text-[13px] text-ink">
      <Text className="font-bodyMedium text-ink-soft">{label}: </Text>
      {value}
    </Text>
  );
}
