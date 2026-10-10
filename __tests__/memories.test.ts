import { buildMonthRecap, monthKeyOf, onThisDay, parseMonthKey, recapMonthToShow } from "@/lib/baby/memories";
import { buildFirstYearBook, buildFirstYearBookHtml, PHOTOS_PER_MONTH } from "@/lib/firstYearBook";
import { daysUntil, defaultUnlockDate, isUnlocked, isValidUnlockDate } from "@/lib/baby/timeCapsule";
import { initialBabyState, type BabyModuleState, type Moment } from "@/lib/state/babyTypes";
import { initialAppState } from "@/lib/state/types";

jest.mock("@/lib/supabase/client", () => ({ supabase: {} }));

const life = { createdAt: "", updatedAt: "", editCount: 0, deletedAt: null as string | null, archivedAt: null as string | null };
let n = 0;
const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h).toISOString();
const moment = (date: string, over: Partial<Moment> = {}): Moment =>
  ({ ...life, id: `m${n++}`, type: "photo", uri: "file:///p.jpg", storagePath: null, title: "", description: "", date, tags: [], favorite: false, ...over }) as Moment;
const baby = (over: Partial<BabyModuleState>): BabyModuleState => ({ ...initialBabyState, ...over });

describe("kujtimet: sot para…", () => {
  const now = new Date(2026, 9, 10, 9);

  it("gjen momentet e 1 muaji, 6 muajsh dhe 1 viti më parë — më të vjetrat para", () => {
    const list = [moment(at(2026, 9, 10)), moment(at(2026, 4, 10)), moment(at(2025, 10, 10)), moment(at(2026, 9, 11))];
    expect(onThisDay(list, now).map((g) => [g.ago.months, g.moments.length])).toEqual([[12, 1], [6, 1], [1, 1]]);
  });

  it("e preferuara del e para; të fshirat jo", () => {
    const a = moment(at(2026, 9, 10));
    const b = moment(at(2026, 9, 10), { favorite: true });
    const c = moment(at(2026, 9, 10), { deletedAt: "x" });
    expect(onThisDay([a, b, c], now)[0].moments.map((m) => m.id)).toEqual([b.id, a.id]);
  });

  it("fundi i muajit: 28 mars ↔ 28 shkurt; më 28 shkurt dalin edhe kujtimet e 29–31 janarit", () => {
    expect(onThisDay([moment(at(2026, 2, 28))], new Date(2026, 2, 28)).length).toBe(1);
    expect(onThisDay([moment(at(2026, 1, 30))], new Date(2026, 1, 28))[0].ago.months).toBe(1);
  });
});

describe("filmi i muajit", () => {
  const b = baby({
    moments: [moment(at(2026, 9, 3)), moment(at(2026, 9, 20), { favorite: true }), moment(at(2026, 9, 5), { type: "milestone", title: "Buzëqeshja e parë" }), moment(at(2026, 10, 1))],
    timeline: [{ ...life, id: "t1", title: "Vizita e parë", date: at(2026, 9, 1), color: "olive", note: "" }],
    feedingLog: [
      { ...life, id: "f1", type: "bottle", amountMl: 90, durationMin: null, side: null, foodCategory: null, at: at(2026, 9, 2), note: "" },
      { ...life, id: "f2", type: "medicine", amountMl: null, durationMin: null, side: null, foodCategory: null, at: at(2026, 9, 2), note: "" },
    ],
    growthHistory: [
      { ...life, id: "g1", date: at(2026, 9, 1), weightKg: 5.2, heightCm: 58, headCm: null, note: "" },
      { ...life, id: "g2", date: at(2026, 9, 28), weightKg: 6.05, heightCm: 60.5, headCm: null, note: "" },
    ],
  });

  it("fotot (e preferuara para), arritjet dhe numrat e muajit", () => {
    const r = buildMonthRecap(b, "2026-09")!;
    expect(r.photos.map((p) => p.date)).toEqual([at(2026, 9, 20), at(2026, 9, 3)]);
    expect(r.milestones.map((m) => m.title)).toEqual(["Vizita e parë", "Buzëqeshja e parë"]);
    expect(r.feedings).toBe(1);
    expect(r.weightGainKg).toBe(0.85);
    expect(r.heightGainCm).toBe(2.5);
  });

  it("çelësi i muajit", () => {
    expect(monthKeyOf(new Date(2026, 8, 15))).toBe("2026-09");
    expect(parseMonthKey("2026-13")).toBeNull();
    expect(parseMonthKey("x")).toBeNull();
    expect(buildMonthRecap(b, "jo")).toBeNull();
  });

  it("karta del 1–7 të muajit vetëm kur ka çfarë të tregojë", () => {
    expect(recapMonthToShow(b, new Date(2026, 9, 3))?.month).toBe("2026-09");
    expect(recapMonthToShow(b, new Date(2026, 9, 8))).toBeNull();
    expect(recapMonthToShow(baby({}), new Date(2026, 9, 3))).toBeNull();
  });
});

