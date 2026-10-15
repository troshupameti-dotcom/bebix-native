import { View, Text } from "react-native";
import { useThemeColors } from "@/lib/theme/useThemeColors";

/**
 * Çmimi, me të njëjtat ngjyra kudo:
 *  - normal: ngjyra e tekstit të temës (më parë #17212B fiks, që në temën e errët s'shihej)
 *  - në ofertë: #D94A4A (e kuqe e kontrolluar)
 *  - i vjetri: #8A929A (gri) me vijë në mes
 * Monedha (€) ka ngjyrën e çmimit, por është pak më e vogël.
 */
export const PRICE_COLORS = { normal: "#17212B", sale: "#D94A4A", old: "#8A929A" } as const;

const SIZES = {
  sm: { amount: 14, euro: 11, old: 12 },
  md: { amount: 16, euro: 13, old: 13 },
  lg: { amount: 30, euro: 22, old: 16 },
} as const;

export function Price({
  price,
  compareAt,
  size = "md",
  display = false,
}: {
  price: number;
  compareAt?: number | null;
  size?: keyof typeof SIZES;
  /** Fonti i madh i titujve (faqja e produktit). */
  display?: boolean;
}) {
  const theme = useThemeColors();
  const s = SIZES[size];
  const onSale = compareAt != null && compareAt > price;
  const color = onSale ? PRICE_COLORS.sale : theme.isDark ? theme.ink : PRICE_COLORS.normal;
  const family = display ? "font-display" : "font-bodySemibold";

  return (
    <View className="flex-row items-baseline flex-wrap">
      <Text className={`${family} mr-2`} style={{ color, fontSize: s.amount }}>
        <Text style={{ color, fontSize: s.euro }}>€</Text>
        {price.toFixed(2)}
      </Text>
      {onSale ? (
        <Text className="font-body" style={{ color: PRICE_COLORS.old, fontSize: s.old, textDecorationLine: "line-through" }}>
          <Text style={{ fontSize: s.old - 2 }}>€</Text>
          {compareAt!.toFixed(2)}
        </Text>
      ) : null}
    </View>
  );
}
