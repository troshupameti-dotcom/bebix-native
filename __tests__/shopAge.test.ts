import { ageOverlapFilter, bandForMonths, formatAgeRange, monthsSince, parseAgeBand } from "../lib/shop/age";

describe("mosha në dyqan", () => {
  it("formaton intervalet", () => {
    expect(formatAgeRange(null, null, "sq")).toBeNull();
    expect(formatAgeRange(0, 6, "sq")).toBe("0–6 muaj");
    expect(formatAgeRange(6, null, "sq")).toBe("6+ muaj");
    expect(formatAgeRange(null, 12, "sq")).toBe("Deri në 12 muaj");
    expect(formatAgeRange(24, 48, "sq")).toBe("2–4 vjeç");
    expect(formatAgeRange(6, 36, "en")).toBe("6 mo–3 yrs");
  });

  it("gjen grupmoshën e bebit", () => {
    expect(bandForMonths(0)?.key).toBe("0-3");
    expect(bandForMonths(3)?.key).toBe("3-6");
    expect(bandForMonths(11)?.key).toBe("6-12");
    expect(bandForMonths(30)?.key).toBe("24-48");
    expect(bandForMonths(60)).toBeNull();
    expect(bandForMonths(null)).toBeNull();
    expect(bandForMonths(-1)).toBeNull();
  });

  it("numëron muajt e plotë nga data e lindjes", () => {
    const now = new Date(2026, 9, 3);
    expect(monthsSince("2026-10-01", now)).toBe(0);
    expect(monthsSince("2026-06-04", now)).toBe(3);
    expect(monthsSince("2026-06-03", now)).toBe(4);
    expect(monthsSince("2027-01-01", now)).toBeNull();
    expect(monthsSince("jo-date", now)).toBeNull();
    expect(monthsSince(null, now)).toBeNull();
  });

  it("filtri përfshin produktet pa kufij dhe ato që mbivendosen", () => {
    const band = parseAgeBand("3-6")!;
    const f = ageOverlapFilter(band);
    expect(f).toContain("and(min_age_months.is.null,max_age_months.is.null)");
    expect(f).toContain("min_age_months.lte.6");
    expect(f).toContain("max_age_months.gte.3");
    expect(parseAgeBand("x")).toBeNull();
  });
});
