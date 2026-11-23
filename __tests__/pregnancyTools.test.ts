import {
  BAG_ITEMS, EMPTY_BAG, KICK_GOAL, addCustomItem, addKick, bagProgress, finishKicks, formatSec, intervalSec, kickMinutes, kickWindowOver,
  parseBag, removeCustomItem, startContraction, stopContraction, summarizeContractions, toggleBagItem, undoKick, type Contraction, type KickState,
} from "@/lib/parent/pregnancyTools";
import { translations } from "@/lib/i18n/translations";

// Jest e ngre `jest.mock` mbi importet.
jest.mock("@react-native-async-storage/async-storage", () => ({ getItem: jest.fn(), setItem: jest.fn(), multiRemove: jest.fn() }));

const T0 = new Date("2026-11-23T10:00:00");
const at = (min: number, sec = 0) => new Date(T0.getTime() + min * 60_000 + sec * 1000);

describe("lëvizjet e bebit", () => {
  const empty: KickState = { current: null, history: [] };

  it("e para nis seancën, e 10-ta e mbyll dhe e kalon te historiku", () => {
    let s = addKick(empty, at(0));
    expect(s.current?.kicks).toHaveLength(1);
    for (let i = 1; i < KICK_GOAL; i++) s = addKick(s, at(i * 3));
    expect(s.current).toBeNull();
    expect(s.history).toHaveLength(1);
    expect(s.history[0].kicks).toHaveLength(10);
    // Nga nisja te lëvizja e 10-të: 27 minuta.
    expect(kickMinutes(s.history[0])).toBe(27);
  });

  it("heq lëvizjen e fundit; pa lëvizje, seanca anulohet", () => {
    let s = addKick(addKick(empty, at(0)), at(1));
    s = undoKick(s);
    expect(s.current?.kicks).toHaveLength(1);
    s = undoKick(s);
    expect(s.current).toBeNull();
    expect(s.history).toHaveLength(0);
  });

  it("përfundimi para 10 lëvizjeve ruan seancën e pjesshme", () => {
    const s = finishKicks(addKick(addKick(empty, at(0)), at(5)), at(8));
    expect(s.current).toBeNull();
    expect(s.history[0].kicks).toHaveLength(2);
  });

  it("pas 2 orësh pa 10 lëvizje, paralajmëron", () => {
    const s = addKick(empty, at(0));
    expect(kickWindowOver(s.current!, at(119))).toBe(false);
    expect(kickWindowOver(s.current!, at(120))).toBe(true);
  });
});

describe("kontraksionet", () => {
  /** Kontraksione çdo `every` minuta, secili `len` sekonda, për `count` herë. Lista: më i riu i pari. */
  function series(count: number, every: number, len: number): Contraction[] {
    let list: Contraction[] = [];
    for (let i = 0; i < count; i++) {
      list = startContraction(list, at(i * every));
      list = stopContraction(list, at(i * every, len));
    }
    return list;
  }

  it("nisja e një të riu mbyll atë që po ecën", () => {
    let list = startContraction([], at(0));
    list = startContraction(list, at(4));
    expect(list).toHaveLength(2);
    expect(list[1].endAt).not.toBeNull();
    expect(list[0].endAt).toBeNull();
  });

  it("intervali matet nga nisja e të mëparshmit", () => {
    const list = series(3, 6, 50);
    expect(intervalSec(list, 0)).toBe(360);
    expect(intervalSec(list, 2)).toBeNull();
  });

  it("5-1-1: çdo 5 min, 1 min secili, prej një ore", () => {
    const list = series(13, 5, 60);
    const s = summarizeContractions(list, at(61));
    expect(s.status).toBe("511");
    expect(s.avgIntervalSec).toBe(300);
    expect(s.avgDurationSec).toBe(60);
  });

  it("çdo 5 min por vetëm prej 20 minutash: ende jo 5-1-1", () => {
    const s = summarizeContractions(series(5, 5, 60), at(21));
    expect(s.status).toBe("regular");
  });

  it("të shkurtra (30 s) edhe kur vijnë shpesh: jo 5-1-1", () => {
    expect(summarizeContractions(series(13, 5, 30), at(61)).status).toBe("regular");
  });

  it("të rralla: ende të parregullta", () => {
    const s = summarizeContractions(series(3, 20, 40), at(45));
    expect(s.status).toBe("early");
    expect(s.count).toBe(3);
  });

  it("pa asnjë në orën e fundit", () => {
    expect(summarizeContractions(series(3, 5, 60), at(200)).status).toBe("none");
  });

  it("formati i kohës", () => {
    expect(formatSec(45)).toBe("45 s");
    expect(formatSec(65)).toBe("1:05");
  });
});

