/**
 * Asistenti AI: pëlqimi para përdorimit të parë (Apple 5.1.2 / GDPR), pyetja shkon te funksioni në server me
 * bisedën dhe moshën e fëmijës, përgjigjja del në bisedë, çdo përgjigje mund të raportohet (Google Play), dhe kur
 * AI-ja s'është aktivizuar ende, prindi sheh një mesazh të qartë.
 */
import { fakeSupabase, renderScreen, visibleText } from "./helpers/screen";
import { TextInput } from "react-native";
import { act, type ReactTestRenderer } from "react-test-renderer";
import AiChat from "@/app/(main)/ai-chat";
import { translations } from "@/lib/i18n/translations";
import { giveAiConsent, hasAiConsent } from "@/lib/ai/consent";

const sq = translations.sq;
const chat = require("@/lib/ai/chat") as typeof import("@/lib/ai/chat");

const settle = async () => {
  for (let i = 0; i < 4; i++) await act(async () => { await new Promise((r) => setTimeout(r, 15)); });
};
const pressLabel = (r: ReactTestRenderer, label: string) =>
  act(async () => {
    r.root.findAll((n) => n.props.accessibilityLabel === label && typeof n.props.onPress === "function")[0].props.onPress();
    await new Promise((res) => setTimeout(res, 20));
  });
const pressText = (r: ReactTestRenderer, text: string) =>
  act(async () => {
    const hits = r.root.findAll((n) => typeof n.props.onPress === "function" && visibleText(n).join(" ").includes(text));
    hits[hits.length - 1].props.onPress();
    await new Promise((res) => setTimeout(res, 20));
  });

beforeEach(() => {
  fakeSupabase().session = { user: { id: "me" } };
});
afterEach(() => jest.restoreAllMocks());

async function ask(text: string) {
  await giveAiConsent("me");
  const r = await renderScreen(<AiChat />);
  await settle();
  await act(async () => r.root.findByType(TextInput).props.onChangeText(text));
  await pressLabel(r, sq.ai_chat_send);
  return r;
}

describe("pëlqimi", () => {
  it("para përdorimit të parë del dritarja e pëlqimit; pas “Pranoj” hapet biseda dhe pëlqimi ruhet", async () => {
    const r = await renderScreen(<AiChat />);
    await settle();
    expect(visibleText(r.root)).toContain(sq.ai_consent_title);
    expect(r.root.findAllByType(TextInput)).toHaveLength(0);
    await pressText(r, sq.ai_consent_accept);
    expect(r.root.findAllByType(TextInput)).toHaveLength(1);
    expect(await hasAiConsent("me")).toBe(true);
  });
});

describe("asistenti AI", () => {
  it("dërgon pyetjen dhe tregon përgjigjen", async () => {
    const spy = jest.spyOn(chat, "askAi").mockResolvedValue({ ok: true, text: "Provoni një rutinë të qetë para gjumit." });
    const r = await ask("Si ta fle bebin?");
    expect(spy.mock.calls[0][0]).toEqual([{ role: "user", text: "Si ta fle bebin?" }]);
    expect(spy.mock.calls[0][1]).toBe("sq");
    expect(visibleText(r.root)).toContain("Provoni një rutinë të qetë para gjumit.");
  });

  it("çdo përgjigje raportohet me pyetjen, përgjigjen dhe arsyen", async () => {
    jest.spyOn(chat, "askAi").mockResolvedValue({ ok: true, text: "Përgjigje e gabuar." });
    const report = jest.spyOn(chat, "reportAiAnswer").mockResolvedValue(true);
    const r = await ask("Pyetja ime");
    await pressLabel(r, sq.ai_report_title);
    await pressText(r, sq.ai_report_unsafe);
    await pressText(r, sq.ai_report_send);
    expect(report).toHaveBeenCalledWith({ question: "Pyetja ime", answer: "Përgjigje e gabuar.", reason: "unsafe", note: "" });
  });

  it("pa funksionin ose çelësin: mesazh i qartë, jo përgjigje e rreme (dhe pa butonin “Raporto”)", async () => {
    jest.spyOn(chat, "askAi").mockResolvedValue({ ok: false, reason: "not_ready" });
    const r = await ask("Pyetje");
    expect(visibleText(r.root)).toContain(sq.ai_chat_not_ready);
    expect(r.root.findAll((n) => n.props.accessibilityLabel === sq.ai_report_title)).toHaveLength(0);
  });

  it("kufiri ditor: tregon numrin", async () => {
    jest.spyOn(chat, "askAi").mockResolvedValue({ ok: false, reason: "limit", limit: 30 });
    const r = await ask("Pyetje");
    expect(visibleText(r.root)).toContain(sq.ai_chat_limit.replace("{n}", "30"));
  });
});
