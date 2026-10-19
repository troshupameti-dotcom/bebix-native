import { useEffect, useState } from "react";
import { Keyboard, Platform } from "react-native";

/**
 * Lartësia e tastierës së hapur (0 kur është mbyllur). Android-i me ekran të plotë (edge-to-edge) dhe dritaret Modal
 * nuk ngjiten vetë kur hapet tastiera; ekranet me fusha shkrimi poshtë (dritaret nga poshtë, biseda) i shtojnë këtë
 * hapësirë poshtë, që fusha ku shkruan të shihet gjithmonë.
 */
export function useKeyboardHeight(): number {
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
