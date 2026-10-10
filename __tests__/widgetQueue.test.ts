import { applyPending, DEBOUNCE_MS, enqueue, MAX_QUEUE, parseQueue, planDrain, resolveAction, type WidgetAction } from "@/lib/widgets/queue";
import { drainQueue, loadQueue, pushAction, QUEUE_KEY } from "@/lib/widgets/store";
import type { WidgetSnapshot } from "@/lib/widgets/snapshot";
import type { DiaperEntry, SleepEntry } from "@/lib/state/babyTypes";

const mockMem = new Map<string, string>();
jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(async (k: string) => mockMem.get(k) ?? null),
  setItem: jest.fn(async (k: string, v: string) => {
    mockMem.set(k, v);
  }),
  removeItem: jest.fn(async (k: string) => {
    mockMem.delete(k);
  }),
}));

const T0 = new Date("2026-10-10T12:00:00Z");
const after = (ms: number) => new Date(T0.getTime() + ms);
const snap = (over: Partial<WidgetSnapshot> = {}): WidgetSnapshot => ({
  v: 1, lang: "sq", babyName: null, feeding: null, diaper: null, sleep: null, lastWakeAt: null, breastSince: null, updatedAt: T0.toISOString(), ...over,
});
const life = { createdAt: "", updatedAt: "", editCount: 0, deletedAt: null, archivedAt: null };
const sleepEntry = (id: string, endAt: string | null): SleepEntry =>
  ({ ...life, id, startAt: "2026-10-10T10:00:00Z", endAt, pausedIntervalsMin: 0, pausedAt: null, isNap: true, quality: null, note: "" }) as SleepEntry;
const diaperEntry = (id: string): DiaperEntry =>
  ({ ...life, id, at: "2026-10-10T10:00:00Z", type: "wet", color: null, consistency: null, note: "" }) as DiaperEntry;

