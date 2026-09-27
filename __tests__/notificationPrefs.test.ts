import { clampGap, migrateNotificationPrefs } from "@/lib/notifications/catalog";

describe("intervali i kujtesave", () => {
  it("mbahet brenda 1–12 orëve", () => {
    expect(clampGap(0)).toBe(1);
    expect(clampGap(20)).toBe(12);
    expect(clampGap(2.6)).toBe(3);
  });

  it("vlera e prishur ose që mungon bëhet 4 orë", () => {
    expect(clampGap(undefined)).toBe(4);
    expect(clampGap("5")).toBe(4);
    expect(clampGap(Number.NaN)).toBe(4);
  });

  it("instalimet e vjetra marrin 4 orë pa humbur zgjedhjet e tjera", () => {
    const prefs = migrateNotificationPrefs({ keys: { baby_feeding: false }, quietFrom: 23, quietTo: 6 });
    expect(prefs).toEqual({ keys: { baby_feeding: false }, quietFrom: 23, quietTo: 6, feedingGapH: 4, diaperGapH: 4 });
  });

  it("zgjedhja e ruajtur ruhet", () => {
    expect(migrateNotificationPrefs({ keys: {}, feedingGapH: 2, diaperGapH: 5 }).feedingGapH).toBe(2);
  });
});
