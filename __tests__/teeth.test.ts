import { ALL_TEETH, dueNow, eruptedTeeth, jawRow, lateFirstTooth, toothCodeOf, toothEventId, type ToothCode } from "@/lib/baby/teeth";
import { hasFeature } from "@/lib/age/stageConfig";
import { translations } from "@/lib/i18n/translations";
import type { TimelineEvent } from "@/lib/state/babyTypes";

const ev = (id: string, date: string, extra: Partial<TimelineEvent> = {}): TimelineEvent => ({
  id, title: "x", date, color: "olive", note: "", createdAt: date, updatedAt: date, editCount: 0, deletedAt: null, archivedAt: null, ...extra,
});

describe("dhëmbët e qumështit", () => {
  it("20 dhëmbë, harku nga ana e djathtë e bebit te e majta", () => {
    expect(new Set(ALL_TEETH).size).toBe(20);
    expect(jawRow("U")).toEqual(["UR5", "UR4", "UR3", "UR2", "UR1", "UL1", "UL2", "UL3", "UL4", "UL5"]);
  });

  it("id-ja e ngjarjes mban kodin dhe është unike", () => {
    const a = toothEventId("LR1");
    const b = toothEventId("LR1");
    expect(a).not.toBe(b);
    expect(toothCodeOf(a)).toBe("LR1");
    expect(toothCodeOf("abc123")).toBeNull();
  });

  it("lexon dhëmbët nga historiku, pa të fshirat dhe pa ngjarjet e tjera", () => {
    const map = eruptedTeeth([
      ev("tooth-LR1-a", "2026-05-01"),
      ev("tooth-LL1-b", "2026-05-20"),
      ev("tooth-UR1-c", "2026-07-01", { deletedAt: "2026-07-02" }),
      ev("x1", "2026-06-01"),
    ]);
    expect([...map.keys()]).toEqual(["LR1", "LL1"]);
  });

  it("në 7 muaj: zakonisht dalin incizivët qendrorë të poshtëm", () => {
    expect(dueNow(new Set(), 7)).toEqual(["LR1"]);
  });

  it("në 11 muaj, me dy të poshtmit: vijnë të sipërmit dhe anësorët, një për palë", () => {
    const due = dueNow(new Set<ToothCode>(["LR1", "LL1"]), 11);
    expect(due).toEqual(["UR1", "UR2", "LR2"]);
  });

  it("pa moshë s'sugjeron asgjë; 18 muaj pa dhëmbë: pyet mjekun", () => {
    expect(dueNow(new Set(), null)).toEqual([]);
    expect(lateFirstTooth(0, 18)).toBe(true);
    expect(lateFirstTooth(1, 20)).toBe(false);
    expect(lateFirstTooth(0, 12)).toBe(false);
  });

  it("dalin te foshnja dhe te fëmija i vogël, jo te shtatzënia", () => {
    expect(hasFeature("infant", "teeth")).toBe(true);
    expect(hasFeature("toddler", "teeth")).toBe(true);
    expect(hasFeature("pregnancy", "teeth")).toBe(false);
  });

  it("emrat e pozicioneve në të dyja gjuhët", () => {
    for (const p of [1, 2, 3, 4, 5]) {
      const k = `teeth_pos_${p}` as keyof typeof translations.sq;
      expect(translations.sq[k]).toBeTruthy();
      expect(translations.en[k as keyof typeof translations.en]).toBeTruthy();
    }
  });
});
