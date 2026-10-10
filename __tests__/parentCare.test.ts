import { dayKey, mergeCheckins, needsSupport, recentDays, shouldAsk, tipKeyFor, type CheckIn } from "@/lib/parent/checkin";
import { cacheCovers, weekOfLife } from "@/lib/parent/development";
import { checkupReminderDate, postpartumWeek, weekTipKey } from "@/lib/parent/postpartum";
import { translations } from "@/lib/i18n/translations";

jest.mock("@react-native-async-storage/async-storage", () => ({ getItem: jest.fn(async () => null), setItem: jest.fn(), removeItem: jest.fn() }));
jest.mock("@/lib/supabase/client", () => ({ supabase: {} }));

const NOW = new Date(2026, 9, 10, 12);
const day = (n: number) => dayKey(new Date(2026, 9, 10 - n));
const ci = (n: number, mood: CheckIn["mood"], over: Partial<CheckIn> = {}): CheckIn => ({ day: day(n), mood, note: null, updatedAt: `${day(n)}T10:00:00Z`, synced: true, ...over });

describe("si je sot?", () => {
  it("këshilla sipas notës, ekziston në të dyja gjuhët", () => {
    expect(tipKeyFor(5, day(0))).toBe("ci_tip_high");
    expect(tipKeyFor(3, day(0))).toBe("ci_tip_mid");
    expect(tipKeyFor(1, day(0))).toMatch(/^ci_tip_low_[123]$/);
    for (let n = 0; n < 3; n++) {
      const k = tipKeyFor(2, day(n));
      expect(translations.sq[k]).toBeTruthy();
      expect(translations.en[k]).toBeTruthy();
    }
  });

  it("ndihma del pas 3 ditësh të rënda në një javë — jo pas një dite të keqe", () => {
    expect(needsSupport([ci(0, 1)], NOW)).toBe(false);
    expect(needsSupport([ci(0, 1), ci(2, 2), ci(5, 1)], NOW)).toBe(true);
    expect(needsSupport([ci(0, 1), ci(2, 2), ci(8, 1)], NOW)).toBe(false); // e treta jashtë javës
    expect(needsSupport([ci(0, 3), ci(1, 3), ci(2, 3)], NOW)).toBe(false);
  });

  it("pyetja: një herë në ditë, jo pas 'Jo sot', jo kur është fikur", () => {
    const prefs = { enabled: true, skippedDay: null };
    expect(shouldAsk(prefs, [], NOW)).toBe(true);
    expect(shouldAsk(prefs, [ci(0, 4)], NOW)).toBe(false);
    expect(shouldAsk(prefs, [ci(1, 4)], NOW)).toBe(true);
    expect(shouldAsk({ ...prefs, skippedDay: day(0) }, [], NOW)).toBe(false);
    expect(shouldAsk({ enabled: false, skippedDay: null }, [], NOW)).toBe(false);
  });

  it("dy javët e fundit, me ditët bosh", () => {
    const d = recentDays([ci(0, 4), ci(3, 2)], NOW);
    expect(d).toHaveLength(14);
    expect(d[13]).toEqual({ day: day(0), mood: 4 });
    expect(d[10]).toEqual({ day: day(3), mood: 2 });
    expect(d[12].mood).toBeNull();
  });

  it("shkrirja me serverin: fiton më i riu, i padërguari s'humbet", () => {
    const local = [ci(0, 2, { synced: false, updatedAt: "2026-10-10T11:00:00Z" }), ci(1, 3)];
    const remote = [ci(0, 5, { updatedAt: "2026-10-10T09:00:00Z" }), ci(1, 4, { updatedAt: "2026-10-09T12:00:00Z" }), ci(2, 1)];
    const merged = mergeCheckins(local, remote);
    expect(merged.map((c) => [c.day, c.mood])).toEqual([[day(2), 1], [day(1), 4], [day(0), 2]]);
    expect(merged.find((c) => c.day === day(0))?.synced).toBe(false);
  });
});

describe("kalendari i zhvillimit", () => {
  it("java e jetës nga datëlindja", () => {
    expect(weekOfLife("2026-10-10", NOW)).toBe(0);
    expect(weekOfLife("2026-10-03", NOW)).toBe(1);
    expect(weekOfLife("2026-07-10", NOW)).toBe(13);
    expect(weekOfLife(null, NOW)).toBeNull();
    expect(weekOfLife("2026-12-01", NOW)).toBeNull();
  });

  it("kujtesa vlen për periudhën dhe për një ditë", () => {
    const c = { weekFrom: 12, weekTo: 15, title: "", body: "", ideas: [], fetchedAt: 1_000 };
    expect(cacheCovers(c, 13, 2_000)).toBe(true);
    expect(cacheCovers(c, 16, 2_000)).toBe(false);
    expect(cacheCovers(c, 13, 1_000 + 86_400_001)).toBe(false);
    expect(cacheCovers(null, 13)).toBe(false);
  });
});

describe("pas lindjes", () => {
  it("vetëm për mamin, javët 1–12", () => {
    expect(postpartumWeek("2026-10-08", "mom", NOW)).toBe(1);
    expect(postpartumWeek("2026-08-01", "mom", NOW)).toBe(11); // 70 ditë = java e 11-të
    expect(postpartumWeek("2026-07-01", "mom", NOW)).toBeNull();
    expect(postpartumWeek("2026-10-08", "dad", NOW)).toBeNull();
    expect(postpartumWeek(null, "mom", NOW)).toBeNull();
  });

  it("çdo javë ka këshillën e vet në sq dhe en", () => {
    for (let w = 1; w <= 12; w++) {
      expect(translations.sq[weekTipKey(w)]).toBeTruthy();
      expect(translations.en[weekTipKey(w)]).toBeTruthy();
    }
  });

  it("kujtesa e kontrollit: një ditë para javës së 6-të, në 10:00; s'ka kur ka kaluar", () => {
    const d = checkupReminderDate("2026-10-01", NOW)!;
    expect([d.getMonth(), d.getDate(), d.getHours()]).toEqual([10, 11, 10]);
    expect(checkupReminderDate("2026-07-01", NOW)).toBeNull();
  });
});
