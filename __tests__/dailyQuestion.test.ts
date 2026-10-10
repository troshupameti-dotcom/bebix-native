import { ANSWER_MAX, cleanAnswer, localDateKey, questionText } from "@/lib/community/dailyQuestion";

jest.mock("@/lib/supabase/client", () => ({ supabase: {} }));
jest.mock("@/lib/communityData", () => ({ expertsByUserId: jest.fn(), fetchBlockedUserIds: jest.fn(), getCurrentUserId: jest.fn() }));

describe("pyetja e ditës", () => {
  it("data lokale e telefonit (pyetja ndryshon në mesnatën e prindit)", () => {
    expect(localDateKey(new Date(2026, 9, 13, 0, 5))).toBe("2026-10-13");
    expect(localDateKey(new Date(2026, 0, 2, 23, 59))).toBe("2026-01-02");
  });

  it("teksti në gjuhën e app-it; pa anglisht, shqip", () => {
    const row = { text_sq: " Si fle bebi? ", text_en: "How does baby sleep?" };
    expect(questionText(row, "sq")).toBe("Si fle bebi?");
    expect(questionText(row, "en")).toBe("How does baby sleep?");
    expect(questionText({ text_sq: "Si fle bebi?", text_en: null }, "en")).toBe("Si fle bebi?");
    expect(questionText({ text_sq: "Si fle bebi?", text_en: "  " }, "en")).toBe("Si fle bebi?");
  });

  it("përgjigja: 1–280 shkronja, hapësirat pastrohen", () => {
    expect(cleanAnswer("  Banjë   e ngrohtë  ")).toBe("Banjë e ngrohtë");
    expect(cleanAnswer("   ")).toBeNull();
    expect(cleanAnswer("a".repeat(ANSWER_MAX))).toHaveLength(ANSWER_MAX);
    expect(cleanAnswer("a".repeat(ANSWER_MAX + 1))).toBeNull();
  });
});
