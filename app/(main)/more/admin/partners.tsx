import { useState } from "react";
import { Linking, Pressable, Text, View } from "react-native";
import { useToast } from "@/lib/toast/ToastContext";
import { AdminScreen, Btn, Card, Chips, Empty, ErrorNote, Loading, Pill, confirm, runAction, useAdminData } from "@/components/admin/AdminUI";
import { fetchPartners, updatePartner, type Partner } from "@/lib/admin/api";
import { PARTNER_STATUS, TONES, dateOnly, optionOf } from "@/lib/admin/labels";

const TABS = [{ key: "", label: "Të gjithë" }, ...PARTNER_STATUS.map((s) => ({ key: s.key, label: s.label }))];

/** Aplikimet e partnerëve, aprovimi, pezullimi dhe publikimi i drejtpërdrejtë për partnerët e besuar. */
export default function AdminPartners() {
  const { showToast } = useToast();
  const [status, setStatus] = useState("");
  const { data, error, refreshing, reload, pull } = useAdminData(() => fetchPartners(status), [status]);
  const [busy, setBusy] = useState<string | null>(null);

  async function patch(p: Partner, values: { status?: string; can_publish_directly?: boolean }, ok: string) {
    setBusy(p.id);
    await runAction(() => updatePartner(p.id, values), () => {
      showToast(ok);
      reload();
    });
    setBusy(null);
  }

  return (
    <AdminScreen title="Partnerët" subtitle="Aplikimet dhe statusi i partnerëve." refreshing={refreshing} onRefresh={pull}>
      <Chips items={TABS} value={status} onChange={setStatus} />
      <ErrorNote message={error} />
      {!data && !error ? <Loading /> : null}
      {data && data.length === 0 ? <Empty title="Asnjë partner nuk përputhet." /> : null}
      {data?.map((p) => {
        const st = optionOf(PARTNER_STATUS, p.status);
        const isBusy = busy === p.id;
        return (
          <Card key={p.id}>
            <View className="flex-row items-start justify-between gap-3">
              <View className="flex-1">
                <Text className="font-bodySemibold text-[15px] text-ink">{p.company}</Text>
                <Text className="mt-0.5 font-body text-xs text-ink-soft">Aplikoi më {dateOnly(p.appliedAt)} · {p.productCount} produkte</Text>
              </View>
              <View className="items-end gap-1.5">
                <Pill label={st.label} tone={st.tone} />
                {p.direct ? <Pill label="Publikim direkt" tone={TONES.blue} /> : null}
              </View>
            </View>
            <View className="mt-3 gap-1">
              <Info label="Kontakti" value={p.contact} />
              <Info label="Email" value={p.email} link={p.email ? `mailto:${p.email}` : undefined} />
              <Info label="Telefoni" value={p.phone} link={p.phone ? `tel:${p.phone}` : undefined} />
              <Info label="Vendi" value={p.place || null} />
              <Info label="Kategoria" value={p.category} />
              <Info label="Faqja" value={p.website} />
            </View>
            {p.description ? <Text className="mt-3 font-body text-[13px] leading-5 text-ink-soft">{p.description}</Text> : null}
            <View className="mt-4 flex-row flex-wrap gap-2">
              {p.status !== "approved" ? <Btn small label="Aprovo" busy={isBusy} onPress={() => void patch(p, { status: "approved" }, "Partneri u aprovua.")} /> : null}
              {p.status === "pending" ? <Btn small kind="light" label="Refuzo" disabled={isBusy} onPress={() => void patch(p, { status: "rejected" }, "Aplikimi u refuzua.")} /> : null}
              {p.status === "approved" ? (
                <Btn
                  small
                  kind="light"
                  label="Pezullo"
                  disabled={isBusy}
                  onPress={() => confirm("Pezullo partnerin", `Pezullo ${p.company}?`, "Pezullo", () => void patch(p, { status: "suspended" }, "Partneri u pezullua."))}
                />
              ) : null}
              {p.status === "approved" ? (
                <Btn
                  small
                  kind="light"
                  label={p.direct ? "Hiq publikimin direkt" : "Lejo publikim direkt"}
                  disabled={isBusy}
                  onPress={() =>
                    void patch(p, { can_publish_directly: !p.direct }, p.direct ? "Produktet e reja tani kërkojnë aprovim." : "Produktet e reja tani publikohen direkt.")
                  }
                />
              ) : null}
            </View>
          </Card>
        );
      })}
    </AdminScreen>
  );
}

function Info({ label, value, link }: { label: string; value: string | null; link?: string }) {
  const text = (
    <Text className="font-body text-[13px] text-ink">
      <Text className="text-ink-faint">{label}: </Text>
      <Text className={link ? "text-olive" : ""}>{value || "—"}</Text>
    </Text>
  );
  if (!link) return text;
  return (
    <Pressable onPress={() => void Linking.openURL(link).catch(() => {})} accessibilityRole="link" className="self-start">
      {text}
    </Pressable>
  );
}
