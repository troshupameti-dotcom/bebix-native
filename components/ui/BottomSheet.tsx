import { Modal, Pressable, View, ScrollView } from "react-native";
import { MotiView } from "moti";
import { ReactNode } from "react";

type BottomSheetProps = {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  maxHeightPct?: number;
};

/**
 * Reusable slide-up sheet — used for "add item" pickers, custom-entry
 * forms, and quick actions across the Baby module. One implementation,
 * shared everywhere, so the feel stays consistent.
 */
export function BottomSheet({ visible, onClose, children, maxHeightPct = 80 }: BottomSheetProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View className="flex-1 justify-end">
        <Pressable className="absolute inset-0 bg-black/40" onPress={onClose} />
        <MotiView
          from={{ translateY: 420 }}
          animate={{ translateY: visible ? 0 : 420 }}
          transition={{ type: "timing", duration: 320 }}
          className="rounded-t-3xl bg-cream px-5 pt-3"
          style={{ paddingBottom: 34, maxHeight: `${maxHeightPct}%` }}
        >
          <View className="mb-3 h-1 w-10 self-center rounded-full bg-ink/15" />
          <ScrollView showsVerticalScrollIndicator={false}>{children}</ScrollView>
        </MotiView>
      </View>
    </Modal>
  );
}
