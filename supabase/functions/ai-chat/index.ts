import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Anthropic from "npm:@anthropic-ai/sdk@0.131.0";

/**
 * Asistenti AI i Bebix-it. App-i dërgon bisedën këtu; funksioni e çon te Claude dhe kthen përgjigjen.
 * Çelësi i Anthropic rri vetëm këtu (sekreti ANTHROPIC_API_KEY te Supabase), kurrë në app.
 *
 * Mbrojtjet: vetëm për llogaritë e kyçura; kufi ditor pyetjesh për llogari (tabela `ai_usage`, migrimi
 * 20261023090000; pa migrimin kufiri s'zbatohet); biseda e shkurtuar (20 mesazhet e fundit, 2000 shkronja secili).
 * Model: Claude Opus 5.5 me përpjekje të ulët (bisedë e shpejtë); mund të ndryshohet me AI_MODEL.
 */

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const apiKey = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
const MODEL = Deno.env.get("AI_MODEL") ?? "claude-opus-5-5";
const DAILY_LIMIT = Number(Deno.env.get("AI_DAILY_LIMIT") ?? "30");
const MAX_MESSAGES = 20;
const MAX_CHARS = 2000;

const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
const anthropic = apiKey ? new Anthropic({ apiKey }) : null;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

// I njëjti për çdo kërkesë (pa data, emra apo numra që ndryshojnë), që të ruhet në cache.
const SYSTEM = `You are Bebix AI, the assistant inside Bebix, an app for parents in Kosovo and Albania, from pregnancy until the child is 12 years old. You help with everyday parenting: feeding, sleep, development, routines, play, emotions, pregnancy and the parent's own wellbeing.

How to answer:
- Reply in the parent's language. For Albanian use standard literary Albanian (gjuha standarde) with correct ë and ç, warm and clear, never slang. For English use plain English.
- Be brief and practical for a phone screen: usually 2 to 6 sentences, or a short list using "•". No headings, tables or markdown symbols.
- Fit the advice to the child's age and stage when it is given. If something important is missing, ask one short question.
- Be kind and reassuring without dismissing real worries.

Health and safety:
- You give general information, not a diagnosis, and you are not a doctor. For anything that worries the parent, suggest checking with their pediatrician.
- Never give medicine doses or tell a parent to start or stop a medicine; say that the dose depends on the child's weight and must come from the pediatrician or pharmacist.
- If the message describes an emergency sign, start your answer by telling them to call 112 or go to the nearest emergency room now, before anything else. Emergency signs include: trouble breathing or bluish lips, a seizure, the child is unresponsive or very hard to wake, fever of 38 °C or more in a baby under 3 months, signs of dehydration (no wet diaper for 8 hours or more, very dry mouth, no tears), a severe allergic reaction, a head injury followed by vomiting or drowsiness, a suspected poisoning or swallowed battery or magnet, or heavy bleeding or reduced baby movements in pregnancy.
- Follow current mainstream pediatric guidance (for example safe sleep on the back in the child's own bed, no honey before 12 months, no screens for babies).

Other topics: if a question has nothing to do with family life, answer very briefly and kindly bring the conversation back to how you can help with the child. Do not ask for names, addresses or other personal details.`;

type IncomingMessage = { role?: unknown; text?: unknown };

function cleanHistory(raw: unknown): Anthropic.MessageParam[] {
  if (!Array.isArray(raw)) return [];
  const messages = (raw as IncomingMessage[])
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.text === "string" && m.text.trim())
    .slice(-MAX_MESSAGES)
    .map((m) => ({ role: m.role as "user" | "assistant", content: (m.text as string).trim().slice(0, MAX_CHARS) }));
  // Biseda duhet të nisë me prindin (përshëndetja e app-it s'dërgohet).
  while (messages.length && messages[0].role !== "user") messages.shift();
  return messages;
}

function contextLine(lang: string, context: unknown): string {
  const c = (context && typeof context === "object" ? context : {}) as Record<string, unknown>;
  const parts = [`Parent's language: ${lang === "en" ? "English" : "Albanian"}.`];
  if (typeof c.stage === "string" && c.stage.length < 40) parts.push(`Child's stage: ${c.stage}.`);
  if (typeof c.age === "string" && c.age.length < 60) parts.push(`Child's age: ${c.age}.`);
  return parts.join(" ");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method" }, 405);

  // Kush pyet: vetëm llogari e kyçur (jo mysafiri), që kostoja të ketë kufi.
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const caller = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: userData, error: userError } = await caller.auth.getUser();
  const userId = userData?.user?.id;
  if (userError || !userId) return json({ error: "auth" }, 401);

  if (!anthropic) return json({ error: "not_configured" }, 503);

  let body: { messages?: unknown; lang?: unknown; context?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: "bad_request" }, 400);
  }
  const lang = body.lang === "en" ? "en" : "sq";
  const messages = cleanHistory(body.messages);
  if (!messages.length || messages[messages.length - 1].role !== "user") return json({ error: "bad_request" }, 400);

  // Kufiri ditor. Pa migrimin (funksioni mungon) kufiri s'zbatohet, që AI të punojë edhe para tij.
  const { data: allowed, error: quotaError } = await admin.rpc("ai_take_quota", { p_user: userId, p_limit: DAILY_LIMIT });
  if (quotaError) console.warn("ai_take_quota:", quotaError.message);
  else if (allowed === false) return json({ error: "limit", limit: DAILY_LIMIT }, 429);

  const params: Record<string, unknown> = {
    model: MODEL,
    max_tokens: 16000,
    // Bisedë e përditshme: përpjekje e ulët (më e shpejtë dhe më e lirë; mendimi mbetet i ndezur).
    output_config: { effort: "low" },
    // Ruan në cache pjesën e njëjtë të bisedës nga pyetja në pyetje.
    cache_control: { type: "ephemeral" },
    system: [
      { type: "text", text: SYSTEM },
      { type: "text", text: contextLine(lang, body.context) },
    ],
    messages,
  };
  // Kur Claude refuzon një pyetje për arsye sigurie, serveri e provon vetë me modelin e rekomanduar (s'vlen për Haiku).
  if (!MODEL.includes("haiku")) {
    params.betas = ["server-side-fallback-2026-07-01"];
    params.fallbacks = "default";
  }

  try {
    const response = await anthropic.beta.messages.create(params as unknown as Anthropic.Beta.MessageCreateParamsNonStreaming);
    if (response.stop_reason === "refusal") return json({ error: "refusal" }, 200);
    const text = response.content
      .map((block) => (block.type === "text" ? block.text : ""))
      .join("")
      .trim();
    if (!text) return json({ error: "empty" }, 502);
    return json({ text: response.stop_reason === "max_tokens" ? `${text}…` : text });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return json({ error: "busy" }, 429);
    if (e instanceof Anthropic.AuthenticationError) return json({ error: "not_configured" }, 503);
    if (e instanceof Anthropic.APIError) {
      console.error("Claude API:", e.status, e.message);
      return json({ error: "upstream" }, 502);
    }
    console.error("ai-chat:", e);
    return json({ error: "upstream" }, 502);
  }
});
