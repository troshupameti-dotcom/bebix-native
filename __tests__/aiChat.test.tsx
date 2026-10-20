/**
 * Asistenti AI: pyetja shkon te funksioni në server me bisedën (pa përshëndetjen e app-it) dhe moshën e fëmijës;
 * përgjigjja del në bisedë; kur AI-ja s'është aktivizuar ende, prindi sheh një mesazh të qartë.
 */
import { renderScreen, visibleText } from "./helpers/screen";
import { TextInput } from "react-native";
import { act } from "react-test-renderer";
import AiChat from "@/app/(main)/ai-chat";
import { translations } from "@/lib/i18n/translations";

const sq = translations.sq;
const chat = require("@/lib/ai/chat") as typeof import("@/lib/ai/chat");

afterEach(() => jest.restoreAllMocks());

async function ask(text: string) {
  const r = await renderScreen(<AiChat />);
  await act(async () => r.root.findByType(TextInput).props.onChangeText(text));
  await act(async () => {
    r.root.findAll((n) => n.props.accessibilityLabel === sq.ai_chat_send && typeof n.props.onPress === "function")[0].props.onPress();
    await new Promise((res) => setTimeout(res, 20));
  });
  return r;
}

describe("asistenti AI", () => {
  it("dërgon pyetjen dhe tregon përgjigjen", async () => {
    const spy = jest.spyOn(chat, "askAi").mockResolvedValue({ ok: true, text: "Provoni një rutinë të qetë para gjumit." });
    const r = await ask("Si ta fle bebin?");
    expect(spy.mock.calls[0][0]).toEqual([{ role: "user", text: "Si ta fle bebin?" }]);
    expect(spy.mock.calls[0][1]).toBe("sq");
    expect(visibleText(r.root)).toContain("Provoni një rutinë të qetë para gjumit.");
  });

  it("pa funksionin ose çelësin: mesazh i qartë, jo përgjigje e rreme", async () => {
    jest.spyOn(chat, "askAi").mockResolvedValue({ ok: false, reason: "not_ready" });
    const r = await ask("Pyetje");
    expect(visibleText(r.root)).toContain(sq.ai_chat_not_ready);
  });

  it("kufiri ditor: tregon numrin", async () => {
    jest.spyOn(chat, "askAi").mockResolvedValue({ ok: false, reason: "limit", limit: 30 });
    const r = await ask("Pyetje");
    expect(visibleText(r.root)).toContain(sq.ai_chat_limit.replace("{n}", "30"));
  });
});
