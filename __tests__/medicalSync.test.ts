import { applyProfileToMedical, parseBloodType } from "@/lib/baby/medicalSync";
import { medicalCatalog } from "@/lib/state/babyTypes";

describe("cilësimet → info mjekësore", () => {
  it("vlerat dalin te rreshtat dhe rreshtat me vlerë shfaqen", () => {
    const { medicalInfo, medicalActiveKeys } = applyProfileToMedical(medicalCatalog, ["blood"], {
      bloodType: "A+",
      pediatrician: "Dr. Krasniqi",
      allergies: "",
    });
    expect(medicalInfo.find((m) => m.key === "blood")?.value).toBe("A+");
    expect(medicalInfo.find((m) => m.key === "doctor")?.value).toBe("Dr. Krasniqi");
    expect(medicalActiveKeys).toEqual(["blood", "doctor"]);
  });

  it("vlera bosh s'e fsheh rreshtin që ishte i shfaqur", () => {
    const { medicalActiveKeys } = applyProfileToMedical(medicalCatalog, ["blood", "doctor"], {
      bloodType: null,
      pediatrician: "",
      allergies: "",
    });
    expect(medicalActiveKeys).toEqual(["blood", "doctor"]);
  });

  it("shton rreshtin kur mungon fare te lista", () => {
    const { medicalInfo } = applyProfileToMedical([], [], { bloodType: "0-", pediatrician: "", allergies: "Qumësht" });
    expect(medicalInfo.map((m) => m.key).sort()).toEqual(["allergies", "blood", "doctor"]);
  });
});

describe("grupi i gjakut nga teksti", () => {
  it("njeh shkrimet e zakonshme", () => {
    expect(parseBloodType("a+")).toBe("A+");
    expect(parseBloodType("O-")).toBe("0-");
    expect(parseBloodType("ab+")).toBe("AB+");
  });
  it("bosh = pa grup, e panjohur = s'ndryshon", () => {
    expect(parseBloodType("")).toBeNull();
    expect(parseBloodType("xyz")).toBeUndefined();
  });
});
