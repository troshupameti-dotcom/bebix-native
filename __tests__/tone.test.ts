/**
 * Kartat me ngjyrë në të dyja temat: teksti dhe theksi lexohen (WCAG ≥ 4.5:1), dhe në temën e errët sfondi i
 * kartës është i errët (jo njollë pastel e çelët, si më parë).
 */
import { contrast, luminance, mix, themedTone, TONES } from "@/lib/theme/tone";

describe("tonet e kartave", () => {
  it("përzierja e ngjyrave", () => {
    expect(mix("#000000", "#FFFFFF", 0.5)).toBe("#808080");
    expect(mix("#123456", "#FFFFFF", 0)).toBe("#123456");
  });

  it.each(Object.entries(TONES))("%s: teksti dhe theksi lexohen në të dyja temat", (_name, tone) => {
    for (const dark of [false, true]) {
      const t = themedTone(tone, dark);
      expect({ dark, ink: contrast(t.ink, t.tintBg) >= 7 }).toEqual({ dark, ink: true });
      expect({ dark, tint: contrast(t.tint, t.tintBg) >= 4.5 }).toEqual({ dark, tint: true });
    }
  });

  it.each(Object.entries(TONES))("%s: në temën e errët sfondi i kartës është i errët", (_name, tone) => {
    expect(luminance(themedTone(tone, true).tintBg)).toBeLessThan(0.05);
    expect(themedTone(tone, false).tintBg).toBe(tone.tintBg); // në dritë sfondi s'ndryshon
  });
});
