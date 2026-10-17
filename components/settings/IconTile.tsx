import { View } from "react-native";
import type { LucideIcon } from "lucide-react-native";

/** Ngjyrat e pllakave të ikonave: paleta e sistemit të Apple-it, e njohur dhe e lexueshme në të dyja temat. */
export const TILE_COLORS = {
  red: "#FF3B30",
  orange: "#FF9500",
  pink: "#FF2D55",
  purple: "#AF52DE",
  indigo: "#5856D6",
  blue: "#007AFF",
  teal: "#30B0C7",
  green: "#34C759",
  gray: "#8E8E93",
} as const;

/** Pllaka e ikonës: katror i rrumbullakosur me ngjyrë, ikonë e bardhë (si te Cilësimet e iPhone-it). */
export function IconTile({ icon: Glyph, color, size = 30 }: { icon: LucideIcon; color: string; size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.26, backgroundColor: color, alignItems: "center", justifyContent: "center" }}>
      <Glyph size={size * 0.58} color="#FFFFFF" strokeWidth={2.2} />
    </View>
  );
}
