import {
  ageInMonths, ANSWER_MAX, BODY_MAX, canClose, cleanAnswer, cleanBody, errorKey, isMissingTable, matchesSpecialty, statusKey, waitingHours, waitingLabel,
} from "@/lib/community/expertQuestions";
import { expertAnswerItems } from "@/lib/notifications/inbox";
import { routeForNotification } from "@/lib/notifications/routing";
import { initialNotificationPrefs, NOTIFICATION_CATALOG } from "@/lib/notifications/catalog";
import { translations, type TranslationKey } from "@/lib/i18n/translations";

jest.mock("@/lib/supabase/client", () => ({ supabase: {} }));

const NOW = new Date("2026-10-14T12:00:00Z");
const t = (k: TranslationKey, p?: Record<string, string | number>) =>
  Object.entries(p ?? {}).reduce((s, [key, v]) => s.replace(`{${key}}`, String(v)), translations.sq[k] as string);

describe("pyet ekspertin: validimi", () => {
  it("pyetja: 20–600 shkronja pas pastrimit", () => {
    expect(cleanBody("shumë shkurt")).toBeNull();
    expect(cleanBody("  Bebi zgjohet çdo orë natën, a është normale?  ")).toBe("Bebi zgjohet çdo orë natën, a është normale?");
    expect(cleanBody("a".repeat(BODY_MAX))).toHaveLength(BODY_MAX);
    expect(cleanBody("a".repeat(BODY_MAX + 1))).toBeNull();
  });

  it("përgjigjja: 20–1500 shkronja", () => {
    expect(cleanAnswer("Po, normale.")).toBeNull();
    expect(cleanAnswer("  " + "a".repeat(20) + "  ")).toHaveLength(20);
    expect(cleanAnswer("a".repeat(ANSWER_MAX))).toHaveLength(ANSWER_MAX);
    expect(cleanAnswer("a".repeat(ANSWER_MAX + 1))).toBeNull();
  });

  it("statusi për prindin dhe mbyllja", () => {
    expect(statusKey("pending")).toBe("eq_status_pending");
    expect(statusKey("claimed")).toBe("eq_status_pending"); // i marrë nga eksperti = ende në pritje
    expect(statusKey("answered")).toBe("eq_status_answered");
    expect(statusKey("closed")).toBe("eq_status_closed");
    expect(canClose("pending") && canClose("claimed")).toBe(true);
    expect(canClose("answered") || canClose("closed")).toBe(false);
  });

  it("gabimet e bazës → tekste të qarta", () => {
    expect(errorKey(new Error("weekly_limit"))).toBe("eq_err_limit");
    expect(errorKey(new Error("claimed_by_other"))).toBe("eq_err_taken");
    expect(errorKey(new Error("already_answered"))).toBe("eq_err_taken");
    expect(errorKey(new Error("closed"))).toBe("eq_err_closed");
    expect(errorKey(new Error("rrjeti"))).toBe("eq_err_generic");
  });
});

describe("pyet ekspertin: reparti dhe mosha", () => {
  it("pyetja i përket vetëm repartit të ekspertit", () => {
    expect(matchesSpecialty("pediatrician", "pediatrician")).toBe(true);
    expect(matchesSpecialty("lactation", "pediatrician")).toBe(false);
    expect(matchesSpecialty("pediatrician", null)).toBe(false); // eksperti pa repart
  });

  it("mosha në muaj të plotë, pa datë kurrë", () => {
    const now = new Date(2026, 9, 14);
    expect(ageInMonths("2026-06-14", now)).toBe(4);
    expect(ageInMonths("2026-06-15", now)).toBe(3); // muaji i 4-t s'është mbushur
    expect(ageInMonths("2026-10-14", now)).toBe(0);
    expect(ageInMonths("2026-11-01", now)).toBeNull(); // në të ardhmen
    expect(ageInMonths(null, now)).toBeNull();
    expect(ageInMonths("jo-datë", now)).toBeNull();
  });
});

describe("pyet ekspertin: koha e pritjes", () => {
  it("orët dhe etiketa (tani / orë / ditë)", () => {
    expect(waitingHours("2026-10-14T09:30:00Z", NOW)).toBe(2);
    expect(waitingHours("2026-10-15T09:30:00Z", NOW)).toBe(0); // ora e ardhme s'jep negative
    expect(waitingLabel("2026-10-14T11:40:00Z", t, NOW)).toBe("tani");
    expect(waitingLabel("2026-10-14T07:00:00Z", t, NOW)).toBe("pret prej 5 orësh");
    expect(waitingLabel("2026-10-11T12:00:00Z", t, NOW)).toBe("pret prej 3 ditësh");
  });
});

describe("njoftimi i përgjigjes", () => {
  const answer = { id: "q1", answeredAt: "2026-10-14T10:00:00Z", expertName: "Dr. Besa" };

  it("del te Njoftimet në app dhe hap 'Pyetjet e mia'", () => {
    const [item] = expertAnswerItems([answer], initialNotificationPrefs, t);
    expect(item.id).toBe("expert:q1");
    expect(item.body).toContain("Dr. Besa");
    expect(item.route).toBe("/(main)/community/my-questions");
    expect(expertAnswerItems([{ ...answer, expertName: null }], initialNotificationPrefs, t)[0].body).toBe(t("inbox_expert_answer_body_plain"));
  });

  it("respekton cilësimin te Njoftimet", () => {
    const off = { ...initialNotificationPrefs, keys: { community_expert_answer: false } };
    expect(expertAnswerItems([answer], off, t)).toEqual([]);
    expect(NOTIFICATION_CATALOG.some((e) => e.key === "community_expert_answer")).toBe(true);
  });

  it("prekja e njoftimit nga serveri hap 'Pyetjet e mia'", () => {
    expect(routeForNotification({ type: "expert_answer", questionId: "x" })).toBe("/(main)/community/my-questions");
  });
});

describe("pa migrimin në server", () => {
  it("tabela që mungon njihet (butonat fshihen), gabimet e tjera jo", () => {
    expect(isMissingTable({ code: "PGRST205" })).toBe(true);
    expect(isMissingTable({ code: "42P01" })).toBe(true);
    expect(isMissingTable({ code: "42501" })).toBe(false);
    expect(isMissingTable(null)).toBe(false);
  });
});
