import { itemsFor, whatsNewDecision, WHATS_NEW_ITEMS, WHATS_NEW_VERSION } from "@/lib/whatsNew";
import { translations } from "@/lib/i18n/translations";

describe("çfarë ka të re", () => {
  it("del një herë për përdoruesin e vjetër; i riu s'e sheh, por shënohet si i parë", () => {
    expect(whatsNewDecision(null, true)).toBe("show");
    expect(whatsNewDecision("2025-old", true)).toBe("show");
    expect(whatsNewDecision(WHATS_NEW_VERSION, true)).toBe("none");
    expect(whatsNewDecision(null, false)).toBe("mark-seen");
  });

  it("shortcuts vetëm në Android", () => {
    expect(itemsFor("android").some((i) => i.key === "shortcuts")).toBe(true);
    expect(itemsFor("ios").some((i) => i.key === "shortcuts")).toBe(false);
  });

  it("çdo rresht ka tekst në shqip dhe anglisht", () => {
    for (const item of WHATS_NEW_ITEMS) {
      for (const key of [item.titleKey, item.bodyKey]) {
        expect(translations.sq[key]).toBeTruthy();
        expect(translations.en[key]).toBeTruthy();
      }
    }
  });
});
