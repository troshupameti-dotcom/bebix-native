import { DEFAULT_NIGHT, isNapAt, isNightSleep } from "@/lib/baby/sleepKind";

const at = (h: number, m = 0) => new Date(2026, 9, 10, h, m);

describe("gjumë nate apo sy gjumë", () => {
  it("19:00–07:00 është natë, pjesa tjetër sy gjumë", () => {
    expect(isNightSleep(at(19))).toBe(true);
    expect(isNightSleep(at(23, 30))).toBe(true);
    expect(isNightSleep(at(0))).toBe(true);
    expect(isNightSleep(at(6, 59))).toBe(true);
    expect(isNightSleep(at(7))).toBe(false);
    expect(isNightSleep(at(13))).toBe(false);
    expect(isNightSleep(at(18, 59))).toBe(false);
  });

  it("pranon edhe ISO string (ora lokale e telefonit)", () => {
    expect(isNightSleep(at(21).toISOString())).toBe(true);
    expect(isNapAt(at(10).toISOString())).toBe(true);
    expect(isNapAt("jo-datë")).toBe(true);
  });

  it("kufijtë mund të ndryshohen (cilësim i ardhshëm)", () => {
    const night = { startHour: 20, endHour: 6 };
    expect(isNightSleep(at(19, 30), night)).toBe(false);
    expect(isNightSleep(at(20), night)).toBe(true);
    expect(isNightSleep(at(6), night)).toBe(false);
    // dritare brenda së njëjtës ditë (p.sh. turn nate që s'kalon mesnatën)
    expect(isNightSleep(at(2), { startHour: 1, endHour: 5 })).toBe(true);
    expect(isNightSleep(at(23), { startHour: 1, endHour: 5 })).toBe(false);
    expect(DEFAULT_NIGHT).toEqual({ startHour: 19, endHour: 7 });
  });
});
