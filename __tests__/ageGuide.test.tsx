/**
 * Kreu sipas moshës (17 tetor): faza nga muajt e plotë, tekstet e fazës dhe vaksina e radhës.
 */
import { renderScreen, visibleText } from "./helpers/screen";
import { AgeGuideCard } from "@/components/baby/AgeGuideCard";
import { ageStage, fullMonths, isOverdue, nextVaccine } from "@/lib/baby/ageGuide";
import { translations } from "@/lib/i18n/translations";
import type { VaccineEntry } from "@/lib/state/babyTypes";

const NOW = new Date(2026, 9, 17, 12);
const life = { createdAt: "", updatedAt: "", editCount: 0, deletedAt: null as string | null, archivedAt: null as string | null };
const vac = (id: string, due: Date, given: Date | null = null, extra: Partial<VaccineEntry> = {}): VaccineEntry =>
  ({ ...life, id, name: `V${id}`, description: "", dueDate: due.toISOString(), givenDate: given?.toISOString() ?? null, doctor: "", clinic: "", batchNumber: "", note: "", reminderEnabled: true, ...extra }) as VaccineEntry;

describe("mosha dhe faza", () => {
  it("muaj të plotë: muaji mbushet në datën e lindjes", () => {
    expect(fullMonths(new Date(2026, 8, 17).toISOString(), NOW)).toBe(1);
    expect(fullMonths(new Date(2026, 8, 18).toISOString(), NOW)).toBe(0);
    expect(fullMonths(new Date(2026, 3, 17).toISOString(), NOW)).toBe(6);
    expect(fullMonths(null, NOW)).toBeNull();
    expect(fullMonths(new Date(2026, 11, 1).toISOString(), NOW)).toBeNull();
  });

  it("fazat: 0, 1–3, 3–6, 6–9, 9–12, 12–18, 18–24, 2–5 vjeç; pas 5 vjetësh asgjë", () => {
    expect([0, 1, 2, 3, 5, 6, 8, 9, 11, 12, 17, 18, 23, 24, 59, 60].map(ageStage)).toEqual([
      "m0", "m1", "m1", "m3", "m3", "m6", "m6", "m9", "m9", "m12", "m12", "m18", "m18", "m24", "m24", null,
    ]);
    expect(ageStage(null)).toBeNull();
  });

  it("çdo fazë ka tekstet në shqip dhe anglisht", () => {
    for (const stage of ["m0", "m1", "m3", "m6", "m9", "m12", "m18", "m24"]) {
      for (const lang of ["sq", "en"] as const) {
        const dict = translations[lang] as Record<string, string>;
        for (const part of ["dev", "feed", "sleep"]) expect(dict[`age_${stage}_${part}`]).toBeTruthy();
        expect(dict[`age_stage_${stage}`]).toBeTruthy();
      }
    }
  });

  it("vaksina e radhës: e para pa u bërë, pa të fshirat; vonesa vetëm pas ditës", () => {
    const list = [
      vac("a", new Date(2026, 9, 1), new Date(2026, 9, 1)),
      vac("b", new Date(2026, 10, 1)),
      vac("c", new Date(2026, 9, 10), null, { deletedAt: "x" }),
      vac("d", new Date(2026, 9, 15)),
    ];
    expect(nextVaccine(list, NOW)?.id).toBe("d");
    expect(isOverdue(list[3], NOW)).toBe(true);
    expect(isOverdue(vac("e", new Date(2026, 9, 17, 8)), NOW)).toBe(false);
    expect(nextVaccine([], NOW)).toBeNull();
  });
});

describe("karta te kreu", () => {
  it("6 muaj: ushqimet e para dhe vaksina e radhës", async () => {
    const dob = new Date(2026, 3, 10).toISOString();
    const r = await renderScreen(<AgeGuideCard babyDob={dob} vaccines={[vac("x", new Date(2026, 10, 2))]} now={NOW} />);
    const text = visibleText(r.root).join(" | ");
    expect(text).toContain("Në këtë moshë");
    expect(text).toContain("6–9 muaj");
    expect(text).toContain("Koha për ushqimet e para");
    expect(text).toContain("Vaksina e radhës");
    expect(text).toContain("Vx");
  });

  it("pa datë lindjeje: s'shfaqet", async () => {
    const r = await renderScreen(<AgeGuideCard babyDob={null} vaccines={[]} now={NOW} />);
    expect(visibleText(r.root)).toEqual([]);
  });
});
