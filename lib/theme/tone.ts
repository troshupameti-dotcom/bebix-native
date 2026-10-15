import { useMemo } from "react";
import palette from "@/theme/palette";
import { useThemeColors } from "@/lib/theme/useThemeColors";

/**
 * Kartat me ngjyrë (ushqimi rozë, pelena blu, rritja portokalli...) në të dyja temat.
 *
 * Më parë sfondi pastel dhe teksti i errët ishin fikse: në temën e errët dilnin si njolla të çelëta mbi sfondin e
 * errët. Tani, në temën e errët, sfondi bëhet një frymë e ngjyrës mbi kartelën e errët, ngjyra e theksit zbardhet
 * sa të lexohet, dhe teksti merr ngjyrat e temës. Në temën e çelët sfondet mbeten si ishin.
 */
export type Tone = { tint: string; tintBg: string };

/** E njëjta familje ngjyrash si kartat e rritjes, që ekranet të duken një sistem (vlerat e temës së çelët). */
export const TONES = {
  pink: { tint: "#B8336A", tintBg: "#F6DCE7" },
  blue: { tint: "#2E6FA8", tintBg: "#D9E7F2" },
  green: { tint: "#4E7A2E", tintBg: "#E1EBD5" },
  amber: { tint: "#9A6415", tintBg: "#F3E4C8" },
  purple: { tint: "#7A3596", tintBg: "#E7DAEF" },
  orange: { tint: "#B23A1C", tintBg: "#F3DCCF" },
} satisfies Record<string, Tone>;
export type ThemedTone = Tone & {
  /** Teksti kryesor mbi sfondin e kartës. */
  ink: string;
  /** Teksti dytësor mbi sfondin e kartës. */
  inkSoft: string;
  /** Sfondi i butonave/çipave brenda kartës (i bardhë në dritë). */
  chip: string;
};

const LIGHT_INK = "#17212B";
const LIGHT_INK_SOFT = "#3B4652";

function rgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h.slice(0, 6);
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as [number, number, number];
}

/** Përzien dy ngjyra: `amount` = sa nga `b` (0 = vetëm a, 1 = vetëm b). */
export function mix(a: string, b: string, amount: number): string {
  const [r1, g1, b1] = rgb(a);
  const [r2, g2, b2] = rgb(b);
  const c = (x: number, y: number) => Math.round(x + (y - x) * amount).toString(16).padStart(2, "0");
  return `#${c(r1, r2)}${c(g1, g2)}${c(b1, b2)}`.toUpperCase();
}

/** Ndriçimi relativ (WCAG), për kontrollin e kontrastit. */
export function luminance(hex: string): number {
  const ch = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const [r, g, b] = rgb(hex).map(ch);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string): number {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

export function themedTone(tone: Tone, dark: boolean): ThemedTone {
  // Në dritë: sfondi si ishte; theksi pak më i errët (14%), që teksti i vogël me ngjyrë të kalojë 4.5:1 (WCAG AA)
  // mbi sfondin pastel. Më parë rozë, blu, jeshile dhe qelibar ishin 4.0–4.4:1.
  if (!dark) return { tint: mix(tone.tint, "#000000", 0.14), tintBg: tone.tintBg, ink: LIGHT_INK, inkSoft: LIGHT_INK_SOFT, chip: "#FFFFFF" };
  const d = palette.dark;
  return {
    // Theksi zbardhet sa të lexohet mbi sfondin e errët të kartës.
    tint: mix(tone.tint, "#FFFFFF", 0.38),
    // Një frymë e ngjyrës mbi kartelën e errët.
    tintBg: mix(d.surface, tone.tint, 0.2),
    ink: d.ink,
    inkSoft: d.inkSoft,
    chip: d.surfaceAlt,
  };
}

/** Toni i dhënë, sipas temës aktuale. */
export function useTone(tone: Tone): ThemedTone {
  const { isDark } = useThemeColors();
  return useMemo(() => themedTone(tone, isDark), [tone, isDark]);
}

/** Përkthyesi i toneve për një komponent që përdor disa (p.sh. lista me lloje të ndryshme). */
export function useToneTheme(): (tone: Tone) => ThemedTone {
  const { isDark } = useThemeColors();
  return useMemo(() => (tone: Tone) => themedTone(tone, isDark), [isDark]);
}

export type ThemedTones = Record<keyof typeof TONES, ThemedTone> & { ink: string; inkSoft: string };

/** Të gjitha tonet sipas temës, bashkë me tekstin kryesor/dytësor mbi kartat me ngjyrë. */
export function useTones(): ThemedTones {
  const { isDark } = useThemeColors();
  return useMemo(() => {
    const entries = (Object.keys(TONES) as (keyof typeof TONES)[]).map((k) => [k, themedTone(TONES[k], isDark)] as const);
    const base = themedTone(TONES.pink, isDark);
    return { ...(Object.fromEntries(entries) as Record<keyof typeof TONES, ThemedTone>), ink: base.ink, inkSoft: base.inkSoft };
  }, [isDark]);
}
