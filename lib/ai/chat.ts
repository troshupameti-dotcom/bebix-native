import { FunctionsFetchError, FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";

export type AiTurn = { role: "user" | "assistant"; text: string };
export type AiContext = { stage?: string; age?: string };

/** Pse s'erdhi përgjigje: secila ka mesazhin e vet për prindin. */
export type AiFailure = "auth" | "not_ready" | "limit" | "busy" | "refusal" | "offline";

export type AiResult = { ok: true; text: string } | { ok: false; reason: AiFailure; limit?: number };

/**
 * Pyetja te asistenti AI përmes funksionit `ai-chat` në server (çelësi i Claude s'është kurrë në app). Punon edhe
 * në Expo Go: është thjesht një kërkesë HTTPS. Nëse funksioni s'është publikuar ende ose s'ka çelës, del "not_ready".
 */
export async function askAi(history: AiTurn[], lang: "sq" | "en", context: AiContext): Promise<AiResult> {
  const { data, error } = await supabase.functions.invoke("ai-chat", { body: { messages: history, lang, context } });

  if (error instanceof FunctionsHttpError) {
    const status = error.context?.status as number | undefined;
    const payload = (await error.context?.json?.().catch(() => null)) as { error?: string; limit?: number } | null;
    if (status === 401) return { ok: false, reason: "auth" };
    if (status === 404 || payload?.error === "not_configured") return { ok: false, reason: "not_ready" };
    if (payload?.error === "limit") return { ok: false, reason: "limit", limit: payload.limit };
    return { ok: false, reason: "busy" };
  }
  if (error instanceof FunctionsFetchError) return { ok: false, reason: "offline" };
  if (error) return { ok: false, reason: "busy" };

  const body = data as { text?: string; error?: string } | null;
  if (body?.error === "refusal") return { ok: false, reason: "refusal" };
  if (typeof body?.text === "string" && body.text.trim()) return { ok: true, text: body.text.trim() };
  return { ok: false, reason: "busy" };
}

export type AiReportReason = "wrong" | "unsafe" | "inappropriate" | "other";

/** Raporton një përgjigje (Google Play e kërkon brenda app-it). I lexojnë vetëm adminët. false kur s'u dërgua. */
export async function reportAiAnswer(input: { question: string; answer: string; reason: AiReportReason; note: string }): Promise<boolean> {
  const { error } = await supabase.from("ai_reports").insert({
    question: input.question.slice(0, 2000),
    answer: input.answer.slice(0, 8000),
    reason: input.reason,
    note: input.note.trim().slice(0, 300) || null,
  });
  return !error;
}
