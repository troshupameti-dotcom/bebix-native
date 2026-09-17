import { Switch, SwitchProps } from "react-native";
import { useThemeColors } from "@/lib/theme/useThemeColors";

type Props = Omit<SwitchProps, "trackColor" | "thumbColor" | "ios_backgroundColor">;

/**
 * Switch me ngjyrat e temës. RN s'e pranon className për trackColor, prandaj
 * ngjyrat vijnë nga paleta — i njëjti pamje në të gjitha ekranet.
 */
export function ThemedSwitch(props: Props) {
  const theme = useThemeColors();
  return (
    <Switch
      {...props}
      trackColor={{ true: theme.olive, false: theme.creamLine }}
      thumbColor="#FFFFFF"
      ios_backgroundColor={theme.creamLine}
    />
  );
}
