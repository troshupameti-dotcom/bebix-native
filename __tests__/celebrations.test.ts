import { addMonths, ageCelebrations, milestoneCelebrations, nextCelebration } from "@/lib/baby/celebrations";
import type { Moment } from "@/lib/state/babyTypes";

const day = (y: number, m: number, d: number, h = 10) => new Date(y, m - 1, d, h);
const ids = (dob: string, now: Date) => ageCelebrations(dob, now).map((c) => c.id);

let n = 0;
const moment = (over: Partial<Moment>): Moment =>
  ({
    id: `m${n++}`, type: "milestone", uri: null, storagePath: null, title: "Hapi i parë", description: "", date: day(2026, 10, 10).toISOString(),
    tags: [], favorite: false, createdAt: day(2026, 10, 10).toISOString(), updatedAt: "", editCount: 0, deletedAt: null, archivedAt: null, ...over,
  }) as Moment;

describe("festimet e moshës", () => {
  it("çdo muaj në të njëjtën datë, me dritare 3-ditore", () => {
    expect(ids("2026-07-10", day(2026, 10, 10))).toEqual(["age:m3"]);
    expect(ids("2026-07-10", day(2026, 10, 12))).toEqual(["age:m3"]);
    expect(ids("2026-07-10", day(2026, 10, 13))).toEqual([]);
    expect(ids("2026-07-10", day(2026, 10, 9))).toEqual([]);
  });

  it("gjysmë viti, 1 vjeç, 2 vjeç; pas 2 vjetësh vetëm ditëlindjet", () => {
    expect(ids("2026-04-10", day(2026, 10, 10))).toEqual(["age:half"]);
    expect(ids("2025-10-10", day(2026, 10, 10))).toEqual(["age:y1"]);
    expect(ids("2024-10-10", day(2026, 10, 10))).toEqual(["age:y2"]);
    expect(ids("2024-07-10", day(2026, 10, 10))).toEqual([]); // 27 muaj: pa festim mujor
    expect(ids("2025-01-10", day(2026, 10, 10))).toEqual(["age:m21"]);
  });

  it("dita e 100-të", () => {
    expect(ids("2026-07-02", day(2026, 10, 10))).toEqual(["age:d100"]);
  });

  it("31 janar → muaji i parë bie më 28 shkurt; dritarja kalon në muajin tjetër", () => {
    expect(addMonths(day(2026, 1, 31), 1).getDate()).toBe(28);
    expect(ids("2026-01-31", day(2026, 2, 28))).toEqual(["age:m1"]);
    expect(ids("2026-08-30", day(2026, 10, 1))).toEqual(["age:m1"]); // 30 shtator + 1 ditë
  });

  it("pa datëlindje ose në të ardhmen: asgjë", () => {
    expect(ageCelebrations(null, day(2026, 10, 10))).toEqual([]);
    expect(ageCelebrations("2027-01-01", day(2026, 10, 10))).toEqual([]);
    expect(ids("2026-10-10", day(2026, 10, 10))).toEqual([]);
  });
});

describe("arritjet", () => {
  const now = day(2026, 10, 10, 18);

  it("arritja e re (nga cilido prind) festohet; e vjetër, e fshirë ose foto jo", () => {
    const fresh = moment({});
    const old = moment({ createdAt: day(2026, 10, 1).toISOString() });
    const imported = moment({ date: day(2026, 5, 1).toISOString() });
    const deleted = moment({ deletedAt: "x" });
    const photo = moment({ type: "photo" });
    const c = milestoneCelebrations([fresh, old, imported, deleted, photo], now);
    expect(c.map((x) => x.id)).toEqual([`ms:${fresh.id}`]);
    expect(c[0]).toMatchObject({ kind: "milestone", title: "Hapi i parë" });
  });

  it("një festim në një kohë; i pari i paparë, mosha para arritjeve", () => {
    const m = moment({});
    expect(nextCelebration("2026-07-10", [m], new Set(), now)?.id).toBe("age:m3");
    expect(nextCelebration("2026-07-10", [m], new Set(["age:m3"]), now)?.id).toBe(`ms:${m.id}`);
    expect(nextCelebration("2026-07-10", [m], new Set(["age:m3", `ms:${m.id}`]), now)).toBeNull();
  });
});
