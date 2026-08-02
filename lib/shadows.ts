import { Platform, ViewStyle } from "react-native";

/**
 * React Native has no `box-shadow` — iOS uses shadowColor/Offset/Opacity/Radius,
 * Android uses `elevation`. These mirror the "soft" / "softLg" / "press"
 * tokens from the web version's tailwind.config.ts.
 */
export const shadows: Record<"soft" | "softLg" | "press", ViewStyle> = {
  soft: Platform.select({
    ios: {
      shadowColor: "#2C271F",
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.12,
      shadowRadius: 16,
    },
    android: { elevation: 4 },
    default: {},
  }) as ViewStyle,
  softLg: Platform.select({
    ios: {
      shadowColor: "#2C271F",
      shadowOffset: { width: 0, height: 16 },
      shadowOpacity: 0.16,
      shadowRadius: 28,
    },
    android: { elevation: 8 },
    default: {},
  }) as ViewStyle,
  press: Platform.select({
    ios: {
      shadowColor: "#2C271F",
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.1,
      shadowRadius: 6,
    },
    android: { elevation: 2 },
    default: {},
  }) as ViewStyle,
};
