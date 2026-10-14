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
import { cleanPrefs, DEFAULT_NIGHT_PREFS } from "@/lib/baby/nightMode";
import { nightRange, nightSummary } from "@/lib/baby/nightSummary";
import { brightnessController } from "@/lib/baby/nightScreen";
import { BREAST_TIMER_KEY } from "@/lib/baby/breastTimer";
import { translations } from "@/lib/i18n/translations";
import type { DiaperEntry, FeedingEntry, SleepEntry } from "@/lib/state/babyTypes";

const sq = translations.sq;
const at = (d: number, h: number, m = 0) => new Date(2026, 9, d, h, m);
const life = { createdAt: "", updatedAt: "", editCount: 0, deletedAt: null, archivedAt: null };
const feeding = (t: Date, extra: Partial<FeedingEntry> = {}) =>
  ({ ...life, id: String(t.getTime()), type: "bottle", at: t.toISOString(), ...extra }) as FeedingEntry;
const sleep = (from: Date, to: Date | null) =>
  ({ ...life, id: String(from.getTime()), startAt: from.toISOString(), endAt: to ? to.toISOString() : null }) as SleepEntry;
const diaper = (t: Date) => ({ ...life, id: String(t.getTime()), type: "wet", at: t.toISOString() }) as DiaperEntry;

describe("ngjyrat e natës", () => {
  it("pothuajse pa të kaltër: asnjë ngjyrë s'kalon #1B në kanalin blu (drita e kaltër e prish gjumin më shumë)", () => {
    for (const [name, hex] of Object.entries(NIGHT_COLORS)) {
      expect({ name, blue: parseInt(hex.slice(5, 7), 16) <= 0x1b }).toEqual({ name, blue: true });
    }
    expect(NIGHT_COLORS.bg).toBe("#000000");
  });
});

describe("Nata deri tani", () => {
  it("brenda orarit: nga 22:00 e mbrëmjes deri në 06:00", () => {
    expect(nightRange(at(14, 2), DEFAULT_NIGHT_PREFS)).toEqual({ start: at(13, 22).getTime(), end: at(14, 6).getTime() });
    expect(nightRange(at(13, 23), DEFAULT_NIGHT_PREFS).start).toBe(at(13, 22).getTime());
  });

  it("e ndezur me dorë ditën: katër orët e fundit", () => {
    const r = nightRange(at(14, 14, 30), DEFAULT_NIGHT_PREFS);
    expect(r.start).toBe(at(14, 10).getTime());
    expect(r.end).toBeGreaterThan(at(14, 14, 30).getTime());
  });

  it("gjumi pritet te fillimi i natës dhe te tani; ilaçet, të fshirat dhe e ardhmja s'numërohen", () => {
    const s = nightSummary(
      {
        sleepLog: [sleep(at(13, 21), at(13, 23, 30)), sleep(at(14, 1), null)],
        feedingLog: [
          feeding(at(13, 23, 40)),
          feeding(at(14, 0, 50), { type: "medicine" }),
          feeding(at(14, 0, 55), { deletedAt: "x" }),
          feeding(at(13, 20)),
        ],
        diaperLog: [diaper(at(14, 0, 10)), diaper(at(14, 3))],
      },
      at(14, 2),
      DEFAULT_NIGHT_PREFS
    );
    expect(s.sleptMin).toBe(90 + 60);
    expect(s.sleeps.map((x) => x.ongoing)).toEqual([false, true]);
    expect(s.feedings).toEqual([at(13, 23, 40).getTime()]);
    expect(s.diapers).toEqual([at(14, 0, 10).getTime()]);
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

describe("pamja e natës", () => {
  it("“Nata deri tani” numëron pelenën e sapo shënuar", async () => {
    const r = await renderScreen(<NightMode />);
    expect(visibleText(r.root)).toContain("Ushqime 0 · Pelena 0 · Gjumë 0 min");
    await act(async () => {
      button(r.root, sq.night_wet).props.onPress();
    });
    expect(visibleText(r.root)).toContain("Ushqime 0 · Pelena 1 · Gjumë 0 min");
    expect(visibleText(r.root)).toContain("U ruajt: E lagur");
  });

  it("“Drita”: krejt ekrani dritë e kuqe; fuqia ndryshon; prekja kthen dhe fuqia mbahet mend", async () => {
    const r = await renderScreen(<NightMode />);
    await act(async () => {
      button(r.root, sq.night_light).props.onPress();
    });
    expect(lightView(r.root)).toBeDefined();
    expect(visibleText(r.root)).toContain(sq.night_light_hint);
    expect(lightView(r.root)!.props.accessibilityValue.now).toBe(40);

    await a11y(lightView(r.root)!, "increment");
    expect(lightView(r.root)!.props.accessibilityValue.now).toBe(50);

    await a11y(lightView(r.root)!, "activate");
    expect(lightView(r.root)).toBeUndefined();
    expect(visibleText(r.root)).toContain(sq.night_section_diaper.toUpperCase());
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
      button(r.root, sq.night_light).props.onPress();
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

  it("gjidhënia: “Ndërro anën” kalon te gjiri tjetër pa e ndalur timerin", async () => {
    const startedAt = new Date(Date.now() - 5 * 60_000).toISOString();
    await AsyncStorage.setItem(BREAST_TIMER_KEY, JSON.stringify({ startedAt, side: "left", sides: ["left"] }));
    const r = await renderScreen(<NightMode />);
    const label = sq.night_switch_side.replace("{side}", sq.feeding_side_right);
    await act(async () => {
      button(r.root, label).props.onPress();
    });
    expect(visibleText(r.root)).toContain(sq.night_side_now.replace("{side}", sq.feeding_side_right));
    expect(JSON.parse((await AsyncStorage.getItem(BREAST_TIMER_KEY))!)).toMatchObject({ side: "right", sides: ["left", "right"] });
  });
});
