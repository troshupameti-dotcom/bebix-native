import { useColorScheme } from "nativewind";
import palette from "@/theme/palette";

export type ThemeToken = keyof typeof palette.light;
export type ThemeColors = Record<ThemeToken, string> & { isDark: boolean };

/**
 * Ngjyrat e temës aktuale si hex, për vendet ku React Native s'pranon
 * className: `placeholderTextColor`, `<ActivityIndicator color>`,
 * `trackColor`, tab bar-i, StatusBar. Ri-renderon kur ndryshon tema.
 */
export function useThemeColors(): ThemeColors {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  return { ...(isDark ? palette.dark : palette.light), isDark } as ThemeColors;
}

/**
 * Ngjyrat hex të vjetra të shkruara direkt në kod -> tokeni që përfaqësojnë.
 * Lejon që `<Icon color="#2C271F" />` të ndërrojë vetë me temën, pa i prekur
 * 150+ vende thirrjeje. Ngjyrat që s'janë këtu (logot e Google-it, e kuqja
 * e gabimeve) mbeten siç janë.
 */
const LEGACY_HEX_TO_TOKEN: Record<string, ThemeToken> = {
  "#FBF6EE": "cream",
  "#F3ECDD": "creamSoft",
  "#E9DFCC": "creamLine",
  "#E4DFD3": "creamLine",
  "#F6F1E7": "surfaceAlt",
  "#211D17": "surface",
  "#2C271F": "ink",
  // Ishte teksti i dark mode-it në `isDark ? "#F7F1E4" : "#2C271F"`.
  "#F7F1E4": "ink",
  "#6B6154": "inkSoft",
  "#5F564A": "inkSoft",
  "#A79D8A": "inkFaint",
  "#9C927E": "inkFaint",
  "#B5A78F": "inkFaint",
  "#7A7062": "inkFaint",
  "#6E7452": "olive",
  "#636A45": "olive",
  "#8A9160": "olive",
  "#E7EAD9": "oliveBg",
  "#C9702E": "orange",
  "#A5531A": "orange",
  "#F5E1CC": "orangeBg",
  "#FAEEE2": "orangeBg",
  // Ikonat e bardha qëndrojnë gjithmonë mbi theks (olive/orange/ink), pra
  // në dark duhet të errësohen bashkë me atë theks.
  "#FFFFFF": "onAccent",
  "#FFF": "onAccent",
};

/** Kthen ngjyrën e përshtatur për temën; ngjyrat e panjohura s'preken. */
export function resolveThemeColor(color: string, colors: ThemeColors): string {
  const token = LEGACY_HEX_TO_TOKEN[color.toUpperCase()];
  return token ? colors[token] : color;
}
