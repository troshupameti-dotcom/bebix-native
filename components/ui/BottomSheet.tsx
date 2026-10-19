import { Modal, Pressable, View, ScrollView, useWindowDimensions } from "react-native";
import { MotiView } from "moti";
import { ReactNode } from "react";
import { useKeyboardInset } from "@/lib/ui/keyboard";

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
 * Kur hapet tastiera, dritarja ngjitet mbi të dhe zvogëlohet sa duhet, që fusha ku shkruan të shihet gjithmonë.
 */
export function BottomSheet({ visible, onClose, children, maxHeightPct = 80 }: BottomSheetProps) {
  const { ref, inset: keyboard, onLayout } = useKeyboardInset();
  const { height: windowHeight } = useWindowDimensions();
  const maxHeight = Math.max(200, (windowHeight * maxHeightPct) / 100 - keyboard);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View ref={ref} onLayout={onLayout} className="flex-1 justify-end" style={{ paddingBottom: keyboard }}>
        <Pressable className="absolute inset-0 bg-black/40" onPress={onClose} />
        <MotiView
          from={{ translateY: 420 }}
          animate={{ translateY: visible ? 0 : 420 }}
          transition={{ type: "timing", duration: 320 }}
          className="rounded-t-3xl bg-cream px-5 pt-3"
          style={{ paddingBottom: keyboard ? 16 : 34, maxHeight }}
        >
          <View className="mb-3 h-1 w-10 self-center rounded-full bg-ink/15" />
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
        </MotiView>
      </View>
    </Modal>
  );
}
