import { Platform } from "react-native";
import * as Haptics from "expo-haptics";

/**
 * Thin wrapper around expo-haptics. Centralised so every screen calls
 * `haptics.tap()` / `haptics.success()` instead of importing the raw
 * module — makes it trivial to add a "disable haptics" setting later,
 * and no-ops safely on web where the native module isn't available.
 */
export const haptics = {
  tap: () => {
    if (Platform.OS === "web") return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  },
  select: () => {
    if (Platform.OS === "web") return;
    Haptics.selectionAsync();
  },
  success: () => {
    if (Platform.OS === "web") return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  },
  warning: () => {
    if (Platform.OS === "web") return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  },
  destructive: () => {
    if (Platform.OS === "web") return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  },
};
