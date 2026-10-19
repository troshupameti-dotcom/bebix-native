import { useState } from "react";
import { Image, Linking, Pressable, Text, View } from "react-native";
import { useToast } from "@/lib/toast/ToastContext";
import {
  AdminScreen, Btn, Card, Chips, Empty, ErrorNote, Loading, OptionSheet, Pill, SectionTitle, TextSheet, confirm, runAction, useAdminData,
} from "@/components/admin/AdminUI";
import { approveExpert, fetchExperts, rejectExpert, removeExpert, setExpertDepartment, type Department, type ExpertApplication } from "@/lib/admin/api";
import { REVIEW_STATUS, dateOnly, optionOf, type Option } from "@/lib/admin/labels";

const TABS = [{ key: "", label: "Të gjithë" }, ...REVIEW_STATUS.map((s) => ({ key: s.key, label: s.label }))];

/** Aplikimet e mjekëve për t'u verifikuar në Komunitet, dhe repartet ku shfaqen ekspertët. */
export default function AdminExperts() {
  const { showToast } = useToast();
  const [status, setStatus] = useState("pending");
  const { data, error, refreshing, reload, pull } = useAdminData(() => fetchExperts(status), [status]);
  // Aprovimi: reparti i propozuar nga aplikanti, që admini e konfirmon ose e ndryshon.
  const [approving, setApproving] = useState<ExpertApplication | null>(null);
  const [rejecting, setRejecting] = useState<ExpertApplication | null>(null);
  const [moving, setMoving] = useState<{ id: string; current: string | null } | null>(null);

  const departments = data?.departments ?? [];
  const deptOptions: Option[] = departments.map((d) => ({ key: d.key, label: `${d.emoji} ${d.label}`.trim() }));
  const deptLabel = (key: string | null) => departments.find((d) => d.key === key)?.label ?? null;

  function startApprove(app: ExpertApplication) {
    // Pa reparte (para migrimit): aprovim i drejtpërdrejtë, si në web.
    if (!departments.length) {
      confirm("Aprovo ekspertin", `Aprovo ${app.fullName} si ekspert i verifikuar?`, "Aprovo", () => void doApprove(app, null), false);
      return;
    }
    setApproving(app);
  }

  async function doApprove(app: ExpertApplication, dept: string | null) {
    await runAction(() => approveExpert(app, dept), () => {
      showToast("Eksperti u aprovua.");
      reload();
    });
  }

  return (
    <AdminScreen title="Ekspertët" subtitle="Verifikimi i mjekëve dhe specialistëve." refreshing={refreshing} onRefresh={pull}>
      <Chips items={TABS} value={status} onChange={setStatus} />
      <ErrorNote message={error} />
      {!data && !error ? <Loading /> : null}
      {data && data.applications.length === 0 ? <Empty title="S'ka aplikime me këtë filtër." /> : null}

      {data?.applications.map((a) => {
        const st = optionOf(REVIEW_STATUS, a.status);
        return (
          <Card key={a.id}>
            <View className="flex-row items-start justify-between gap-3">
              <View className="flex-1">
                <Text className="font-bodySemibold text-[15px] text-ink">{a.fullName}</Text>
                <Text className="mt-0.5 font-body text-[13px] text-ink-soft">{deptLabel(a.specialtyKey) ?? a.specialization} · {a.experienceYears} vjet përvojë</Text>
              </View>
              <Pill label={st.label} tone={st.tone} />
            </View>
            <Text className="mt-2 font-body text-xs text-ink-soft">Licenca: {a.licenseNumber ?? "—"} · Aplikoi më {dateOnly(a.createdAt)}</Text>
            {a.phone ? (
              <Pressable onPress={() => void Linking.openURL(`tel:${a.phone}`).catch(() => {})} accessibilityRole="link" className="mt-1 self-start">
                <Text className="font-bodyMedium text-xs text-olive">{a.phone}</Text>
              </Pressable>
            ) : null}
            {a.licenseUrl ? (
              <Pressable onPress={() => void Linking.openURL(a.licenseUrl as string).catch(() => {})} accessibilityRole="imagebutton" accessibilityLabel={`Licenca e ${a.fullName}, hap të madhe`} className="mt-3">
                <Text className="mb-1 font-bodySemibold text-[11px] uppercase tracking-wide text-ink-faint">Foto e licencës (prek për ta zmadhuar)</Text>
                <Image source={{ uri: a.licenseUrl }} className="h-40 w-full rounded-xl border border-cream-line" style={{ backgroundColor: "#FFFFFF" }} resizeMode="contain" />
              </Pressable>
            ) : (
              <Text className="mt-3 font-body text-xs text-ink-faint">Pa foto licence.</Text>
            )}
            {a.bio ? <Text className="mt-3 font-body text-[13px] leading-5 text-ink-soft">{a.bio}</Text> : null}
            {a.adminNote ? <Text className="mt-2 font-body text-xs text-ink-faint">Shënim: {a.adminNote}</Text> : null}
            {a.status === "pending" ? (
              <View className="mt-4 flex-row gap-2">
                <View className="flex-1"><Btn label="Aprovo" onPress={() => startApprove(a)} /></View>
                <View className="flex-1"><Btn label="Refuzo" kind="light" onPress={() => setRejecting(a)} /></View>
              </View>
            ) : null}
          </Card>
        );
      })}

      {data ? (
        <>
          <SectionTitle>Ekspertët e verifikuar ({data.experts.length})</SectionTitle>
          {data.experts.length === 0 ? <Empty title="Ende s'ka ekspertë të verifikuar." /> : null}
          {data.experts.length ? (
            <View className="overflow-hidden rounded-2xl border border-cream-line bg-surface">
              {data.experts.map((e, i) => (
                <View key={e.id} className={`px-4 py-3 ${i < data.experts.length - 1 ? "border-b border-cream-line" : ""}`}>
                  <Text className="font-bodyMedium text-sm text-ink">{e.name}</Text>
                  <Text className="mt-0.5 font-body text-xs text-ink-soft">
                    {deptLabel(e.specialtyKey) ?? e.kind}
                    {e.hasAccount ? "" : " · pa llogari (ekspert shembull)"}
                  </Text>
                  <View className="mt-2 flex-row gap-2">
                    {departments.length ? <Btn small kind="light" label="Ndrysho repartin" onPress={() => setMoving({ id: e.id, current: e.specialtyKey })} /> : null}
                    <Btn
                      small
                      kind="light"
                      label="Hiq"
                      onPress={() =>
                        confirm("Hiq ekspertin", `Hiq ${e.name} nga ekspertët e verifikuar? Ky veprim nuk kthehet.`, "Hiq", () =>
                          void runAction(() => removeExpert(e.id), () => {
                            showToast("Eksperti u hoq.");
                            reload();
                          })
                        )
                      }
                    />
                  </View>
                </View>
              ))}
            </View>
          ) : null}
        </>
      ) : null}

      <OptionSheet
        visible={!!approving}
        title={approving ? `Reparti i ${approving.fullName}` : ""}
        options={deptOptions}
        value={approving?.specialtyKey ?? null}
        // Reparti i propozuar nga aplikanti del i shënuar; edhe ai konfirmohet me një prekje.
        pickSelected
        onClose={() => setApproving(null)}
        onPick={(key) => approving && void doApprove(approving, key)}
      />

      <OptionSheet
        visible={!!moving}
        title="Reparti i ekspertit"
        options={deptOptions}
        value={moving?.current ?? null}
        onClose={() => setMoving(null)}
        onPick={(key) => {
          const dept = departments.find((d) => d.key === key) as Department | undefined;
          const target = moving;
          if (!dept || !target) return;
          void runAction(() => setExpertDepartment(target.id, dept), () => {
            showToast("Reparti u ruajt.");
            reload();
          });
        }}
      />

      <TextSheet
        visible={!!rejecting}
        title={rejecting ? `Refuzo ${rejecting.fullName}` : ""}
        placeholder="Arsyeja e refuzimit (opsionale)"
        confirmLabel="Refuzo"
        danger
        onClose={() => setRejecting(null)}
        onConfirm={async (note) => {
          const app = rejecting;
          if (!app) return;
          await runAction(() => rejectExpert(app.id, note), () => {
            setRejecting(null);
            showToast("Aplikimi u refuzua.");
            reload();
          });
        }}
      />
    </AdminScreen>
  );
}
