import { DEFAULT_NIGHT_PREFS, isNightTime, nextMorning, nightModeActive } from "@/lib/baby/nightMode";
import { buildIosWidgetProps, desiredLiveActivity, sameActivity } from "@/lib/widgets/iosProps";
import type { WidgetSnapshot } from "@/lib/widgets/snapshot";

jest.mock("@react-native-async-storage/async-storage", () => ({ getItem: jest.fn(async () => null), setItem: jest.fn(), removeItem: jest.fn() }));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const shortcuts = require("../plugins/withBebixShortcuts") as {
  SHORTCUTS: { id: string; uri: string }[];
  shortcutsXml: (pkg: string) => string;
  stringsXml: (lang: "sq" | "en") => string;
};

const at = (h: number, m = 0, d = 10) => new Date(2026, 9, d, h, m);

describe("modaliteti i natës", () => {
  it("22:00–06:00 vetë", () => {
    expect(isNightTime(at(22), DEFAULT_NIGHT_PREFS)).toBe(true);
    expect(isNightTime(at(3), DEFAULT_NIGHT_PREFS)).toBe(true);
    expect(isNightTime(at(6), DEFAULT_NIGHT_PREFS)).toBe(false);
    expect(isNightTime(at(21, 59), DEFAULT_NIGHT_PREFS)).toBe(false);
  });

  it("zgjedhja me dorë vlen deri në 07:00, pastaj vazhdon rregulli automatik", () => {
    expect(nextMorning(at(23)).getTime()).toBe(at(7, 0, 11).getTime());
    expect(nextMorning(at(3)).getTime()).toBe(at(7).getTime());
    const off = { mode: "off" as const, until: at(7, 0, 11).toISOString() };
    expect(nightModeActive(at(23), DEFAULT_NIGHT_PREFS, off)).toBe(false);
    expect(nightModeActive(at(23, 0, 11), DEFAULT_NIGHT_PREFS, off)).toBe(true);
    const on = { mode: "on" as const, until: at(7, 0, 11).toISOString() };
    expect(nightModeActive(at(20), DEFAULT_NIGHT_PREFS, on)).toBe(true);
  });

  it("pa automatik: vetëm me dorë", () => {
    expect(nightModeActive(at(3), { ...DEFAULT_NIGHT_PREFS, auto: false }, null)).toBe(false);
  });
});

const snap = (over: Partial<WidgetSnapshot> = {}): WidgetSnapshot => ({
  v: 1, lang: "sq", babyName: "Ana", feeding: null, diaper: null, sleep: null, lastWakeAt: null, breastSince: null, nextFeedingAt: null,
  updatedAt: "", ...over,
});

describe("iPhone: widget-i dhe Live Activity", () => {
  it("tekstet gati në gjuhën e prindit", () => {
    const now = at(14);
    const p = buildIosWidgetProps(snap({ feeding: { at: at(12).toISOString(), type: "bottle" }, nextFeedingAt: at(15).toISOString() }), now);
    expect(p.title).toBe("Bebix · Ana");
    expect(p.feeding).toMatchObject({ label: "Ushqimi", value: "12:00", detail: "Tjetri ~15:00" });
    expect(p.diaper.value).toBe("Ende asgjë");
    expect(p.actions).toEqual({ wet: "E lagët", dirty: "Bajga", sleep: "Fli" });
    const en = buildIosWidgetProps(snap({ lang: "en", sleep: { id: "s", since: at(13).toISOString() } }), now);
    expect(en.sleep).toMatchObject({ detail: "Asleep", asleep: true });
    expect(en.actions.sleep).toBe("Woke up");
  });

  it("Live Activity: gjiri ka përparësi, pastaj gjumi; asgjë kur s'ka timer", () => {
    expect(desiredLiveActivity(snap())).toBeNull();
    expect(desiredLiveActivity(null)).toBeNull();
    const sleep = desiredLiveActivity(snap({ sleep: { id: "s", since: "2026-10-10T20:00:00Z" } }));
    expect(sleep).toMatchObject({ kind: "sleep", startedAt: "2026-10-10T20:00:00Z", subtitle: "Ana" });
    const both = desiredLiveActivity(snap({ sleep: { id: "s", since: "x" }, breastSince: "2026-10-10T21:00:00Z" }));
    expect(both?.kind).toBe("breast");
    expect(sameActivity(sleep, desiredLiveActivity(snap({ sleep: { id: "s", since: "2026-10-10T20:00:00Z" } })))).toBe(true);
    expect(sameActivity(sleep, both)).toBe(false);
  });
});

describe("shortcuts e Android-it", () => {
  it("katër shortcuts me lidhjet bebix:// dhe tekste sq/en", () => {
    expect(shortcuts.SHORTCUTS.map((s) => s.uri)).toEqual([
      "bebix://log/diaper?type=wet",
      "bebix://log/diaper?type=dirty",
      "bebix://sleep/toggle",
      "bebix://log/feeding",
    ]);
    const xml = shortcuts.shortcutsXml("com.bebix.app");
    expect(xml).toContain('android:targetClass="com.bebix.app.MainActivity"');
    expect(xml.match(/<shortcut\b/g)).toHaveLength(4);
    expect(shortcuts.stringsXml("sq")).toContain(">E lagët<");
    expect(shortcuts.stringsXml("en")).toContain(">Wet diaper<");
  });
});
