import { Keyboard, Modal, Platform, Pressable, View, ScrollView, useWindowDimensions } from "react-native";
import { MotiView } from "moti";
import { ReactNode, useEffect, useState } from "react";

type BottomSheetProps = {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  maxHeightPct?: number;
};

/**
 * Lartësia e tastierës së hapur (0 kur është mbyllur). Dritarja e Modal-it me `statusBarTranslucent` nuk ngjitet vetë
 * kur hapet tastiera (Android me ekran të plotë, edhe iPhone), ndaj forma mbetej poshtë tastierës dhe s'dukej.
 */
function useKeyboardHeight(): number {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const show = Keyboard.addListener(showEvent, (e) => setHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener(hideEvent, () => setHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return height;
}

/**
 * Reusable slide-up sheet — used for "add item" pickers, custom-entry
 * forms, and quick actions across the Baby module. One implementation,
 * shared everywhere, so the feel stays consistent.
 * Kur hapet tastiera, dritarja ngjitet mbi të dhe zvogëlohet sa duhet, që fusha ku shkruan të shihet gjithmonë.
 */
export function BottomSheet({ visible, onClose, children, maxHeightPct = 80 }: BottomSheetProps) {
  const keyboard = useKeyboardHeight();
  const { height: windowHeight } = useWindowDimensions();
  const maxHeight = Math.max(200, (windowHeight * maxHeightPct) / 100 - keyboard);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View className="flex-1 justify-end" style={{ paddingBottom: keyboard }}>
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
