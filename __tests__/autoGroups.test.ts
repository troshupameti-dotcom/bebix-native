import { activeSnoozes, ageKeyForMonths, autoGroupLabel, autoKeysFor, birthQuarterKey, fullMonths, growthPair, parseAutoKey } from "@/lib/community/autoGroups";
import { translations, type TranslationKey } from "@/lib/i18n/translations";

jest.mock("@react-native-async-storage/async-storage", () => ({ getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn() }));
jest.mock("@/lib/supabase/client", () => ({ supabase: {} }));

const d = (y: number, m: number, day: number) => new Date(y, m - 1, day);
const TODAY = d(2026, 10, 15);
const tr = (lang: "sq" | "en") => (key: TranslationKey, params?: Record<string, string | number>) => {
  let s: string = translations[lang][key] ?? key;
  for (const [k, v] of Object.entries(params ?? {})) s = s.replace(`{${k}}`, String(v));
  return s;
};

describe("grupet sipas moshës", () => {
  it("muaj të plotë; data në të ardhmen = asgjë", () => {
    expect(fullMonths(d(2026, 10, 15), TODAY)).toBe(0);
    expect(fullMonths(d(2026, 7, 16), TODAY)).toBe(2); // 2 muaj e 30 ditë
    expect(fullMonths(d(2026, 7, 15), TODAY)).toBe(3);
    expect(fullMonths(d(2026, 12, 1), TODAY)).toBeNull();
  });

  it("mosha → grupi, me kufijtë", () => {
    expect(ageKeyForMonths(0)).toBe("age:0-3");
    expect(ageKeyForMonths(2)).toBe("age:0-3");
    expect(ageKeyForMonths(3)).toBe("age:3-6");
    expect(ageKeyForMonths(6)).toBe("age:6-12");
    expect(ageKeyForMonths(11)).toBe("age:6-12");
    expect(ageKeyForMonths(12)).toBe("age:12-24");
    expect(ageKeyForMonths(23)).toBe("age:12-24");
    expect(ageKeyForMonths(24)).toBeNull();
    expect(ageKeyForMonths(null)).toBeNull();
  });

  it("tremujori i lindjes", () => {
    expect(birthQuarterKey(d(2026, 1, 1))).toBe("birth:2026-Q1");
    expect(birthQuarterKey(d(2026, 3, 31))).toBe("birth:2026-Q1");
    expect(birthQuarterKey(d(2026, 4, 1))).toBe("birth:2026-Q2");
    expect(birthQuarterKey(d(2026, 12, 31))).toBe("birth:2026-Q4");
  });

  it("çelësat për bebin (si në bazë): moshë + lindje; mbi 24 muaj vetëm lindja", () => {
    expect(autoKeysFor(d(2026, 6, 10), TODAY)).toEqual(["age:3-6", "birth:2026-Q2"]);
    expect(autoKeysFor(d(2024, 8, 1), TODAY)).toEqual(["birth:2024-Q3"]);
    expect(autoKeysFor(d(2027, 1, 1), TODAY)).toEqual([]);
    expect(autoKeysFor(null, TODAY)).toEqual([]);
  });

  it("bebi rritet: kalimi te grupi tjetër", () => {
    // 5 muaj → 3-6; pas një muaji → 6-12
    expect(autoKeysFor(d(2026, 5, 10), TODAY)[0]).toBe("age:3-6");
    expect(autoKeysFor(d(2026, 5, 10), d(2026, 11, 10))[0]).toBe("age:6-12");
    expect(growthPair([{ key: "age:6-12", action: "join" }, { key: "age:3-6", action: "leave" }, { key: "birth:2026-Q2", action: "join" }])).toEqual({
      join: "age:6-12",
      leave: "age:3-6",
    });
    expect(growthPair([{ key: "age:3-6", action: "join" }])).toBeNull();
  });

  it("emrat në shqip dhe anglisht; çelësat e panjohur s'pranohen", () => {
    expect(autoGroupLabel("age:3-6", tr("sq"))).toBe("Bebat 3–6 muaj");
    expect(autoGroupLabel("birth:2026-Q4", tr("sq"))).toBe("Lindur në tetor–dhjetor 2026");
    expect(autoGroupLabel("birth:2026-Q4", tr("en"))).toBe("Born Oct–Dec 2026");
    expect(parseAutoKey("age:hack")).toBeNull();
    expect(parseAutoKey("birth:2026-Q5")).toBeNull();
  });

  it("'Jo tash' skadon pas kohës së vet", () => {
    const now = new Date("2026-10-15T12:00:00Z");
    expect([...activeSnoozes({ "age:3-6": "2026-11-10T00:00:00Z", "age:0-3": "2026-10-01T00:00:00Z" }, now)]).toEqual(["age:3-6"]);
  });
});
