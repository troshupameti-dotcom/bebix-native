/**
 * Widget-i i Android-it sipas madhësisë (16 tetor): e vogla, e mesmja, e madhja (tablet), tekstet që s'priten,
 * dhe pamja që s'e numëron më ilaçin ose ujin si "ushqimi i fundit".
 */
import type { ReactElement, ReactNode } from "react";
import { isValidElement } from "react";
import { buildSnapshot, type WidgetSnapshot } from "@/lib/widgets/snapshot";
import { durationShort } from "@/lib/widgets/texts";
import { layoutFor, renderBebixWidget } from "@/widgets/android-home/BebixWidget";
import type { FeedingEntry, SleepEntry, DiaperEntry } from "@/lib/state/babyTypes";

jest.mock("@react-native-async-storage/async-storage", () => ({ getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn() }));
jest.mock("react-native-android-widget", () => ({ FlexWidget: "FlexWidget", TextWidget: "TextWidget" }));

const life = { createdAt: "", updatedAt: "", editCount: 0, deletedAt: null as string | null, archivedAt: null as string | null };
const feed = (id: string, at: Date, type: FeedingEntry["type"]): FeedingEntry =>
  ({ ...life, id, at: at.toISOString(), type, amountMl: null, durationMin: null, side: null, foodCategory: null, note: "" }) as FeedingEntry;
const diaper = (id: string, at: Date): DiaperEntry => ({ ...life, id, at: at.toISOString(), type: "wet", color: null, consistency: null, note: "" }) as DiaperEntry;
const sleep = (id: string, a: Date, b: Date | null): SleepEntry =>
  ({ ...life, id, startAt: a.toISOString(), endAt: b?.toISOString() ?? null, pausedIntervalsMin: 0, pausedAt: null, isNap: true, quality: null, note: "" }) as SleepEntry;

const at = (h: number, m = 0, d = 10) => new Date(2026, 9, d, h, m);
const NOW = at(14);
const base = { lang: "sq" as const, babyName: "Ana", feedingLog: [], diaperLog: [], sleepLog: [], breastTimer: null, now: NOW };

/** Komponentët e widget-it janë funksione të thjeshta: i hapim deri te elementët bazë dhe mbledhim çdo tekst/veprim. */
function flatten(node: ReactNode, out: { texts: string[]; actions: unknown[] } = { texts: [], actions: [] }) {
  if (Array.isArray(node)) node.forEach((n) => flatten(n, out));
  else if (isValidElement(node)) {
    const el = node as ReactElement<Record<string, unknown>>;
    if (typeof el.type === "function") return flatten((el.type as (p: unknown) => ReactNode)(el.props), out);
    if (el.type === "TextWidget") out.texts.push(String(el.props.text));
    if (el.props.clickAction) out.actions.push({ action: el.props.clickAction, data: el.props.clickActionData });
    flatten(el.props.children as ReactNode, out);
  }
  return out;
}

const snap = (over: Partial<WidgetSnapshot> = {}) => ({ ...buildSnapshot(base), ...over });
const render = (s: WidgetSnapshot | null, widthDp: number, heightDp: number) =>
  flatten(renderBebixWidget(s, { lang: "sq", widthDp, heightDp, now: NOW }).light);

describe("pamja sipas madhësisë", () => {
  it("2×2 e vogël, 4×2 e mesme, 4×3 e më shumë (tableti) e madhe", () => {
    expect(layoutFor({ widthDp: 150, heightDp: 150 })).toBe("small");
    expect(layoutFor({ widthDp: 300, heightDp: 110 })).toBe("medium");
    expect(layoutFor({ widthDp: 300, heightDp: 200 })).toBe("large");
    expect(layoutFor({ widthDp: 600, heightDp: 320 })).toBe("large");
    // Pa madhësi (thirrje e vjetër): e mesmja.
    expect(layoutFor({ widthDp: 0, heightDp: 110 })).toBe("medium");
  });

  it("e mesmja: tri kutitë dhe katër butonat me tekste të shkurtra standarde", () => {
    const r = render(snap(), 300, 110);
    expect(r.texts).toEqual(expect.arrayContaining(["Ushqimi", "Pelena", "Gjumi", "Ushqim", "E lagur", "Jashtëqitje", "Fli"]));
    expect(r.texts.join(" ")).not.toMatch(/Bajga|E lagët/);
    expect(r.actions).toEqual(
      expect.arrayContaining([
        { action: "OPEN_URI", data: { uri: "bebix://quick/feeding" } },
        { action: "DIAPER", data: { type: "wet" } },
        { action: "DIAPER", data: { type: "dirty" } },
        { action: "SLEEP_TOGGLE", data: undefined },
      ])
    );
  });

  it("e vogla: vetëm orët, pa butona (s'kanë vend)", () => {
    const r = render(snap(), 150, 150);
    expect(r.texts).toEqual(expect.arrayContaining(["Bebix · Ana", "Ushqimi", "Pelena", "Gjumi"]));
    expect(r.actions.some((a) => (a as { action: string }).action === "DIAPER")).toBe(false);
  });

  it("e madhja: përmbledhja e ditës kur ka lartësi", () => {
    const s = snap({ today: { feedings: 5, diapers: 4, sleepMin: 190 } });
    expect(render(s, 320, 260).texts).toContain("5 ushqime · 4 pelena · 3 orë 10 min gjumë");
    expect(render(s, 320, 190).texts.join(" ")).not.toContain("ushqime");
  });

  it("pa të dhëna: kërkon të hapet app-i", () => {
    expect(render(null, 300, 110).texts).toContain("Hape Bebix një herë që widget-i të marrë të dhënat.");
  });

  it("gjumi në ecje: butoni bëhet 'U zgjua'", () => {
    expect(render(snap({ sleep: { id: "s", since: at(13).toISOString() } }), 300, 110).texts).toContain("U zgjua");
  });
});

describe("pamja: ushqimi i fundit dhe dita e sotme", () => {
  it("ilaçi dhe uji s'janë 'ushqimi i fundit', as s'numërohen si ushqime", () => {
    const s = buildSnapshot({
      ...base,
      feedingLog: [feed("a", at(9), "bottle"), feed("b", at(11), "medicine"), feed("c", at(12), "water"), feed("d", at(8, 0, 9), "breast")],
    });
    expect(s.feeding).toEqual({ at: at(9).toISOString(), type: "bottle" });
    expect(s.today?.feedings).toBe(1);
  });

  it("gjumi numërohet vetëm pjesa e sotme; pelenat e djeshme s'hyjnë", () => {
    const s = buildSnapshot({
      ...base,
      diaperLog: [diaper("x", at(10)), diaper("y", at(23, 0, 9))],
      sleepLog: [sleep("n", at(22, 0, 9), at(6)), sleep("m", at(13, 30), null)],
    });
    expect(s.today).toEqual({ feedings: 0, diapers: 1, sleepMin: 6 * 60 + 30 });
  });

  it("kohëzgjatja e shkurtër", () => {
    expect(durationShort("sq", 45)).toBe("45 min");
    expect(durationShort("sq", 120)).toBe("2 orë");
    expect(durationShort("sq", 190)).toBe("3 orë 10 min");
    expect(durationShort("en", 190)).toBe("3h 10m");
    expect(durationShort("en", 0)).toBe("0m");
  });
});
