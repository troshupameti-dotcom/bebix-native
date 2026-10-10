import {
  activeDismissals, chooseSuggestion, currentDiaperSize, diaperPrompt, pickAgeProduct, sizeUpHint, type AgeProduct,
} from "@/lib/shop/suggestions";

jest.mock("@react-native-async-storage/async-storage", () => ({ getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn() }));

const product = (id: string, over: Partial<AgeProduct> = {}): AgeProduct => ({ id, name: `Lodër ${id}`, minAgeMonths: 6, maxAgeMonths: 12, stock: 5, rating: 4, ...over });

describe("madhësia e pelenave", () => {
  it("nga cilësimet e bebit, pastaj nga emri i produktit të blerë", () => {
    expect(currentDiaperSize("3", null)?.size).toBe(3);
    expect(currentDiaperSize("Nr. 4", "Pampers 2")?.size).toBe(4);
    expect(currentDiaperSize("", "Pampers Premium Care Nr. 3")?.size).toBe(3);
    expect(currentDiaperSize(null, "Pelena Libero Size 5")?.size).toBe(5);
    expect(currentDiaperSize(null, "Huggies (9-14 kg) 52 copë")?.size).toBe(4);
    expect(currentDiaperSize(null, "Pelena për bebe")).toBeNull();
  });

  it("pesha afër kufirit → madhësia tjetër; mbi kufi = 'tani'", () => {
    const three = currentDiaperSize("3", null);
    expect(sizeUpHint(three, 8.4)).toBeNull();
    expect(sizeUpHint(three, 9.6)).toMatchObject({ next: { size: 4, minKg: 9, maxKg: 14 }, urgent: false });
    expect(sizeUpHint(three, 10.2)?.urgent).toBe(true);
    expect(sizeUpHint(currentDiaperSize("7", null), 30)).toBeNull(); // s'ka madhësi më të madhe
    expect(sizeUpHint(three, null)).toBeNull();
    expect(sizeUpHint(null, 10)).toBeNull();
  });
});

describe("pelenat po mbarojnë", () => {
  it("pyet kur mbeten ≤ 3 ditë ose pak copë", () => {
    expect(diaperPrompt({ left: 12, perDay: 6, daysLeft: 2, low: true })).toEqual({ daysLeft: 2, left: 12 });
    expect(diaperPrompt({ left: 30, perDay: 6, daysLeft: 5, low: false })).toBeNull();
    expect(diaperPrompt({ left: 4, perDay: null, daysLeft: null, low: true })).toEqual({ daysLeft: 0, left: 4 });
    expect(diaperPrompt(null)).toBeNull();
  });
});

describe("sipas moshës", () => {
  it("vetëm produktet me kufi moshe që i përshtaten; para ato që sapo i përshtaten", () => {
    const list = [
      product("old", { minAgeMonths: 0, maxAgeMonths: 12, rating: 5 }),
      product("fresh", { minAgeMonths: 6, maxAgeMonths: 12, rating: 3 }),
      product("all", { minAgeMonths: null, maxAgeMonths: null }),
      product("young", { minAgeMonths: 0, maxAgeMonths: 3 }),
      product("big", { minAgeMonths: 12, maxAgeMonths: 24 }),
    ];
    expect(pickAgeProduct(list, 6, new Set(), new Set())?.id).toBe("fresh");
  });

  it("jo pelena, jo jashtë stokut, jo të blera, jo të mbyllura", () => {
    const list = [
      product("diaper", { name: "Pampers Nr. 3" }),
      product("empty", { stock: 0 }),
      product("bought"),
      product("closed"),
      product("ok", { rating: 1 }),
    ];
    expect(pickAgeProduct(list, 8, new Set(["bought"]), new Set(["product:closed"]))?.id).toBe("ok");
    expect(pickAgeProduct(list, null, new Set(), new Set())).toBeNull();
  });
});

describe("një kartë e vetme", () => {
  const diaper = { daysLeft: 2, left: 12 };
  const size = sizeUpHint(currentDiaperSize("3", null), 9.8);
  const prod = { id: "p1" };

  it("radha: pelenat → madhësia → mosha", () => {
    expect(chooseSuggestion({ diaper, stockKey: "s1", size, product: prod, dismissed: new Set() })?.kind).toBe("diaper");
    expect(chooseSuggestion({ diaper: null, stockKey: null, size, product: prod, dismissed: new Set() })?.kind).toBe("size");
    expect(chooseSuggestion({ diaper: null, stockKey: null, size: null, product: prod, dismissed: new Set() })?.kind).toBe("product");
    expect(chooseSuggestion({ diaper: null, stockKey: null, size: null, product: null, dismissed: new Set() })).toBeNull();
  });

  it("e mbyllura kalon te tjetra; paketa e re pelenash pyet sërish", () => {
    expect(chooseSuggestion({ diaper, stockKey: "s1", size, product: prod, dismissed: new Set(["diaper:s1"]) })?.kind).toBe("size");
    expect(chooseSuggestion({ diaper, stockKey: "s2", size, product: prod, dismissed: new Set(["diaper:s1"]) })?.kind).toBe("diaper");
    expect(chooseSuggestion({ diaper: null, stockKey: null, size, product: prod, dismissed: new Set(["size:4", "product:p1"]) })).toBeNull();
  });

  it("mbylljet skadojnë", () => {
    const now = new Date("2026-10-10T12:00:00Z");
    const d = activeDismissals({ a: "2026-10-11T00:00:00Z", b: "2026-10-09T00:00:00Z" }, now);
    expect([...d]).toEqual(["a"]);
  });
});
