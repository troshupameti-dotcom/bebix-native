import { View, Text, Pressable, Share } from "react-native";
import { ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { haptics } from "@/lib/haptics";
import { formatDate, formatTime } from "@/lib/dateUtils";

type LifecycleInfo = { createdAt: string; updatedAt: string; editCount: number };

type RecordSheetProps = {
  visible: boolean;
  onClose: () => void;
  title: string;
  /** The record-specific editable fields — each screen supplies its own. */
  children: ReactNode;
  onDuplicate?: () => void;
  onArchive?: () => void;
  onDelete: () => void;
  onTogglePin?: () => void;
  pinned?: boolean;
  shareText?: string;
  isNew?: boolean; // hides Duplicate/Archive/Delete/history while creating a brand-new record
  lifecycle?: LifecycleInfo;
};

/**
 * The one sheet every tappable record in the Baby module opens into:
 * fields are always editable inline (no separate "view" vs "edit" mode
 * — feels faster, and closing the sheet any way — X, backdrop, back
 * gesture — autosaves for existing records; see each screen's
 * `closeSheet`). Duplicate / Archive / Share / Delete / Pin are a
 * consistent footer row, and "Created / Edited Nx / Last modified" is
 * shown for every existing record — this is what "Edit History" means
 * in practice, without a separate screen per record.
 */
export function RecordSheet({
  visible,
  onClose,
  title,
  children,
  onDuplicate,
  onArchive,
  onDelete,
  onTogglePin,
  pinned,
  shareText,
  isNew,
  lifecycle,
}: RecordSheetProps) {
  const { t, lang } = useTranslation();

  function handleDelete() {
    haptics.warning();
    onDelete();
    onClose();
  }
  function handleArchive() {
    haptics.tap();
    onArchive?.();
    onClose();
  }
  function handleDuplicate() {
    haptics.tap();
    onDuplicate?.();
    onClose();
  }
  async function handleShare() {
    if (!shareText) return;
    haptics.tap();
    try {
      await Share.share({ message: shareText });
    } catch {
      // User cancelled — nothing to do.
    }
  }

  return (
    <BottomSheet visible={visible} onClose={onClose} maxHeightPct={90}>
      <View className="mb-1 flex-row items-center justify-between">
        <Text className="font-bodySemibold text-lg text-ink">{title}</Text>
        <View className="flex-row items-center gap-2">
          {onTogglePin && !isNew && (
            <Pressable onPress={() => { haptics.select(); onTogglePin(); }} hitSlop={8} className="h-8 w-8 items-center justify-center rounded-full bg-cream-soft">
              <Icon name="heart" size={14} color={pinned ? "#C9702E" : "#A79D8A"} />
            </Pressable>
          )}
          <Pressable onPress={onClose} hitSlop={8} className="h-8 w-8 items-center justify-center rounded-full bg-cream-soft">
            <Icon name="close" size={14} color="#2C271F" />
          </Pressable>
        </View>
      </View>

      {lifecycle && !isNew && (
        <Text className="mb-4 font-body text-[11px] text-ink-faint">
          {lifecycle.editCount === 0 ? t("created_label") : `${t("edited_label")} ${lifecycle.editCount}×`}
          {" · "}
          {t("last_modified_label")} {formatDate(lifecycle.updatedAt, lang)} {formatTime(lifecycle.updatedAt, lang)}
        </Text>
      )}

      {children}

      {!isNew && (
        <View className="mt-5 flex-row flex-wrap gap-2 border-t border-ink/8 pt-4">
          {onDuplicate && (
            <Pressable onPress={handleDuplicate} className="flex-1 flex-row items-center justify-center gap-1.5 rounded-xl bg-cream-soft py-3">
              <Icon name="repeat" size={15} color="#2C271F" />
              <Text className="font-bodyMedium text-[12.5px] text-ink">{t("duplicate_action")}</Text>
            </Pressable>
          )}
          {onArchive && (
            <Pressable onPress={handleArchive} className="flex-1 flex-row items-center justify-center gap-1.5 rounded-xl bg-cream-soft py-3">
              <Icon name="download" size={15} color="#2C271F" />
              <Text className="font-bodyMedium text-[12.5px] text-ink">{t("archive_action")}</Text>
            </Pressable>
          )}
          {shareText && (
            <Pressable onPress={handleShare} className="flex-1 flex-row items-center justify-center gap-1.5 rounded-xl bg-cream-soft py-3">
              <Icon name="share" size={15} color="#2C271F" />
              <Text className="font-bodyMedium text-[12.5px] text-ink">{t("share_action")}</Text>
            </Pressable>
          )}
          <Pressable onPress={handleDelete} className="flex-1 flex-row items-center justify-center gap-1.5 rounded-xl bg-red-50 py-3">
            <Icon name="close" size={14} color="#DC2626" />
            <Text className="font-bodyMedium text-[12.5px] text-red-600">{t("delete_action")}</Text>
          </Pressable>
        </View>
      )}
    </BottomSheet>
  );
}
