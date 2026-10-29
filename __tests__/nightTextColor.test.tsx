/**
 * Ngjyra e shkrimeve natën, e zgjedhur te Cilësimet → Modaliteti i natës: ruhet, vlen për orën dhe butonat e
 * pamjes së natës, e kuqja mbetet parazgjedhja, dhe çdo ngjyrë lexohet mbi qiellin e natës.
 */
import { renderScreen, button } from "./helpers/screen";
import { act, type ReactTestInstance } from "react-test-renderer";
import { StyleSheet } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { NightMode } from "@/components/baby/NightMode";
import { NIGHT_COLORS, NIGHT_PALETTES, nightPalette } from "@/components/baby/NightClock";
import { NIGHT_SKY } from "@/components/baby/NightSky";
import { DEFAULT_NIGHT_PREFS, NIGHT_TEXT_COLORS, cleanPrefs, setNightTextColor } from "@/lib/baby/nightMode";
import NightModeSettings from "@/app/(main)/more/night-mode";
import { translations } from "@/lib/i18n/translations";

const sq = translations.sq;
const luminance = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: string, b: string) => {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
/** Ngjyrat e teksteve që shfaqen te ekrani. */
const textColors = (root: ReactTestInstance) =>
  root.findAll((n) => (n.type as unknown) === "Text").map((n) => StyleSheet.flatten(n.props.style)?.color).filter(Boolean);

afterEach(() => setNightTextColor("red"));

describe("ngjyra e shkrimeve natën", () => {
  it("e kuqja është parazgjedhja; vlerat e panjohura ose të vjetra bien te e kuqja", () => {
    expect(DEFAULT_NIGHT_PREFS.textColor).toBe("red");
    expect(cleanPrefs({}).textColor).toBe("red");
    expect(cleanPrefs({ textColor: "purple" as never }).textColor).toBe("red");
    expect(cleanPrefs({ textColor: "silver" }).textColor).toBe("silver");
    expect(nightPalette("red")).toBe(NIGHT_COLORS);
    expect(nightPalette(undefined)).toBe(NIGHT_COLORS);
  });

  it("çdo ngjyrë: sfondi i zi, drita e kuqe mbetet e kuqe, teksti lexohet mbi qiellin e natës", () => {
    for (const key of NIGHT_TEXT_COLORS) {
      const p = NIGHT_PALETTES[key];
      expect(p.bg).toBe("#000000");
      expect(p.glow).toBe(NIGHT_COLORS.glow);
      for (const sky of [NIGHT_SKY.top, NIGHT_SKY.mid]) {
        expect(contrast(p.text, sky)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(p.soft, p.button)).toBeGreaterThanOrEqual(2.5);
      }
    }
  });

  it("pamja e natës merr ngjyrën e zgjedhur: ora, teksti dhe butonat", async () => {
    setNightTextColor("silver");
    const r = await renderScreen(<NightMode />);
    const colors = textColors(r.root);
    expect(colors).toContain(NIGHT_PALETTES.silver.text);
    expect(colors).not.toContain(NIGHT_COLORS.text);
    // butonat punojnë si më parë
    await act(async () => {
      button(r.root, sq.night_btn_diaper).props.onPress();
    });
    expect(textColors(r.root)).toContain(NIGHT_PALETTES.silver.text);
  });

  it("Cilësimet: katër zgjedhje; prekja ruan ngjyrën dhe e shënon si të zgjedhur", async () => {
    const r = await renderScreen(<NightModeSettings />);
    const options = () => r.root.findAll((n) => n.props.accessibilityRole === "radio" && typeof n.props.onPress === "function" && [sq.night_color_red, sq.night_color_silver, sq.night_color_blue, sq.night_color_rose].includes(n.props.accessibilityLabel));
    expect(options().map((o) => o.props.accessibilityLabel)).toEqual([sq.night_color_red, sq.night_color_silver, sq.night_color_blue, sq.night_color_rose]);
    expect(options().find((o) => o.props.accessibilityLabel === sq.night_color_red)!.props.accessibilityState).toEqual({ selected: true });
    await act(async () => {
      options().find((o) => o.props.accessibilityLabel === sq.night_color_blue)!.props.onPress();
    });
    expect(options().find((o) => o.props.accessibilityLabel === sq.night_color_blue)!.props.accessibilityState).toEqual({ selected: true });
    expect(JSON.parse((await AsyncStorage.getItem("bebix_night_prefs_v1"))!).textColor).toBe("blue");
  });
});
