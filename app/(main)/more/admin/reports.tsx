import { useState } from "react";
import { Text, View } from "react-native";
import { useToast } from "@/lib/toast/ToastContext";
import { AdminScreen, Btn, Card, Chips, Empty, ErrorNote, Loading, Pill, confirm, runAction, useAdminData } from "@/components/admin/AdminUI";
import { fetchReports, markReports, removeReported, type ReportGroup, type ReportTab } from "@/lib/admin/api";
import { REPORT_REASON, REPORT_STATUS, TONES, dateOnly } from "@/lib/admin/labels";

const TABS: { key: ReportTab; label: string }[] = [
  { key: "open", label: "Të hapura" },
  { key: "all", label: "Të gjitha" },
  { key: "reviewed", label: "Të shqyrtuara" },
  { key: "dismissed", label: "Të shpërfillura" },
];

/** Postimet dhe komentet që raportuan prindërit: disa raportime për të njëjtin postim janë një rast. */
export default function AdminReports() {
  const { showToast } = useToast();
  const [tab, setTab] = useState<ReportTab>("open");
  const { data, error, refreshing, reload, pull } = useAdminData(() => fetchReports(tab), [tab]);

  function remove(g: ReportGroup) {
    const noun = g.kind === "post" ? "postimin" : "komentin";
    confirm(`Fshi ${noun}`, `Të fshihet ${noun} përgjithmonë? Raportimet e tij hiqen bashkë me të.`, "Fshi", () =>
      void runAction(() => removeReported(g.kind, g.targetId), () => {
        showToast("U fshi.");
        reload();
      })
    );
  }

  function mark(g: ReportGroup, status: "dismissed" | "reviewed") {
    void runAction(() => markReports(g.kind, g.targetId, status), () => {
      showToast("U ruajt.");
      reload();
    });
  }

  return (
    <AdminScreen title="Raportimet" subtitle="Postime dhe komente të raportuara në Komunitet." refreshing={refreshing} onRefresh={pull}>
      <Chips items={TABS} value={tab} onChange={setTab} />
      <ErrorNote message={error} />
      {!data && !error ? <Loading /> : null}
      {data && data.length === 0 ? <Empty title="S'ka raportime me këtë filtër." /> : null}
      {data?.map((g) => {
        const noun = g.kind === "post" ? "Postim" : "Koment";
        return (
          <Card key={`${g.kind}:${g.targetId}`}>
            {g.target ? (
              <>
                <View className="flex-row flex-wrap items-center gap-2">
                  <Pill label={`${g.count} raportime`} tone={TONES.orange} />
                  <Pill label={REPORT_STATUS[g.status] ?? g.status} />
                </View>
                <Text className="mt-2 font-body text-xs text-ink-soft">
                  {noun} nga <Text className="font-bodySemibold">{g.target.author_name ?? "—"}</Text> · {dateOnly(g.target.created_at)}
                </Text>
                <View className="mt-3 rounded-xl bg-cream-soft p-3.5">
                  <Text className="font-body text-sm leading-5 text-ink">{g.target.text || "(pa tekst)"}</Text>
                </View>
                <Text className="mt-3 font-body text-xs text-ink-soft">
                  <Text className="font-bodySemibold">Arsyet: </Text>
                  {g.reasons.map((r) => REPORT_REASON[r] ?? r).join(", ")}
                </Text>
                {g.notes.length ? (
                  <Text className="mt-1 font-body text-xs text-ink-soft">
                    <Text className="font-bodySemibold">Shënime: </Text>
                    {g.notes.join(" · ")}
                  </Text>
                ) : null}
              </>
            ) : (
              <Text className="font-body text-sm text-ink-soft">{noun}i i raportuar është fshirë tashmë.</Text>
            )}
            <View className="mt-4 flex-row flex-wrap gap-2">
              {g.target ? <Btn small kind="danger" label={`Fshi ${g.kind === "post" ? "postimin" : "komentin"}`} onPress={() => remove(g)} /> : null}
              <Btn small kind="light" label="Në rregull, shpërfille" onPress={() => mark(g, "dismissed")} />
              {g.target && g.status === "open" ? <Btn small kind="light" label="Shënoje të shqyrtuar" onPress={() => mark(g, "reviewed")} /> : null}
            </View>
          </Card>
        );
      })}
    </AdminScreen>
  );
}
