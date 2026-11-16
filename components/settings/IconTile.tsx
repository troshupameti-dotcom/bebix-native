import { View } from "react-native";
import { useThemeColors } from "@/lib/theme/useThemeColors";
import type { LucideIcon } from "lucide-react-native";

/** Ngjyrat e ikonave të cilësimeve: të qeta dhe të thella, që lexohen si ikonë mbi një pllakë të zbehtë në të dyja temat. */
export const TILE_COLORS = {
  red: "#C2453D",
  orange: "#B8641A",
  pink: "#B0476A",
  purple: "#7D5BA6",
  indigo: "#4F5BA8",
  blue: "#2F6FA8",
  teal: "#2A7F86",
  green: "#3E7D52",
  gray: "#6B655C",
} as const;

/**
 * Pllaka e ikonës: katror i rrumbullakosur me një frymë të ngjyrës dhe ikonën me ngjyrën e plotë. Më parë ishte
 * kopje e Cilësimeve të iPhone-it (mbushje e fortë ylber, ikonë e bardhë); kështu ngjyra mbetet shenjë, jo zhurmë.
 */
export function IconTile({ icon: Glyph, color, size = 30 }: { icon: LucideIcon; color: string; size?: number }) {
  const theme = useThemeColors();
  // Në temën e errët ikonat çelen, që të mos humbasin mbi sfondin e errët.
  const dark = theme.cream.toLowerCase() !== "#ffffff";
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.3, backgroundColor: `${color}${dark ? "38" : "1F"}`, alignItems: "center", justifyContent: "center" }}>
      <Glyph size={size * 0.56} color={dark ? theme.ink : color} strokeWidth={2.1} />
    </View>
  );
}
