/**
 * Zgjedhja e shpejtë (butoni "Ushqim" i widget-it, prekja e gjatë e ikonës): një prekje = shënimi, pastaj hapet
 * ekrani përkatës; "mbrapa" dhe "Mbyll" çojnë te kreu, jo jashtë app-it (16 tetor).
 */
import { BackHandler, Text } from "react-native";
import { act } from "react-test-renderer";
import { button, renderScreen, router, visibleText } from "./helpers/screen";
import QuickFeeding from "@/app/quick/feeding";
import QuickDiaper from "@/app/quick/diaper";
import { useAppState, active } from "@/lib/state/AppStateContext";
import { loadTimer } from "@/lib/baby/breastTimer";

const mockPush = jest.fn(async () => true);
jest.mock("@/lib/widgets/store", () => ({ pushAction: (...a: unknown[]) => mockPush(...(a as [])) }));

function Probe() {
  const { state } = useAppState();
  const log = active(state.baby.feedingLog);
  return <Text>{`probe:${log.map((e) => `${e.type}:${e.amountMl ?? "-"}`).join(",")}`}</Text>;
}

const probe = (texts: string[]) => texts.find((x) => x.startsWith("probe:"));
const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 10)); });

let handlers: (() => boolean | null | undefined)[] = [];
beforeEach(() => {
  handlers = [];
  mockPush.mockClear();
  jest.spyOn(BackHandler, "addEventListener").mockImplementation((_e, h) => {
    handlers.push(h as () => boolean);
    return { remove: () => { handlers = handlers.filter((x) => x !== h); } };
  });
});
afterEach(() => jest.restoreAllMocks());

describe("zgjedhja e shpejtë e ushqimit", () => {
  it("tregon gjirin majtas/djathtas, biberonin, formulën, ushqimin e ngurtë dhe 'Me detaje'", async () => {
    const r = await renderScreen(<QuickFeeding />);
    const texts = visibleText(r.root);
    for (const label of ["Shëno ushqimin", "Gji majtas", "Gji djathtas", "Biberon", "Formulë", "Ushqim i ngurtë", "Me detaje"]) {
      expect(texts).toContain(label);
    }
  });

  it("biberoni shënohet me një prekje dhe hapet Ushqyerja", async () => {
    const r = await renderScreen(<><QuickFeeding /><Probe /></>);
    await act(async () => button(r.root, "Biberon").props.onPress());
    await flush();
    expect(probe(visibleText(r.root))).toBe("probe:bottle:-");
    // Zgjedhja iku (u hap Ushqyerja përmes Redirect).
    expect(visibleText(r.root)).not.toContain("Gji majtas");
  });

  it("gjiri nis kohëmatësin në anën e zgjedhur, pa shënuar ende ushqim", async () => {
    const r = await renderScreen(<><QuickFeeding /><Probe /></>);
    await act(async () => button(r.root, "Gji djathtas").props.onPress());
    await flush();
    expect((await loadTimer())?.side).toBe("right");
    expect(probe(visibleText(r.root))).toBe("probe:");
  });

  it("“mbrapa” i Android-it dhe “Mbyll” çojnë te kreu", async () => {
    const r = await renderScreen(<QuickFeeding />);
    await flush();
    expect(handlers.at(-1)?.()).toBe(true);
    expect(router().replace).toHaveBeenLastCalledWith("/(main)/baby");
    router().replace.mockClear();
    act(() => r.root.findAll((n) => n.props.accessibilityLabel === "Mbyll" && typeof n.props.onPress === "function")[0].props.onPress());
    expect(router().replace).toHaveBeenLastCalledWith("/(main)/baby");
  });
});

describe("zgjedhja e shpejtë e pelenës", () => {
  it("“Me jashtëqitje” shkon në radhën e widget-it (pa dyfishim) dhe hapet Pelena", async () => {
    const r = await renderScreen(<QuickDiaper />);
    expect(visibleText(r.root)).toEqual(expect.arrayContaining(["Shëno pelenën", "E lagur", "Me jashtëqitje", "Të dyja"]));
    await act(async () => button(r.root, "Me jashtëqitje").props.onPress());
    await flush();
    expect(mockPush).toHaveBeenCalledWith({ kind: "diaper", type: "dirty" }, expect.any(Date), "deep_link");
    expect(visibleText(r.root)).not.toContain("E lagur");
  });

  it("“Me detaje” s'shënon asgjë", async () => {
    const r = await renderScreen(<QuickDiaper />);
    await act(async () => button(r.root, "Me detaje").props.onPress());
    await flush();
    expect(mockPush).not.toHaveBeenCalled();
  });
});
