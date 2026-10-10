import { BODY_MAX, categoryKey, cleanBody, errorKey, remainingThisWeek, statusKey, waitingHours, CATEGORIES } from "@/lib/community/expertQuestions";
import { translations } from "@/lib/i18n/translations";

jest.mock("@/lib/supabase/client", () => ({ supabase: {} }));

const NOW = new Date("2026-10-14T12:00:00Z");

describe("pyet ekspertin", () => {
  it("pyetja: 20–600 shkronja pas pastrimit", () => {
    expect(cleanBody("shumë shkurt")).toBeNull();
    expect(cleanBody("  Bebi zgjohet çdo orë natën, a është normale?  ")).toBe("Bebi zgjohet çdo orë natën, a është normale?");
    expect(cleanBody("a".repeat(BODY_MAX))).toHaveLength(BODY_MAX);
    expect(cleanBody("a".repeat(BODY_MAX + 1))).toBeNull();
  });

  it("statusi për prindin: i marrë nga eksperti = ende 'Në pritje'", () => {
    expect(statusKey("pending")).toBe("eq_status_pending");
    expect(statusKey("claimed")).toBe("eq_status_pending");
    expect(statusKey("answered")).toBe("eq_status_answered");
  });

  it("limiti javor: 3 në 7 ditët e fundit", () => {
    expect(remainingThisWeek([], NOW)).toBe(3);
    expect(remainingThisWeek(["2026-10-13T10:00:00Z", "2026-10-10T10:00:00Z"], NOW)).toBe(1);
    expect(remainingThisWeek(["2026-10-13T10:00:00Z", "2026-10-12T10:00:00Z", "2026-10-11T10:00:00Z"], NOW)).toBe(0);
    expect(remainingThisWeek(["2026-10-06T10:00:00Z"], NOW)).toBe(3); // më shumë se 7 ditë
  });

  it("koha e pritjes dhe gabimet e bazës", () => {
    expect(waitingHours("2026-10-14T09:30:00Z", NOW)).toBe(2);
    expect(waitingHours("2026-10-15T09:30:00Z", NOW)).toBe(0);
    expect(errorKey(new Error("weekly_limit"))).toBe("eq_err_limit");
    expect(errorKey(new Error("claimed_by_other"))).toBe("eq_err_taken");
    expect(errorKey(new Error("rrjeti"))).toBe("eq_err_generic");
  });

  it("çdo kategori ka emër në sq dhe en", () => {
    for (const c of CATEGORIES) {
      expect(translations.sq[categoryKey(c)]).toBeTruthy();
      expect(translations.en[categoryKey(c)]).toBeTruthy();
    }
    expect(categoryKey("panjohur")).toBe("eq_cat_other");
  });
});
