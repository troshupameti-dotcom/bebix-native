import { ageText, buildHealthReportHtml } from "@/lib/healthReport";
import { initialBabyState, type BabyModuleState } from "@/lib/state/babyTypes";
import { emptyProfile } from "@/lib/state/types";

const NOW = new Date("2026-10-06T10:00:00Z");
const life = { createdAt: "2026-09-01T00:00:00Z", updatedAt: "2026-09-20T00:00:00Z", editCount: 0, deletedAt: null, archivedAt: null };

function baby(extra: Partial<BabyModuleState> = {}): BabyModuleState {
  return { ...initialBabyState, ...extra };
}

describe("raporti shëndetësor", () => {
  const profile = { ...emptyProfile, babyName: "Arbi", babyGender: "boy" as const, babyDob: "2025-07-06T00:00:00Z", bloodType: "A+" as const, allergies: "Qumësht lope", pediatrician: "Dr. Elezi", medicalNotes: "Asnjë" };

  it("ka profilin, alergjitë, gjininë, moshën e llogaritur dhe datën e gjenerimit", () => {
    const html = buildHealthReportHtml(profile, baby(), "sq", NOW);
    for (const s of ["Arbi", "Djalë", "A+", "Qumësht lope", "Dr. Elezi", "15 muajsh", "Gjeneruar më 6 tetor 2026"]) {
      expect(html).toContain(s);
    }
  });

  it("mosha ndjek datën e gjenerimit (nesër del e re)", () => {
    expect(ageText("2025-07-06T00:00:00Z", new Date("2026-10-05T10:00:00Z"), "sq")).toBe("14 muajsh");
    expect(ageText("2025-07-06T00:00:00Z", new Date("2026-10-06T10:00:00Z"), "sq")).toBe("15 muajsh");
    expect(ageText("2026-10-01T00:00:00Z", NOW, "sq")).toBe("5 ditësh");
    expect(ageText("2026-06-06T00:00:00Z", NOW, "en")).toBe("4 months old");
    expect(ageText("2024-04-06T00:00:00Z", NOW, "sq")).toBe("2 vjeç dhe 6 muajsh");
    expect(ageText("2024-10-06T00:00:00Z", NOW, "en")).toBe("2 years old");
    expect(ageText(null, NOW, "sq")).toBeNull();
    expect(ageText("2030-01-01T00:00:00Z", NOW, "sq")).toBeNull();
  });

  it("NUK përmban ushqyerje, pelena, gjumë apo momente", () => {
    const html = buildHealthReportHtml(
      profile,
      baby({
        feedingLog: [{ ...life, id: "f", type: "bottle", amountMl: 120, durationMin: null, side: null, foodCategory: null, at: "2026-10-05T08:00:00Z", note: "SHENIM_USHQIM" }],
        sleepLog: [{ ...life, id: "s", startAt: "2026-10-05T20:00:00Z", endAt: null, pausedIntervalsMin: 0, pausedAt: null, isNap: false, quality: null, note: "SHENIM_GJUM" }],
        diaperLog: [{ ...life, id: "d", type: "wet", color: null, consistency: null, at: "2026-10-05T09:00:00Z", note: "SHENIM_PELENE" }],
        moments: [{ ...life, id: "m", type: "note", uri: null, title: "MOMENT_TITULL", description: "", date: "2026-10-05T09:00:00Z", tags: [], favorite: false }],
      }),
      "sq",
      NOW
    );
    for (const s of ["SHENIM_USHQIM", "SHENIM_GJUM", "SHENIM_PELENE", "MOMENT_TITULL"]) expect(html).not.toContain(s);
  });

  it("rritja, vaksinat, kartela dhe kontaktet dalin; të fshirat dhe të arkivuarat jo; seksioni ka datën e përditësimit", () => {
    const html = buildHealthReportHtml(
      profile,
      baby({
        growthHistory: [
          { ...life, id: "g1", date: "2026-09-01T00:00:00Z", weightKg: 8.4, heightCm: 70, headCm: null, note: "" },
          { ...life, id: "g2", date: "2026-08-01T00:00:00Z", weightKg: 7.9, heightCm: 68, headCm: 44, note: "", deletedAt: "2026-08-02T00:00:00Z" },
        ],
        vaccines: [{ ...life, id: "v", name: "MMR", description: "", dueDate: "2026-11-01T00:00:00Z", givenDate: null, doctor: "", clinic: "QKMF", batchNumber: "", note: "", reminderEnabled: true }],
        medicalRecords: [
          { ...life, id: "r1", type: "temperature", title: "Ethe", value: "38.5", doctor: "", at: "2026-09-30T00:00:00Z", note: "", attachmentUri: null, pinned: false },
          { ...life, id: "r2", type: "symptom", title: "ARKIVUAR", value: "", doctor: "", at: "2026-09-29T00:00:00Z", note: "", attachmentUri: null, pinned: false, archivedAt: "2026-10-01T00:00:00Z" },
        ],
        emergencyContacts: [{ id: "c", name: "Nëna", relation: "Prind", phone: "+38344111222" }],
      }),
      "sq",
      NOW
    );
    expect(html).toContain("8.4 kg");
    expect(html).not.toContain("7.9 kg");
    expect(html).toContain("MMR");
    expect(html).toContain("QKMF");
    expect(html).toContain("Temperaturë");
    expect(html).toContain("38.5");
    expect(html).not.toContain("ARKIVUAR");
    expect(html).toContain("+38344111222");
    expect(html).toContain("Përditësuar: 20 shtator 2026");
  });

  it("escape-on HTML-in e shkruar nga prindi dhe punon në anglisht", () => {
    const html = buildHealthReportHtml({ ...profile, allergies: "<script>alert(1)</script>" }, baby(), "en", NOW);
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("Health report");
    expect(html).toContain("Boy");
  });

  it("katalogu mjekësor: madhësia e pelenës nuk del, të tjerat me vlerë po", () => {
    const html = buildHealthReportHtml(
      profile,
      baby({
        medicalActiveKeys: ["blood", "diaper_size", "birth_weight"],
        medicalInfo: initialBabyState.medicalInfo.map((m) => (m.key === "diaper_size" ? { ...m, value: "MADHESIA_3" } : m.key === "birth_weight" ? { ...m, value: "3.4 kg" } : m)),
      }),
      "sq",
      NOW
    );
    expect(html).not.toContain("MADHESIA_3");
    expect(html).toContain("3.4 kg");
  });
});

