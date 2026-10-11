import { answerErrorKey, cleanAnswer, DAILY_ANSWER_MAX, latestAnswers, myAnswer, questionText, toDailyQuestion } from "@/lib/community/dailyQuestion";
import type { CommunityComment } from "@/lib/communityData";

jest.mock("@/lib/supabase/client", () => ({ supabase: {} }));

const c = (id: string, authorId: string, at: string, parentId: string | null = null): CommunityComment =>
  ({ id, postId: "p", authorId, authorName: "Prind", parentId, text: "x", at, expert: null }) as CommunityComment;

describe("pyetja e ditës", () => {
  it("pyetja e sotme nga serveri; pa pyetje (ose pa postim bazë) asgjë, pa kartë bosh", () => {
    const row = { id: "q1", text: "Si fle bebi?", text_en: "How does baby sleep?", active_date: "2026-10-12", post_id: "p1", answer_count: 3 };
    expect(toDailyQuestion([row], "sq")).toEqual({ id: "q1", text: "Si fle bebi?", date: "2026-10-12", postId: "p1", answerCount: 3 });
    expect(toDailyQuestion([row], "en")?.text).toBe("How does baby sleep?");
    expect(toDailyQuestion([], "sq")).toBeNull();
    expect(toDailyQuestion(null, "sq")).toBeNull();
    expect(toDailyQuestion([{ ...row, post_id: null }], "sq")).toBeNull();
  });

  it("teksti në gjuhën e app-it; pa anglisht, shqip", () => {
    expect(questionText({ text: " Si fle bebi? ", text_en: null }, "en")).toBe("Si fle bebi?");
    expect(questionText({ text: "Si fle bebi?", text_en: "  " }, "en")).toBe("Si fle bebi?");
  });

  it("përgjigja: 1–280 shkronja, hapësirat pastrohen", () => {
    expect(cleanAnswer("  Banjë   e ngrohtë  ")).toBe("Banjë e ngrohtë");
    expect(cleanAnswer("   ")).toBeNull();
    expect(cleanAnswer("a".repeat(DAILY_ANSWER_MAX))).toHaveLength(DAILY_ANSWER_MAX);
    expect(cleanAnswer("a".repeat(DAILY_ANSWER_MAX + 1))).toBeNull();
  });

  it("karta: 2 përgjigjet më të reja, pa përgjigjet ndaj tyre", () => {
    const list = [c("a", "u1", "2026-10-12T08:00:00Z"), c("b", "u2", "2026-10-12T09:00:00Z"), c("r", "u3", "2026-10-12T10:00:00Z", "a"), c("d", "u4", "2026-10-12T09:30:00Z")];
    expect(latestAnswers(list).map((x) => x.id)).toEqual(["d", "b"]);
  });

  it("përgjigja ime: vetëm komenti i parë, jo përgjigjet ndaj të tjerëve", () => {
    const list = [c("a", "u1", "2026-10-12T08:00:00Z"), c("r", "me", "2026-10-12T10:00:00Z", "a")];
    expect(myAnswer(list, "me")).toBeNull();
    expect(myAnswer([...list, c("m", "me", "2026-10-12T11:00:00Z")], "me")?.id).toBe("m");
    expect(myAnswer(list, null)).toBeNull();
  });

  it("gabimet e bazës → tekste të qarta", () => {
    expect(answerErrorKey(new Error("daily_answer_exists"))).toBe("dq_err_exists");
    expect(answerErrorKey(new Error("daily_answer_length"))).toBe("dq_err_length");
    expect(answerErrorKey(new Error("rrjeti"))).toBe("dq_save_failed");
  });
});
