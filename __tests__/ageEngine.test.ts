/**
 * Motori i moshës dhe konfigurimi i fazave (sistemi i moshës, faza 1).
 */
import { ageInMonths, getAgeGroupKey, getStage, parseDate } from "@/lib/age/engine";
import { hasFeature, SPECIALTY_PRIORITY, specialtyRank, STAGE_FEATURES } from "@/lib/age/stageConfig";

const NOW = new Date(2026, 9, 17, 12);
/** Datëlindja që jep saktë `m` muaj të plotë sot. */
const born = (m: number) => {
  const d = new Date(NOW.getFullYear(), NOW.getMonth() - m, NOW.getDate());
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

describe("mosha në muaj", () => {
  it("muaji mbushet në datën e lindjes; data si datë lokale", () => {
    expect(ageInMonths("2026-09-17", NOW)).toBe(1);
    expect(ageInMonths("2026-09-18", NOW)).toBe(0);
    expect(ageInMonths(new Date(2025, 9, 17).toISOString(), NOW)).toBe(12);
    expect(parseDate("2025-09-20")?.getDate()).toBe(20);
  });

  it("pa datë, datë e pavlefshme ose në të ardhmen: null", () => {
    expect(ageInMonths(null, NOW)).toBeNull();
    expect(ageInMonths("jo-datë", NOW)).toBeNull();
    expect(ageInMonths("2027-01-01", NOW)).toBeNull();
  });
});

describe("faza", () => {
  it("kufijtë: 0–11 foshnjë, 12–35 i vogël, 36–155 fëmijë, 156+ arkiv", () => {
    const at = (m: number) => getStage({ birthDate: born(m) }, NOW);
    expect([0, 11, 12, 35, 36, 155, 156, 200].map(at)).toEqual([
      "infant", "infant", "toddler", "toddler", "child", "child", "archive", "archive",
    ]);
  });

  it("shtatzënia: datë e pritur pa datëlindje; datëlindja ka përparësi", () => {
    expect(getStage({ birthDate: null, dueDate: "2027-02-01" }, NOW)).toBe("pregnancy");
    expect(getStage({ birthDate: born(2), dueDate: "2027-02-01" }, NOW)).toBe("infant");
  });

  it("pa asnjë datë, ose datëlindje në të ardhmen: s'ka fazë (kreu neutral)", () => {
    expect(getStage({ birthDate: null }, NOW)).toBeNull();
    expect(getStage({ birthDate: "2027-01-01", dueDate: "2027-02-01" }, NOW)).toBeNull();
    expect(getStage(null, NOW)).toBeNull();
  });
});

describe("grupmosha e komunitetit", () => {
  it("çelësat në formatin e auto_key, edhe për moshat e reja (24–156 muaj)", () => {
    const key = (m: number) => getAgeGroupKey({ birthDate: born(m) }, NOW);
    expect([0, 2, 3, 5, 6, 11, 12, 23, 24, 35, 36, 71, 72, 119, 120, 155].map(key)).toEqual([
      "age:0-3", "age:0-3", "age:3-6", "age:3-6", "age:6-12", "age:6-12", "age:12-24", "age:12-24",
      "age:24-36", "age:24-36", "age:36-72", "age:36-72", "age:72-120", "age:72-120", "age:120-156", "age:120-156",
    ]);
  });

  it("shtatzënia ka grupin e vet; arkivi dhe pa datë: asnjë", () => {
    expect(getAgeGroupKey({ birthDate: null, dueDate: "2027-02-01" }, NOW)).toBe("pregnancy");
    expect(getAgeGroupKey({ birthDate: born(156) }, NOW)).toBeNull();
    expect(getAgeGroupKey({ birthDate: null }, NOW)).toBeNull();
  });
});

describe("konfigurimi i fazave", () => {
  it("tabela e vendimeve: trackers dhe javët e zhvillimit vetëm 0–35 muaj", () => {
    expect(["pregnancy", "infant", "toddler", "child"].map((s) => hasFeature(s as never, "trackers"))).toEqual([false, true, true, false]);
    expect(["pregnancy", "infant", "toddler", "child"].map((s) => hasFeature(s as never, "developmentWeeks"))).toEqual([false, true, true, false]);
    expect(["pregnancy", "infant", "toddler", "child"].map((s) => hasFeature(s as never, "vaccines"))).toEqual([false, true, true, true]);
    expect(["pregnancy", "infant", "toddler", "child"].map((s) => hasFeature(s as never, "pregnancyWeeks"))).toEqual([true, false, false, false]);
    for (const s of ["pregnancy", "infant", "toddler", "child"] as const) {
      expect(hasFeature(s, "shopRanking") && hasFeature(s, "communityAgeFeed") && hasFeature(s, "moments") && hasFeature(s, "medical")).toBe(true);
    }
  });

  it("arkivi: pa feed dhe pa rekomandime, por me rritjen, vaksinat dhe fotot", () => {
    expect(hasFeature("archive", "communityAgeFeed")).toBe(false);
    expect(hasFeature("archive", "shopRecommendations")).toBe(false);
    expect(hasFeature("archive", "growth") && hasFeature("archive", "vaccines") && hasFeature("archive", "moments")).toBe(true);
  });

  it("pa fëmijë/datë: s'i heq trackers që prindi përdor sot", () => {
    expect(hasFeature(null, "trackers")).toBe(true);
    expect(hasFeature(undefined, "shopRanking")).toBe(false);
  });

  it("ekspertët renditen sipas fazës; jashtë listës dalin pas, s'fshihen", () => {
    expect(specialtyRank("child", "psychologist")).toBe(0);
    expect(specialtyRank("child", "speech_therapist")).toBeLessThan(specialtyRank("child", "pediatrician"));
    expect(specialtyRank("child", "neonatologist")).toBe(SPECIALTY_PRIORITY.child.length);
    expect(specialtyRank("infant", "pediatrician")).toBe(0);
    expect(specialtyRank(null, "pediatrician")).toBe(0);
    expect(Object.keys(STAGE_FEATURES).sort()).toEqual(["archive", "child", "infant", "none", "pregnancy", "toddler"]);
  });
});
