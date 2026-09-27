import { dayKeyOf, dayMarks, groupByDay, monthCells, weekDays, type DiaryEntry } from "@/lib/baby/diary";

const key = (d: Date | null) => (d ? dayKeyOf(d.getTime()) : null);
const at = (day: number, hour: number) => new Date(2026, 8, day, hour).getTime();
const entry = (id: string, kind: DiaryEntry["kind"], ms: number, minutes?: number): DiaryEntry => ({
  id,
  kind,
  title: kind,
  detail: "",
  at: ms,
  icon: "spoon",
  tint: "olive",
  minutes,
});

describe("monthCells", () => {
  it("shtatori 2026 nis të martën, pas një qelize bosh", () => {
    const cells = monthCells(2026, 8);
    expect(cells).toHaveLength(35);
    expect(cells[0]).toBeNull();
    expect(key(cells[1])).toBe("2026-09-01");
    expect(cells.filter(Boolean)).toHaveLength(30);
  });

  it("shkurti 2026 nis të dielën: 6 bosh, 28 ditë, rrjetë e plotë", () => {
    const cells = monthCells(2026, 1);
    expect(cells.slice(0, 6).every((c) => c === null)).toBe(true);
    expect(cells.filter(Boolean)).toHaveLength(28);
    expect(cells.length % 7).toBe(0);
  });

  it("ndërrimi i orës në mars nuk dyfishon e as humb ditë", () => {
    expect(new Set(monthCells(2026, 2).filter(Boolean).map(key)).size).toBe(31);
  });
});

describe("weekDays", () => {
  it("java nis të hënën", () => {
    expect(weekDays(new Date(2026, 8, 26, 15)).map(key)).toEqual([
      "2026-09-21", "2026-09-22", "2026-09-23", "2026-09-24", "2026-09-25", "2026-09-26", "2026-09-27",
    ]);
  });

  it("e diela i përket javës që nis të hënën para saj", () => {
    expect(key(weekDays(new Date(2026, 8, 27))[0])).toBe("2026-09-21");
  });

  it("java kalon nga shtatori në tetor", () => {
    expect(key(weekDays(new Date(2026, 9, 1))[0])).toBe("2026-09-28");
  });
});

describe("dayMarks", () => {
  const marks = dayMarks(
    groupByDay([entry("1", "feeding", at(25, 8)), entry("2", "sleep", at(25, 9), 60), entry("3", "vaccine", at(24, 11))])
  );

  it("shënon çfarë u regjistrua çdo ditë", () => {
    expect(marks.get("2026-09-25")).toEqual({ feeding: true, sleep: true, diaper: false, special: false, count: 2 });
  });

  it("vaksina del si ngjarje e veçantë", () => {
    expect(marks.get("2026-09-24")?.special).toBe(true);
  });

  it("dita pa shënime s'ka shenja", () => {
    expect(marks.get("2026-09-23")).toBeUndefined();
  });
});
