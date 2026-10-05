import { FALLBACK_SPECIALTIES, specialtyEmoji, specialtyLabel } from "@/lib/community/specialtyList";
import { sanitizeSearch } from "@/lib/community/feedFilters";

// Jest ka Node, por tsconfig-u i app-it s'ka tipet e Node-it: deklarohet vetëm ç'përdoret këtu.
declare const __dirname: string;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const fs = require("fs") as { readFileSync(file: string, encoding: string): string };
const MIGRATION = `${__dirname}/../supabase/migrations/20261005180000_community_specialties.sql`;

describe("repartet e mjekëve", () => {
  it("lista rezervë ka të njëjtët çelësa dhe emra si migrimi", () => {
    const sql = fs.readFileSync(MIGRATION, "utf8");
    const rows = [...sql.matchAll(/^\s*\('([a-z_]+)',\s+'([^']+)',\s+'([^']+)',\s+'([^']+)',\s+\d+\)/gm)].map((m) => ({
      key: m[1], label: m[2], labelEn: m[3], emoji: m[4],
    }));
    expect(rows.length).toBeGreaterThanOrEqual(20);
    expect(FALLBACK_SPECIALTIES.map((s) => s.key)).toEqual(rows.map((r) => r.key));
    expect(FALLBACK_SPECIALTIES.map((s) => [s.label, s.labelEn, s.emoji])).toEqual(rows.map((r) => [r.label, r.labelEn, r.emoji]));
  });

  it("çelësat janë unikë dhe përfshijnë repartet e kërkuara", () => {
    const keys = FALLBACK_SPECIALTIES.map((s) => s.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const key of ["pediatrician", "orthopedist", "gynecologist", "psychologist"]) expect(keys).toContain(key);
  });

  it("emri sipas gjuhës, null pa reparte, rezervë për çelës jashtë listës së bazës", () => {
    expect(specialtyLabel("pediatrician", "sq")).toBe("Pediatër");
    expect(specialtyLabel("pediatrician", "en")).toBe("Pediatrician");
    expect(specialtyLabel(null, "sq")).toBeNull();
    expect(specialtyLabel("nuk_ekziston", "sq")).toBeNull();
    // lista e bazës s'e ka çelësin (p.sh. admini e fshiu): ende del emri nga rezerva
    expect(specialtyLabel("orthopedist", "sq", [{ key: "pediatrician", label: "x", labelEn: "x", emoji: "x" }])).toBe("Ortoped");
    expect(specialtyEmoji("orthopedist")).toBe("🦴");
    expect(specialtyEmoji(null)).toBe("🩺");
  });
});

describe("kërkimi në rrjedhë", () => {
  it("heq karakteret që prishin filtrin e bazës", () => {
    expect(sanitizeSearch("  kolikat  ")).toBe("kolikat");
    expect(sanitizeSearch("a,b(c)d*e%f\"g\\h")).toBe("a b c d e f g h");
    expect(sanitizeSearch("   ")).toBe("");
    expect(sanitizeSearch("x".repeat(200))).toHaveLength(60);
  });
});
