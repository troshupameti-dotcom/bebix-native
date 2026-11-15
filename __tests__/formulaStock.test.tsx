import { renderScreen, router, visibleText } from "./helpers/screen";
import { act } from "react-test-renderer";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { FormulaStockCard } from "@/components/baby/FormulaStockCard";
import { estimateFormulaStock, formulaEntries, FORMULA_LOW_DAYS, usesFormula } from "@/lib/baby/formulaStock";
import { FORMULA_PATTERN } from "@/lib/shop/reorder";
import { chooseSuggestion, formulaPrompt } from "@/lib/shop/suggestions";
import type { FeedingEntry } from "@/lib/state/babyTypes";

const NOW = new Date("2026-11-14T12:00:00Z").getTime();
const ago = (hours: number, now = NOW) => new Date(now - hours * 3_600_000).toISOString();
const feed = (type: FeedingEntry["type"], at: string): FeedingEntry =>
  ({ id: `${type}-${at}`, type, amountMl: 120, durationMin: null, side: null, foodCategory: null, at, note: "", createdAt: at, updatedAt: at, editCount: 0, deletedAt: null, archivedAt: null }) as FeedingEntry;

describe("formula e mbetur, si pelenat", () => {
  it("vetëm shishet e formulës e harxhojnë: qumështi i gjirit në shishe jo", () => {
    const log = [feed("formula", ago(2)), feed("bottle", ago(3)), feed("breast", ago(4)), feed("formula", ago(5))];
    expect(formulaEntries(log)).toHaveLength(2);
    const e = estimateFormulaStock({ remaining: 30, setAt: ago(24) }, formulaEntries(log), NOW);
    expect(e.left).toBe(28);
  });

  it("kujtesa vjen kur mjafton për 4 ditë ose më pak (një ditë më herët se pelenat)", () => {
    // 6 shishe në ditë për 3 ditë → 6/ditë.
    const log = Array.from({ length: 18 }, (_, i) => feed("formula", ago(1 + i * 4)));
    const plenty = estimateFormulaStock({ remaining: 60, setAt: ago(100) }, formulaEntries(log), NOW);
    expect(plenty.daysLeft).toBeCloseTo(7, 5);
    expect(plenty.low).toBe(false);
    expect(formulaPrompt(plenty)).toBeNull();

    const soon = estimateFormulaStock({ remaining: 42, setAt: ago(100) }, formulaEntries(log), NOW);
    expect(soon.daysLeft).toBeCloseTo(4, 5);
    expect(FORMULA_LOW_DAYS).toBe(4);
    expect(soon.low).toBe(true);
    expect(formulaPrompt(soon)).toEqual({ daysLeft: 4, left: 24 });
  });

  it("karta del vetëm kur bebi pi formulë (30 ditët e fundit)", () => {
    expect(usesFormula([feed("breast", ago(1))], NOW)).toBe(false);
    expect(usesFormula([feed("formula", ago(24 * 40))], NOW)).toBe(false);
    expect(usesFormula([feed("formula", ago(24 * 10))], NOW)).toBe(true);
  });

  it("e njeh formulën në porositë e dyqanit, por jo enët e qumështit të gjirit ose puretë", () => {
    for (const name of ["Aptamil 1, 800 g", "NAN Optipro 2", "Formulë qumështi Humana 1", "HiPP Combiotik 2", "Bebelac Gold 1", "Qumësht fillestar 1"]) {
      expect([name, FORMULA_PATTERN.test(name)]).toEqual([name, true]);
    }
    for (const name of ["Enë për qumështin e gjirit, 10 × 180 ml", "HiPP pure molle", "Banane me kos", "Biberon 260 ml"]) {
      expect([name, FORMULA_PATTERN.test(name)]).toEqual([name, false]);
    }
  });

  it("te faqja kryesore, formula del para pelenave; e mbyllur, del sërish nesër", () => {
    const formula = { daysLeft: 2, left: 12 };
    const diaper = { daysLeft: 1, left: 5 };
    const first = chooseSuggestion({ formula, formulaKey: "k1", diaper, stockKey: "d1", size: null, product: null, dismissed: new Set() });
    expect(first).toEqual({ kind: "formula", key: "formula:k1", prompt: formula });
    const next = chooseSuggestion({ formula, formulaKey: "k1", diaper, stockKey: "d1", size: null, product: null, dismissed: new Set(["formula:k1"]) });
    expect(next?.kind).toBe("diaper");
  });
});

describe("karta e formulës te ushqyerja", () => {
  it("pa formulë në ditar: vetëm një rresht i vogël, që hapet me prekje dhe ruan servimet", async () => {
    const r = await renderScreen(<FormulaStockCard log={[feed("breast", ago(1, Date.now()))]} />);
    const text = visibleText(r.root);
    expect(text).toEqual(expect.arrayContaining(["Formula e mbetur", "Shkruaj sa servime ke, dhe të kujtojmë para se të mbarojë"]));
    // Formulari s'del pa prekje: nënat që ushqejnë me gji s'shohin fushë për të shkruar.
    expect(r.root.findAll((n) => n.props.keyboardType === "number-pad")).toHaveLength(0);

    const row = r.root.findAll((n) => typeof n.props.onPress === "function" && String(n.props.accessibilityLabel ?? "").startsWith("Formula e mbetur"))[0];
    await act(async () => row.props.onPress());
    const input = r.root.findAll((n) => n.props.keyboardType === "number-pad")[0];
    expect(input).toBeTruthy();
    await act(async () => input.props.onChangeText("24"));
    await act(async () => input.props.onSubmitEditing());
    expect(JSON.parse((await AsyncStorage.getItem("bebix_formula_stock_v1"))!).remaining).toBe(24);
    expect(visibleText(r.root)).toEqual(expect.arrayContaining(["Mbeten ~24 servime"]));
    await act(async () => {
      await AsyncStorage.removeItem("bebix_formula_stock_v1");
    });
  });

  it("me shishe formule: pyet sa servime; kur po mbaron, çon te formulat e dyqanit", async () => {
    const now = Date.now();
    const log = Array.from({ length: 12 }, (_, i) => feed("formula", ago(1 + i * 6, now)));
    const r = await renderScreen(<FormulaStockCard log={log} />);
    expect(visibleText(r.root)).toEqual(expect.arrayContaining(["Formula e mbetur"]));

    // Prindi vendos 10 servime (më pak se 2 ditë me 4 shishe në ditë) → "Formula po mbaron".
    await act(async () => {
      await AsyncStorage.setItem("bebix_formula_stock_v1", JSON.stringify({ remaining: 10, setAt: new Date(now).toISOString() }));
    });
    const again = await renderScreen(<FormulaStockCard log={log} />);
    const text = visibleText(again.root);
    expect(text).toEqual(expect.arrayContaining(["Formula po mbaron", "Mbeten ~10 servime", "Shiko formulat te Dyqani"]));
    const find = again.root.findAll((n) => typeof n.props.onPress === "function" && n.props.accessibilityRole === "button").find((n) => n.findAll((c) => c.props.children === "Shiko formulat te Dyqani").length > 0)!;
    await act(async () => find.props.onPress());
    expect(router().push).toHaveBeenCalledWith({ pathname: "/(main)/shop", params: { q: "formula" } });
  });
});