describe("libri i vitit të parë", () => {
  const profile = { ...initialAppState.profile, babyName: "Ana", babyDob: "2025-10-10" };

  it("12 muaj nga lindja, deri në 3 foto në muaj, me arritjet", () => {
    const moments = [
      ...Array.from({ length: 5 }, (_, i) => moment(at(2025, 10, 12 + i), { favorite: i === 4 })),
      moment(at(2025, 12, 1), { type: "milestone", title: "U kthye vetë" }),
      moment(at(2026, 11, 1)), // pas vitit të parë
    ];
    const book = buildFirstYearBook(profile, baby({ moments }), new Date(2026, 9, 10));
    expect(book.months).toHaveLength(12);
    expect(book.months[0].photos).toHaveLength(PHOTOS_PER_MONTH);
    expect(book.months[0].photos[0].favorite).toBe(true);
    expect(book.months[1].milestones).toEqual(["U kthye vetë"]);
    expect(book.totalPhotos).toBe(3);
  });

  it("bebi më i vogël se 1 vjeç: vetëm muajt që kanë kaluar", () => {
    const book = buildFirstYearBook({ ...profile, babyDob: "2026-07-01" }, baby({}), new Date(2026, 9, 10));
    expect(book.months.map((m) => m.index)).toEqual([1, 2, 3, 4]);
  });

  it("HTML: emri i mbrojtur, fotot vetëm kur kanë adresë", () => {
    const m = moment(at(2025, 10, 12), { title: "<b>gjumi</b>" });
    const book = buildFirstYearBook({ ...profile, babyName: "Ana <3" }, baby({ moments: [m] }), new Date(2026, 9, 10));
    const html = buildFirstYearBookHtml(book, "sq", { [m.id]: "data:image/jpeg;base64,AAA" });
    expect(html).toContain("Ana &lt;3");
    expect(html).toContain("&lt;b&gt;gjumi&lt;/b&gt;");
    expect(html).toContain("data:image/jpeg;base64,AAA");
    expect(buildFirstYearBookHtml(book, "en", {})).not.toContain("<img");
  });
});

describe("kapsula e kohës", () => {
  const now = new Date(2026, 9, 10, 12);

  it("parazgjedhja: ditëlindja e 18-të", () => {
    expect(defaultUnlockDate("2026-03-15", now)).toBe("2044-03-15");
    expect(defaultUnlockDate(null, now)).toBe("2044-10-10");
  });

  it("e vulosur deri në datë; hapet atë ditë", () => {
    expect(isUnlocked("2026-10-11", now)).toBe(false);
    expect(isUnlocked("2026-10-10", now)).toBe(true);
    expect(daysUntil("2026-10-20", now)).toBe(10);
    expect(daysUntil("2026-10-01", now)).toBe(0);
  });

  it("data e lejuar: nga nesër deri në 30 vjet", () => {
    expect(isValidUnlockDate("2026-10-10", now)).toBe(false);
    expect(isValidUnlockDate("2026-10-11", now)).toBe(true);
    expect(isValidUnlockDate("2056-10-10", now)).toBe(true);
    expect(isValidUnlockDate("2056-10-11", now)).toBe(false);
    expect(isValidUnlockDate("jo", now)).toBe(false);
  });
});
