/* eslint-disable @typescript-eslint/no-require-imports -- fabrika e jest.mock ekzekutohet para importeve */
import { useEffect } from "react";
import { act } from "react-test-renderer";
import type { ReactTestInstance } from "react-test-renderer";
import { button, renderScreen, visibleText } from "./helpers/screen";
import FeedingScreen from "@/app/(main)/baby/feeding";
import { useAppState } from "@/lib/state/AppStateContext";
import type { FeedingEntry } from "@/lib/state/types";
import {
  __resetFeedUnitsForTests, formatNumber, mlToOz, ozToMl, parseAmount, solidAmountText, stepOz, stepSolid, volumeText,
} from "@/lib/baby/feedUnits";

// Rreshtat e historikut rrëshqasin për t'u fshirë (reanimated); këtu mjafton përmbajtja e tyre.
jest.mock("react-native-gesture-handler/ReanimatedSwipeable", () => {
  const { forwardRef } = require("react");
  const Swipeable = forwardRef(({ children }: { children: unknown }, _ref: unknown) => children);
  Swipeable.displayName = "Swipeable";
  return { __esModule: true, default: Swipeable };
});

describe("njësitë e sasisë", () => {
  it("oz ↔ ml, me një shifër pas presjes", () => {
    expect(ozToMl(4)).toBe(118);
    expect(mlToOz(118)).toBe(4);
    expect(mlToOz(90)).toBe(3);
    expect(ozToMl(mlToOz(150))).toBeGreaterThanOrEqual(148);
  });

  it("numri sipas gjuhës dhe leximi me presje ose pikë", () => {
    expect(formatNumber(3.5, "sq")).toBe("3,5");
    expect(formatNumber(3.5, "en")).toBe("3.5");
    expect(parseAmount("3,5")).toBe(3.5);
    expect(parseAmount("3.5 oz")).toBe(3.5);
    expect(parseAmount("")).toBeNull();
    expect(volumeText(118, "oz", "sq")).toBe("4 oz");
    expect(volumeText(118, "ml", "sq")).toBe("118 ml");
  });

  it("hapat: gjysmë oz te shishja; 10 g, 0,5 oz ose 1 lugë te ushqimi, pa kaluar kufijtë", () => {
    expect(mlToOz(stepOz(89, 1, 400))).toBe(3.5);
    expect(mlToOz(stepOz(104, -1, 400))).toBe(3);
    expect(stepOz(10, -1, 400)).toBe(0);
    expect(stepSolid(null, "g", 1)).toBe(10);
    expect(stepSolid(25, "g", 1)).toBe(30);
    expect(stepSolid(25, "g", -1)).toBe(20);
    expect(stepSolid(1, "oz", 1)).toBe(1.5);
    expect(stepSolid(2, "spoon", -1)).toBe(1);
    expect(stepSolid(20, "spoon", 1)).toBe(20);
    expect(stepSolid(0, "g", -1)).toBe(0);
  });

  it("sasia e ushqimit si tekst", () => {
    const t = ((k: string, p?: Record<string, string | number>) => (k === "feeding_unit_spoon_one" ? "1 lugë" : `${p?.n} lugë`)) as never;
    expect(solidAmountText(40, "g", "sq", t)).toBe("40 g");
    expect(solidAmountText(1.5, "oz", "sq", t)).toBe("1,5 oz");
    expect(solidAmountText(1, "spoon", "sq", t)).toBe("1 lugë");
    expect(solidAmountText(3, "spoon", "sq", t)).toBe("3 lugë");
  });
});

/** Shënimet e ushqyerjes siç i ruan app-i (lexohen pas render-it). */
const seen: { feedings: FeedingEntry[] } = { feedings: [] };
function Probe() {
  const app = useAppState();
  useEffect(() => {
    seen.feedings = app.state.baby.feedingLog;
  });
  return null;
}

const byLabel = (root: ReactTestInstance, label: string) => {
  const hits = root.findAll((n) => n.props.accessibilityLabel === label && typeof n.props.onPress === "function");
  if (!hits.length) throw new Error(`S'u gjet "${label}"`);
  return hits[0];
};
const text = (root: ReactTestInstance) => visibleText(root).join(" | ");

describe("ushqyerja me g, oz dhe lugë", () => {
  beforeEach(() => {
    __resetFeedUnitsForTests();
    seen.feedings = [];
  });

  it("ushqimi i ngurtë ruan sasinë në gramë", async () => {
    const r = await renderScreen(<><FeedingScreen /><Probe /></>);
    await act(async () => button(r.root, "Ushqim").props.onPress());
    expect(text(r.root)).toMatch(/Sa hëngri\? \(sipas dëshirës\)/);
    for (let i = 0; i < 3; i++) await act(async () => byLabel(r.root, "Më shumë").props.onPress());
    await act(async () => button(r.root, "Ruaj · 30 g").props.onPress());
    const entry = seen.feedings.find((f) => f.type === "solid")!;
    expect(entry.solidAmount).toBe(30);
    expect(entry.solidUnit).toBe("g");
    expect(text(r.root)).toMatch(/Ushqim i ngurtë · 30 g/);
  });

  it("me lugë: njësia mbetet e zgjedhur dhe ruhet ashtu siç u shkrua", async () => {
    const r = await renderScreen(<><FeedingScreen /><Probe /></>);
    await act(async () => button(r.root, "Ushqim").props.onPress());
    await act(async () => button(r.root, "lugë").props.onPress());
    await act(async () => byLabel(r.root, "Më shumë").props.onPress());
    await act(async () => byLabel(r.root, "Më shumë").props.onPress());
    await act(async () => button(r.root, "Ruaj · 2 lugë").props.onPress());
    const entry = seen.feedings.find((f) => f.type === "solid")!;
    expect([entry.solidAmount, entry.solidUnit]).toEqual([2, "spoon"]);
  });

  it("pa sasi, shënimi s'merr asnjë sasi", async () => {
    const r = await renderScreen(<><FeedingScreen /><Probe /></>);
    await act(async () => button(r.root, "Ushqim").props.onPress());
    await act(async () => button(r.root, "Ruaj").props.onPress());
    const entry = seen.feedings.find((f) => f.type === "solid")!;
    expect(entry.solidAmount ?? null).toBeNull();
  });

  it("shishja në oz ruhet në ml, që totalet të mbeten të sakta", async () => {
    const r = await renderScreen(<><FeedingScreen /><Probe /></>);
    await act(async () => button(r.root, "Biberon").props.onPress());
    await act(async () => button(r.root, "oz").props.onPress());
    await act(async () => byLabel(r.root, "4 oz").props.onPress());
    await act(async () => button(r.root, "Ruaj · 4 oz").props.onPress());
    const entry = seen.feedings.find((f) => f.type === "bottle")!;
    expect(entry.amountMl).toBe(118);
    expect(text(r.root)).toMatch(/Biberon · 4 oz/);
  });
});
