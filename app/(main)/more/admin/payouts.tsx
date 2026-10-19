import { useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { ChevronDown } from "lucide-react-native";
import { FormField } from "@/components/baby/FormField";
import { DateTimeField } from "@/components/baby/DateTimeField";
import { useToast } from "@/lib/toast/ToastContext";
import { useThemeColors } from "@/lib/theme/useThemeColors";
import { AdminScreen, Btn, Card, Empty, ErrorNote, Loading, OptionSheet, Pill, SectionTitle, runAction, useAdminData } from "@/components/admin/AdminUI";
import { createPayout, fetchPayouts, setPayoutStatus, type Choice, type Payout } from "@/lib/admin/api";
import { PAYOUT_STATUS, dateOnly, eur, optionOf, ymd } from "@/lib/admin/labels";

/** Pagesat për partnerët: sa mbetet për t'u paguar, regjistrimi i një pagese të re dhe statusi i secilës. */
export default function AdminPayouts() {
  const { data, error, refreshing, reload, pull } = useAdminData(fetchPayouts, []);
  const { showToast } = useToast();
  const [editing, setEditing] = useState<Payout | null>(null);

  return (
    <AdminScreen
      title="Pagesat e partnerëve"
      subtitle={data ? `Mbetet për t'u paguar: ${eur(data.owed)}` : undefined}
      refreshing={refreshing}
      onRefresh={pull}
    >
      <ErrorNote message={error} />
      {!data && !error ? <Loading /> : null}
      {data && data.partners.length ? <PayoutForm partners={data.partners} onSaved={reload} /> : null}

      {data ? <SectionTitle>Pagesat</SectionTitle> : null}
      {data && data.payouts.length === 0 ? <Empty title="Ende s'ka pagesa." body="Regjistro pagesën e parë me formularin lart." /> : null}
      {data?.payouts.map((p) => {
        const st = optionOf(PAYOUT_STATUS, p.status);
        return (
          <Card key={p.id}>
            <View className="flex-row items-start justify-between gap-3">
              <View className="flex-1">
                <Text className="font-bodySemibold text-[15px] text-ink">{p.partner ?? "—"}</Text>
                <Text className="mt-0.5 font-body text-xs text-ink-soft">
                  {p.periodStart || p.periodEnd ? `${dateOnly(p.periodStart)} – ${dateOnly(p.periodEnd)}` : "Pa periudhë"}
                  {p.reference ? ` · ${p.reference}` : ""}
                </Text>
                <Text className="mt-0.5 font-body text-[11px] text-ink-faint">
                  Krijuar më {dateOnly(p.createdAt)}
                  {p.paidAt ? ` · Paguar më ${dateOnly(p.paidAt)}` : ""}
                </Text>
              </View>
              <Text className="font-display text-lg text-ink">{eur(p.amount)}</Text>
            </View>
            <View className="mt-3">
              <Pill label={st.label} tone={st.tone} onPress={() => setEditing(p)} />
            </View>
          </Card>
        );
      })}

      <OptionSheet
        visible={!!editing}
        title="Statusi i pagesës"
        options={PAYOUT_STATUS}
        value={editing?.status ?? null}
        onClose={() => setEditing(null)}
        onPick={(next) => {
          const target = editing;
          if (!target) return;
          void runAction(() => setPayoutStatus(target.id, next), () => {
            showToast("Statusi u ndryshua.");
            reload();
          });
        }}
      />
    </AdminScreen>
  );
}

/** Periudha e paracaktuar: muaji i kaluar (pagesat bëhen zakonisht për muajin e mbyllur). */
function lastMonth(): { start: string; end: string } {
  const now = new Date();
  return {
    start: new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString(),
    end: new Date(now.getFullYear(), now.getMonth(), 0).toISOString(),
  };
}

function PayoutForm({ partners, onSaved }: { partners: Choice[]; onSaved: () => void }) {
  const theme = useThemeColors();
  const { showToast } = useToast();
  const [partner, setPartner] = useState(partners[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [period, setPeriod] = useState(lastMonth);
  const [reference, setReference] = useState("");
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit() {
    const value = Number(amount.replace(",", "."));
    if (!partner || !Number.isFinite(value) || value <= 0) {
      Alert.alert("Kontrollo të dhënat", "Zgjidh partnerin dhe shkruaj një shumë mbi 0.");
      return;
    }
    setBusy(true);
    await runAction(
      () => createPayout({ partnerId: partner, amount: value, start: ymd(new Date(period.start)), end: ymd(new Date(period.end)), reference }),
      () => {
        showToast("Pagesa u regjistrua.");
        setAmount("");
        setReference("");
        onSaved();
      }
    );
    setBusy(false);
  }

  return (
    <Card className="gap-3">
      <Text className="font-bodySemibold text-[15px] text-ink">Regjistro një pagesë</Text>
      <View className="gap-1.5">
        <Text className="font-bodyMedium text-[12.5px] text-ink-soft">Partneri</Text>
        <Pressable onPress={() => setPicking(true)} accessibilityRole="button" className="flex-row items-center justify-between rounded-2xl border border-ink/10 bg-surface px-4 py-3.5">
          <Text className="font-body text-[15px] text-ink">{partners.find((p) => p.id === partner)?.label ?? "Zgjidh"}</Text>
          <ChevronDown size={16} color={theme.inkFaint} strokeWidth={2} />
        </Pressable>
      </View>
      <FormField label="Shuma (€)" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
      <View className="flex-row gap-3">
        <View className="flex-1"><DateTimeField label="Nga data" mode="date" value={period.start} onChange={(iso) => setPeriod((p) => ({ ...p, start: iso }))} /></View>
        <View className="flex-1"><DateTimeField label="Deri më" mode="date" value={period.end} onChange={(iso) => setPeriod((p) => ({ ...p, end: iso }))} /></View>
      </View>
      <FormField label="Referenca" value={reference} onChangeText={setReference} placeholder="Opsionale" />
      <Btn label="Regjistro pagesën" busy={busy} onPress={() => void submit()} />

      <OptionSheet
        visible={picking}
        title="Partneri"
        options={partners.map((p) => ({ key: p.id, label: p.label }))}
        value={partner}
        onPick={setPartner}
        onClose={() => setPicking(false)}
      />
    </Card>
  );
}
