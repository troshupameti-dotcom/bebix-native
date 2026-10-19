import { NativeModules, Platform, TurboModuleRegistry } from "react-native";
import { requireOptionalNativeModule } from "expo-modules-core";

/**
 * A ka ky build modulin e widget-eve? Expo Go dhe build-et e vjetra s'e kanë. Kontrolli bëhet PARA `require`-it:
 * Metro e raporton si gabim fatal (ekrani i kuq, ose mbyllje e app-it në release) çdo modul që rrëzohet gjatë
 * ngarkimit, edhe kur `require` është brenda `try`.
 */
export function hasIosWidgets(): boolean {
  return Platform.OS === "ios" && requireOptionalNativeModule("ExpoWidgets") != null;
}

export function hasAndroidWidgets(): boolean {
  if (Platform.OS !== "android") return false;
  try {
    return (TurboModuleRegistry.get("AndroidWidget") ?? NativeModules.AndroidWidget) != null;
  } catch {
    return false;
  }
}
