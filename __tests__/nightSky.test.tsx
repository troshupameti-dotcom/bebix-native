/**
 * Qielli i natës (Hëna dhe yjet) pas pamjes së natës: vetëm dekor, pas gjithçkaje, pa prekje, pa animacion,
 * i errët, dhe pa prekur asgjë nga funksionet e pamjes së natës.
 */
import { renderScreen, visibleText, button } from "./helpers/screen";
import { act, type ReactTestInstance } from "react-test-renderer";
import { NightMode } from "@/components/baby/NightMode";
import { NIGHT_COLORS } from "@/components/baby/NightClock";
import { NIGHT_SKY, makeStars, moonFrame } from "@/components/baby/NightSky";
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
const sky = (root: ReactTestInstance) => root.findAll((n) => n.props.testID === "night-sky" && typeof n.type === "string")[0];

describe("qielli i natës", () => {
  it("shumë i errët: asnjë ngjyrë qielli s'është më e ndritshme se blu e mesnatës; poshtë e zezë si shiriti i skedave", () => {
    for (const c of [NIGHT_SKY.top, NIGHT_SKY.mid, NIGHT_SKY.low]) expect(luminance(c)).toBeLessThan(0.012);
    expect(NIGHT_SKY.bottom).toBe(NIGHT_COLORS.bg);
  });

  it("tekstet e kuqe lexohen njësoj si më parë mbi pjesën e mesme të qiellit", () => {
    const before = contrast(NIGHT_COLORS.text, NIGHT_COLORS.bg);
    expect(contrast(NIGHT_COLORS.text, NIGHT_SKY.mid)).toBeGreaterThan(before * 0.9);
    expect(contrast(NIGHT_COLORS.soft, NIGHT_SKY.mid)).toBeGreaterThan(contrast(NIGHT_COLORS.soft, NIGHT_COLORS.bg) * 0.9);
  });

  it("yjet: gjithmonë të njëjtët, brenda ekranit, asnjë mbi Hënë, më të paktë poshtë te butonat", () => {
    const m = moonFrame(390, 47);
    const moon = { cx: m.x + m.size / 2, cy: m.y + m.size / 2, r: m.size / 2 };
    const a = makeStars(390, 844, moon);
    expect(makeStars(390, 844, moon)).toEqual(a);
    expect(a.length).toBeGreaterThanOrEqual(90);
    for (const s of a) {
      expect(s.x).toBeGreaterThanOrEqual(0);
      expect(s.x).toBeLessThanOrEqual(390);
      expect(Math.hypot(s.x - moon.cx, s.y - moon.cy)).toBeGreaterThan(moon.r * 1.7);
    }
    // drita e yjeve (sa shumë dhe sa të ndritshëm) poshtë, te butonat, më pak se gjysma e asaj lart
    const light = (pick: (y: number) => boolean) => a.filter((s) => pick(s.y)).reduce((sum, s) => sum + s.o * s.r, 0);
    expect(light((y) => y > (844 * 2) / 3)).toBeLessThan(light((y) => y < 844 / 3) / 2);
  });

  it("Hëna djathtas lart, nën butonin “Mbyll”, edhe në telefonat e vegjël dhe në tablet", () => {
    for (const [w, top, h] of [[320, 20, 568], [375, 20, 667], [390, 47, 844], [430, 59, 932], [820, 24, 1180]]) {
      const m = moonFrame(w, top, h);
      expect(m.y).toBeGreaterThanOrEqual(top + 56);
      expect(m.x + m.size).toBeLessThanOrEqual(w - 20);
      expect(m.size).toBeGreaterThanOrEqual(72);
      expect(m.size).toBeLessThanOrEqual(120);
    }
  });
});

describe("pamja e natës me qiellin", () => {
  it("qielli është i pari (pas gjithçkaje), s'merr prekje dhe fshihet nga lexuesi i ekranit", async () => {
    const r = await renderScreen(<NightMode />);
    const s = sky(r.root);
    expect(s).toBeDefined();
    expect(s.props.pointerEvents).toBe("none");
    expect(s.props.importantForAccessibility).toBe("no-hide-descendants");
    expect(s.props.accessibilityElementsHidden).toBe(true);
    // fëmija i parë i ekranit pas StatusBar-it: gjithçka tjetër vizatohet sipër tij
    const parent = s.parent!;
    const kids = parent.children.filter((c): c is ReactTestInstance => typeof c !== "string");
    expect(kids.indexOf(s)).toBeLessThanOrEqual(1);
  });

  it("butonat punojnë si më parë: Pelenë ruhet, Gjumë ndërron, Mbyll mbetet", async () => {
    const r = await renderScreen(<NightMode />);
    const text = visibleText(r.root);
    for (const label of [sq.night_btn_feed, sq.night_btn_diaper, sq.night_btn_sleep, sq.night_exit]) expect(text).toContain(label);
    await act(async () => {
      button(r.root, sq.night_btn_diaper).props.onPress();
    });
    expect(visibleText(r.root)).toContain(`U ruajt: ${sq.night_btn_diaper}`);
    await act(async () => {
      button(r.root, sq.night_btn_sleep).props.onPress();
    });
    expect(visibleText(r.root)).toContain(sq.night_btn_wake);
    expect(sky(r.root)).toBeDefined();
  });
});