describe("lista e përgatitjes", () => {
  const hospital = BAG_ITEMS.filter((i) => i.phase === "hospital").length;

  it("tri faza; çanta e maternitetit mbetet me 20 sende", () => {
    expect(hospital).toBe(20);
    expect(BAG_ITEMS.filter((i) => i.phase === "before").length).toBeGreaterThan(5);
    expect(BAG_ITEMS.filter((i) => i.phase === "after").length).toBeGreaterThan(5);
    expect(new Set(BAG_ITEMS.map((i) => i.id)).size).toBe(BAG_ITEMS.length);
  });

  it("shenjat numërohen sipas fazës, pa dyfishime", () => {
    let b = toggleBagItem(EMPTY_BAG, "id_card");
    b = toggleBagItem(b, "car_seat");
    b = toggleBagItem(b, "crib");
    expect(bagProgress(b, "hospital")).toEqual({ done: 2, total: hospital });
    expect(bagProgress(b, "before").done).toBe(1);
    expect(bagProgress(b).done).toBe(3);
    expect(toggleBagItem(b, "id_card").checked).toEqual(["car_seat", "crib"]);
  });

  it("sendet e prindit: shtohen në fazën e zgjedhur, pa bosh dhe pa përsëritje, dhe hiqen bashkë me shenjën", () => {
    let b = addCustomItem(EMPTY_BAG, "  Kapelë   leshi ", "hospital", "custom:a");
    expect(b.custom).toEqual([{ id: "custom:a", label: "Kapelë leshi", phase: "hospital" }]);
    expect(addCustomItem(b, "kapelë LESHI", "hospital", "custom:b")).toBe(b);
    expect(addCustomItem(b, "   ", "after", "custom:c")).toBe(b);
    b = toggleBagItem(b, "custom:a");
    expect(bagProgress(b, "hospital")).toEqual({ done: 1, total: hospital + 1 });
    b = removeCustomItem(b, "custom:a");
    expect(b).toEqual(EMPTY_BAG);
  });

  it("lexon edhe formatin e vjetër (vetëm shenjat) dhe hedh të panjohurat", () => {
    expect(parseBag(["id_card", "wipes"])).toEqual({ checked: ["id_card", "wipes"], custom: [] });
    const parsed = parseBag({ checked: ["id_card", "s'ekziston", "custom:x"], custom: [{ id: "custom:x", label: "Libër", phase: "after" }, { id: "bad", label: "x", phase: "after" }] });
    expect(parsed).toEqual({ checked: ["id_card", "custom:x"], custom: [{ id: "custom:x", label: "Libër", phase: "after" }] });
    expect(parseBag(null)).toEqual(EMPTY_BAG);
  });

  it("çdo sugjerim ka tekst në shqip dhe anglisht; dyqani vetëm te sendet e ushqyerjes", () => {
    for (const item of BAG_ITEMS) {
      const key = `bag_item_${item.id}` as keyof typeof translations.sq;
      expect(translations.sq[key]).toBeTruthy();
      expect(translations.en[key as keyof typeof translations.en]).toBeTruthy();
    }
    expect(BAG_ITEMS.filter((i) => i.shopQuery).map((i) => i.id)).toEqual(["bottles_sterilizer", "milk_storage", "pacifier"]);
  });
});
