/**
 * Modaliteti i natës i ri: e kuqe mbi të zezë, ekrani i errësuar vetë, drita e kuqe, "Nata deri tani",
 * ndërrimi i gjirit pa ndalur timerin. Ekrani me provider-at e vërtetë; logjika veç, me orë të fiksuar.
 */
import { renderScreen, visibleText, button } from "./helpers/screen";
import { act, type ReactTestInstance } from "react-test-renderer";
import { BackHandler, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { NightMode } from "@/components/baby/NightMode";
import { NIGHT_COLORS } from "@/components/baby/NightClock";
import { cleanPrefs } from "@/lib/baby/nightMode";
import { brightnessController } from "@/lib/baby/nightScreen";
import { translations } from "@/lib/i18n/translations";

const sq = translations.sq;

describe("ngjyrat e natës", () => {
  it("pothuajse pa të kaltër: asnjë ngjyrë s'kalon #1B në kanalin blu (drita e kaltër e prish gjumin më shumë)", () => {
    for (const [name, hex] of Object.entries(NIGHT_COLORS)) {
      expect({ name, blue: parseInt(hex.slice(5, 7), 16) <= 0x1b }).toEqual({ name, blue: true });
    }
    expect(NIGHT_COLORS.bg).toBe("#000000");
  });
});

describe("cilësimet e ruajtura", () => {
  it("cilësimet e vjetra marrin parazgjedhjet e reja; vlerat e dëmtuara korrigjohen", () => {
    expect(cleanPrefs({ auto: false })).toMatchObject({ auto: false, dimLevel: 0.1, lightLevel: 0.4 });
    expect(cleanPrefs({ dimLevel: null }).dimLevel).toBeNull();
    expect(cleanPrefs({ dimLevel: 5, lightLevel: Number.NaN })).toMatchObject({ dimLevel: 0.1, lightLevel: 0.4 });
  });
});

describe("ndriçimi i ekranit", () => {
  const fakeApi = () => {
    const calls: string[] = [];
    return {
      calls,
      api: {
        getBrightnessAsync: async () => {
          calls.push("get");
          return 0.8;
        },
        setBrightnessAsync: async (v: number) => {
          calls.push(`set ${v}`);
        },
        restoreSystemBrightnessAsync: async () => {
          calls.push("restore");
        },
      },
    };
  };

  it("iPhone: errësim → dritë → mbyllje, pa u kthyer në ndriçimin e plotë ndërmjet (pa ndezje)", async () => {
    const { api, calls } = fakeApi();
    const c = brightnessController(api);
    await c.set(0.1);
    await c.set(0.45);
    await c.set(null);
    expect(calls).toEqual(["get", "set 0.1", "set 0.45", "set 0.8"]);
  });

  it("Android: në fund dritarja i kthehet ndriçimit të sistemit", async () => {
    jest.replaceProperty(Platform, "OS", "android");
    const { api, calls } = fakeApi();
    const c = brightnessController(api);
    await c.set(0.04);
    c.restore();
    expect(calls).toEqual(["get", "set 0.04", "restore"]);
    jest.restoreAllMocks();
  });

  it("app-i në sfond: kthehet; kur rikthehet: errësohet sërish", async () => {
    const { api, calls } = fakeApi();
    const c = brightnessController(api);
    await c.set(0.1);
    c.restore();
    c.reapply();
    await new Promise((r) => setTimeout(r, 0));
    expect(calls).toEqual(["get", "set 0.1", "set 0.8", "get", "set 0.1"]);
  });
});

/** Elementi me rolin "adjustable" (drita e kuqe). */
const lightView = (root: ReactTestInstance): ReactTestInstance | undefined =>
  root.findAll((n) => n.props.accessibilityRole === "adjustable" && typeof n.props.onAccessibilityAction === "function")[0];
const a11y = (node: ReactTestInstance, actionName: string) =>
  act(async () => {
    node.props.onAccessibilityAction({ nativeEvent: { actionName } });
  });

/** Butoni sipas etiketës për lexuesit e ekranit (drita është vetëm ikonë, pa tekst). */
const byLabel = (root: ReactTestInstance, label: string): ReactTestInstance =>
  root.findAll((n) => n.props.accessibilityLabel === label && typeof n.props.onPress === "function")[0];

describe("pamja e natës", () => {
  it("e thjeshtë: ora, sa fle bebi, dhe vetëm Ushqim / Pelenë / Gjumë (pa “Nata deri tani”)", async () => {
    const r = await renderScreen(<NightMode />);
    const text = visibleText(r.root);
    for (const label of [sq.night_btn_feed, sq.night_btn_diaper, sq.night_btn_sleep]) expect(text).toContain(label);
    expect(text.filter((x) => /Nata deri tani|NATA DERI TANI|Ushqime \d/.test(x))).toEqual([]);
    await act(async () => {
      button(r.root, sq.night_btn_diaper).props.onPress();
    });
    expect(visibleText(r.root)).toContain(`U ruajt: ${sq.night_btn_diaper}`);
    await act(async () => {
      button(r.root, sq.night_btn_sleep).props.onPress();
    });
    expect(visibleText(r.root)).toContain(sq.night_btn_wake);
  });

  it("“Drita”: krejt ekrani dritë e kuqe; fuqia ndryshon; prekja kthen dhe fuqia mbahet mend", async () => {
    const r = await renderScreen(<NightMode />);
    await act(async () => {
      byLabel(r.root, sq.night_light).props.onPress();
    });
    expect(lightView(r.root)).toBeDefined();
    expect(visibleText(r.root)).toContain(`↑  ${sq.night_swipe_up}`);
    expect(visibleText(r.root)).toContain(`↓  ${sq.night_swipe_down}`);
    expect(lightView(r.root)!.props.accessibilityValue.now).toBe(40);

    await a11y(lightView(r.root)!, "increment");
    expect(lightView(r.root)!.props.accessibilityValue.now).toBe(50);

    await a11y(lightView(r.root)!, "activate");
    expect(lightView(r.root)).toBeUndefined();
    expect(visibleText(r.root)).toContain(sq.night_btn_diaper);
    expect(JSON.parse((await AsyncStorage.getItem("bebix_night_prefs_v1"))!).lightLevel).toBeCloseTo(0.5);
  });

  it("Android: butoni fizik “mbrapa” fik dritën, pa dalë nga app-i", async () => {
    const handlers: (() => boolean | null | undefined)[] = [];
    jest.spyOn(BackHandler, "addEventListener").mockImplementation((_e, h) => {
      handlers.push(h as () => boolean);
      return { remove: () => handlers.splice(handlers.indexOf(h as () => boolean), 1) };
    });
    const r = await renderScreen(<NightMode />);
    await act(async () => {
      byLabel(r.root, sq.night_light).props.onPress();
    });
    expect(lightView(r.root)).toBeDefined();
    let handled: boolean | null | undefined = false;
    await act(async () => {
      handled = handlers[handlers.length - 1]();
    });
    expect(handled).toBe(true);
    expect(lightView(r.root)).toBeUndefined();
    jest.restoreAllMocks();
  });
});
