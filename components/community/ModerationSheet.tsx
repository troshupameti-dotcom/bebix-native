import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, Text, View } from "react-native";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Icon, type IconName } from "@/components/ui/Icon";
import { haptics } from "@/lib/haptics";
import { blockUser, reportComment, reportPost, type ReportReason } from "@/lib/communityData";

export type ModerationTarget =
  | { kind: "post"; id: string; authorId: string; authorName: string; isMine: boolean }
  | { kind: "comment"; id: string; authorId: string; authorName: string; isMine: boolean };

type Props = {
  target: ModerationTarget | null;
  onClose: () => void;
  /** Fshirja e postimit/komentit tënd (thirrësi di çfarë të fshijë). */
  onDelete?: () => Promise<void>;
  /** Pas bllokimit, thirrësi rifreskon listën (postimet e tij zhduken). */
  onBlocked?: () => void;
};

const REASONS: { value: ReportReason; label: string }[] = [
  { value: "spam", label: "Spam ose reklamë" },
  { value: "harassment", label: "Ngacmim ose gjuhë fyese" },
  { value: "inappropriate", label: "Përmbajtje e papërshtatshme" },
  { value: "misinformation", label: "Informacion i rremë shëndetësor" },
  { value: "other", label: "Diçka tjetër" },
];

/**
 * Menuja "⋯" e postimeve dhe komenteve: fshi (tëndin), ose raporto / blloko
 * (të tjerëve). Raportimi dhe bllokimi kërkohen nga App Store për çdo app ku
 * përdoruesit publikojnë përmbajtje (guideline 1.2).
 */
export function ModerationSheet(props: Props) {
  if (!props.target) return null;
  // key: çdo objektiv i ri nis nga hapi i parë, pa efekt që rivendos gjendjen.
  return <SheetBody key={`${props.target.kind}:${props.target.id}`} {...props} target={props.target} />;
}

function SheetBody({ target, onClose, onDelete, onBlocked }: Props & { target: ModerationTarget }) {
  const [step, setStep] = useState<"actions" | "reasons">("actions");
  const [busy, setBusy] = useState(false);
  const noun = target.kind === "post" ? "postimin" : "komentin";

  async function run(action: () => Promise<void>, done: () => void) {
    setBusy(true);
    try {
      await action();
      done();
    } catch (e) {
      Alert.alert("Gabim", e instanceof Error ? e.message : "Diçka shkoi keq. Provo përsëri.");
    } finally {
      setBusy(false);
    }
  }

  function confirmDelete() {
    Alert.alert(`Fshi ${noun}?`, "Nuk mund të kthehet.", [
      { text: "Anulo", style: "cancel" },
      {
        text: "Fshi",
        style: "destructive",
        onPress: () =>
          run(
            async () => {
              await onDelete?.();
            },
            () => {
              haptics.success();
              onClose();
            }
          ),
      },
    ]);
  }

  function confirmBlock() {
    const name = target.authorName;
    Alert.alert(
      `Blloko ${name}?`,
      "Nuk do t'i shohësh më postimet dhe komentet e këtij përdoruesi. Mund ta zhbllokosh më vonë.",
      [
        { text: "Anulo", style: "cancel" },
        {
          text: "Blloko",
          style: "destructive",
          onPress: () =>
            run(
              () => blockUser(target.authorId),
              () => {
                haptics.success();
                onClose();
                onBlocked?.();
              }
            ),
        },
      ]
    );
  }

  function sendReport(reason: ReportReason) {
    const t = target;
    run(
      () => (t.kind === "post" ? reportPost(t.id, reason) : reportComment(t.id, reason)),
      () => {
        haptics.success();
        onClose();
        Alert.alert("Faleminderit", "Raportimi u dërgua. Ekipi ynë do ta shqyrtojë.");
      }
    );
  }

  return (
    <BottomSheet visible={!!target} onClose={onClose}>
      {busy ? (
        <View className="items-center py-8">
          <ActivityIndicator className="text-olive" />
        </View>
      ) : step === "actions" ? (
        <View className="pb-2">
          {target.isMine ? (
            <Row icon="close" label={`Fshi ${noun}`} destructive onPress={confirmDelete} />
          ) : (
            <>
              <Row icon="shield" label={`Raporto ${noun}`} onPress={() => setStep("reasons")} />
              <Row icon="eyeOff" label={`Blloko ${target.authorName}`} destructive onPress={confirmBlock} />
            </>
          )}
          <Row icon="chevronLeft" label="Anulo" onPress={onClose} />
        </View>
      ) : (
        <View className="pb-2">
          <Text className="mb-1 font-bodySemibold text-base text-ink">Pse po e raporton?</Text>
          <Text className="mb-3 font-body text-xs text-ink-soft">Raportimi është anonim për autorin.</Text>
          {REASONS.map((r) => (
            <Row key={r.value} icon="chevronRight" label={r.label} onPress={() => sendReport(r.value)} />
          ))}
        </View>
      )}
    </BottomSheet>
  );
}

function Row({
  icon,
  label,
  onPress,
  destructive = false,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  destructive?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      className="flex-row items-center border-b border-cream-line py-3.5 active:opacity-70"
    >
      <Icon name={icon} size={18} color={destructive ? "#DC2626" : "#2C271F"} />
      <Text className={`ml-3 font-bodyMedium text-sm ${destructive ? "text-red-600" : "text-ink"}`}>{label}</Text>
    </Pressable>
  );
}