describe("radha e veprimeve të widget-it", () => {
  it("pelena ruhet me orën e prekjes", () => {
    expect(resolveAction({ kind: "diaper", type: "wet" }, snap(), [], T0, "a1")).toEqual({ id: "a1", at: T0.toISOString(), kind: "diaper", type: "wet" });
  });

  it("prekja e dyfishtë brenda pak sekondave injorohet; lloj tjetër ose më vonë jo", () => {
    const first = resolveAction({ kind: "diaper", type: "wet" }, snap(), [], T0, "a1")!;
    expect(resolveAction({ kind: "diaper", type: "wet" }, snap(), [first], after(800))).toBeNull();
    expect(resolveAction({ kind: "diaper", type: "dirty" }, snap(), [first], after(800))).not.toBeNull();
    expect(resolveAction({ kind: "diaper", type: "wet" }, snap(), [first], after(DEBOUNCE_MS + 1))).not.toBeNull();
  });

  it("gjumi: zgjuar → fle, fle → u zgjua (edhe kur nisja është ende në radhë)", () => {
    const start = resolveAction({ kind: "sleep_toggle" }, snap(), [], T0, "s1")!;
    expect(start).toMatchObject({ kind: "sleep_start", id: "s1" });
    const end = resolveAction({ kind: "sleep_toggle" }, snap(), [start], after(60_000), "s2")!;
    expect(end).toMatchObject({ kind: "sleep_end", sleepId: "s1" });
    const sleeping = snap({ sleep: { id: "app", since: T0.toISOString() } });
    expect(resolveAction({ kind: "sleep_toggle" }, sleeping, [], T0)).toMatchObject({ kind: "sleep_end", sleepId: "app" });
    // dy prekje radhazi s'e nisin dhe s'e mbyllin menjëherë
    expect(resolveAction({ kind: "sleep_toggle" }, snap(), [start], after(500))).toBeNull();
  });

  it("widget-i e tregon prekjen menjëherë, para se app-i ta zbrazë", () => {
    const q: WidgetAction[] = [
      { id: "a1", at: "2026-10-10T12:00:00Z", kind: "diaper", type: "dirty" },
      { id: "s1", at: "2026-10-10T12:01:00Z", kind: "sleep_start" },
    ];
    const v = applyPending(snap({ diaper: { at: "2026-10-10T09:00:00Z", type: "wet" } }), q)!;
    expect(v.diaper).toEqual({ at: "2026-10-10T12:00:00Z", type: "dirty" });
    expect(v.sleep).toEqual({ id: "s1", since: "2026-10-10T12:01:00Z" });
    const woke = applyPending(v, [{ id: "s2", at: "2026-10-10T13:00:00Z", kind: "sleep_end", sleepId: "s1" }])!;
    expect(woke.sleep).toBeNull();
    expect(woke.lastWakeAt).toBe("2026-10-10T13:00:00Z");
    expect(applyPending(null, q)).toBeNull();
  });

  it("zbrazja s'shton dy herë të njëjtin shënim", () => {
    const q: WidgetAction[] = [
      { id: "a1", at: "2026-10-10T12:00:00Z", kind: "diaper", type: "wet" },
      { id: "a1", at: "2026-10-10T12:00:00Z", kind: "diaper", type: "wet" },
      { id: "a2", at: "2026-10-10T12:05:00Z", kind: "diaper", type: "dirty" },
    ];
    expect(planDrain(q, { diaperLog: [diaperEntry("a2")], sleepLog: [] }).map((a) => a.id)).toEqual(["a1"]);
  });

  it("gjumi: s'niset i dyti, s'mbyllet ai që s'ekziston ose u mbyll", () => {
    const start: WidgetAction = { id: "s1", at: "2026-10-10T12:00:00Z", kind: "sleep_start" };
    const end: WidgetAction = { id: "s2", at: "2026-10-10T13:00:00Z", kind: "sleep_end", sleepId: "s1" };
    expect(planDrain([start, end], { diaperLog: [], sleepLog: [] }).map((a) => a.id)).toEqual(["s1", "s2"]);
    expect(planDrain([start], { diaperLog: [], sleepLog: [sleepEntry("x", null)] })).toEqual([]);
    expect(planDrain([end], { diaperLog: [], sleepLog: [] })).toEqual([]);
    expect(planDrain([end], { diaperLog: [], sleepLog: [sleepEntry("s1", "2026-10-10T12:30:00Z")] })).toEqual([]);
  });

  it("radha ka kufi dhe lexohet e sigurt", () => {
    let q: WidgetAction[] = [];
    for (let i = 0; i < MAX_QUEUE + 5; i++) q = enqueue(q, { id: `a${i}`, at: T0.toISOString(), kind: "diaper", type: "wet" });
    expect(q).toHaveLength(MAX_QUEUE);
    expect(q[0].id).toBe("a5");
    expect(parseQueue("{prishur")).toEqual([]);
    const mixed = [
      { id: "x", at: T0.toISOString(), kind: "diaper", type: "lart" },
      { id: "y", at: T0.toISOString(), kind: "sleep_start" },
    ];
    expect(parseQueue(JSON.stringify(mixed))).toHaveLength(1);
  });
});

describe("ruajtja e radhës (offline, pa app të hapur)", () => {
  beforeEach(() => mockMem.clear());

  it("prekjet ruhen dhe zbrazen vetëm një herë", async () => {
    await pushAction({ kind: "diaper", type: "wet" }, T0);
    await pushAction({ kind: "diaper", type: "wet" }, after(300)); // prekje e dyfishtë
    await pushAction({ kind: "sleep_toggle" }, after(5000));
    expect((await loadQueue()).map((a) => a.kind)).toEqual(["diaper", "sleep_start"]);

    const seen: WidgetAction[][] = [];
    expect(await drainQueue((q) => seen.push(q))).toBe(2);
    expect(mockMem.has(QUEUE_KEY)).toBe(false);
    expect(await drainQueue((q) => seen.push(q))).toBe(0);
    expect(seen).toHaveLength(1);
  });

  it("prekja gjatë zbrazjes s'humbet", async () => {
    await pushAction({ kind: "diaper", type: "wet" }, T0);
    const drained = drainQueue(() => undefined);
    const pushed = pushAction({ kind: "diaper", type: "dirty" }, after(10_000));
    await Promise.all([drained, pushed]);
    expect((await loadQueue()).map((a) => (a.kind === "diaper" ? a.type : a.kind))).toEqual(["dirty"]);
  });
});
