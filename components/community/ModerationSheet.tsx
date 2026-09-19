import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, Text, View } from "react-native";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Icon, type IconName } from "@/components/ui/Icon";
import { haptics } from "@/lib/haptics";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import type { TranslationKey } from "@/lib/i18n/translations";
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

const REASONS: { value: ReportReason; labelKey: TranslationKey }[] = [
  { value: "spam", labelKey: "mod_reason_spam" },
  { value: "harassment", labelKey: "mod_reason_harassment" },
  { value: "inappropriate", labelKey: "mod_reason_inappropriate" },
  { value: "misinformation", labelKey: "mod_reason_misinformation" },
  { value: "other", labelKey: "mod_reason_other" },
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
  const { t } = useTranslation();
  const [step, setStep] = useState<"actions" | "reasons">("actions");
  const [busy, setBusy] = useState(false);
  const isPost = target?.kind === "post";

  async function run(action: () => Promise<void>, done: () => void) {
    setBusy(true);
    try {
      await action();
      done();
    } catch (e) {
      Alert.alert(t("mod_error_title"), e instanceof Error ? e.message : t("mod_error_body"));
    } finally {
      setBusy(false);
    }
  }

  function confirmDelete() {
    Alert.alert(isPost ? t("mod_delete_post_q") : t("mod_delete_comment_q"), t("mod_cannot_undo"), [
      { text: t("cancel_action"), style: "cancel" },
      {
        text: t("mod_delete"),
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
      t("mod_block_q", { name }),
      t("mod_block_body"),
      [
        { text: t("cancel_action"), style: "cancel" },
        {
          text: t("mod_block"),
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
    const item = target;
    run(
      () => (item.kind === "post" ? reportPost(item.id, reason) : reportComment(item.id, reason)),
      () => {
        haptics.success();
        onClose();
        Alert.alert(t("mod_thanks"), t("mod_report_sent"));
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
            <Row icon="close" label={isPost ? t("mod_delete_post") : t("mod_delete_comment")} destructive onPress={confirmDelete} />
          ) : (
            <>
              <Row icon="shield" label={isPost ? t("mod_report_post") : t("mod_report_comment")} onPress={() => setStep("reasons")} />
              <Row icon="eyeOff" label={t("mod_block_who", { name: target.authorName })} destructive onPress={confirmBlock} />
            </>
          )}
          <Row icon="chevronLeft" label={t("cancel_action")} onPress={onClose} />
        </View>
      ) : (
        <View className="pb-2">
          <Text className="mb-1 font-bodySemibold text-base text-ink">{t("mod_why_report")}</Text>
          <Text className="mb-3 font-body text-xs text-ink-soft">{t("mod_anonymous")}</Text>
          {REASONS.map((r) => (
            <Row key={r.value} icon="chevronRight" label={t(r.labelKey)} onPress={() => sendReport(r.value)} />
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
