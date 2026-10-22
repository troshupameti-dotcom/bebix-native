import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Anthropic from "npm:@anthropic-ai/sdk@0.131.0";
import { OUTPUT_SCHEMA, SYSTEM, pickTheme, slugify, userPrompt, validateDraft, weekNumber, type StoryRow } from "./story.ts";

/**
 * Përralla e javës: Claude shkruan një përrallë të re (tekst + ilustrim) dhe ajo ruhet si draft te `stories`.
 * Prindërit s'e shohin derisa admini ta publikojë te Paneli → Përrallat.
 *
 * Kush e thërret:
 * - pg_cron çdo të hënë (migrimi 20261025090000), pa llogari: shkruhet vetëm nëse s'ka asnjë përrallë nga Claude
 *   në 6 ditët e fundit (kështu as thirrjet e huaja s'kalojnë një në javë);
 * - admini nga app-i ("Shkruaj një tani"), me sesionin e vet: deri në 5 në ditë, me një ide opsionale.
 * Shkrimi zgjat 1–2 minuta, ndaj bëhet në sfond; përgjigjja kthehet menjëherë.
 *
 * Sekretet: ANTHROPIC_API_KEY (i njëjti si te ai-chat). Opsionale: RESEND_API_KEY + STORY_REVIEW_EMAIL për emailin
 * "Përralla e re për aprovim".
 */

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void } | undefined;

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const apiKey = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
const MODEL = Deno.env.get("STORY_MODEL") ?? "claude-opus-5-5";
const RESEND_KEY = Deno.env.get("RESEND_API_KEY");
const REVIEW_EMAIL = Deno.env.get("STORY_REVIEW_EMAIL") ?? "info.bebix@gmail.com";
const FROM = Deno.env.get("ORDER_EMAIL_FROM") ?? "Bebix <porosi@bebix.store>";
const ADMIN_DAILY_LIMIT = 5;
const WEEK_GAP_MS = 6 * 86_400_000;

const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
const anthropic = apiKey ? new Anthropic({ apiKey }) : null;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

/** Admini i kyçur, ose null (cron / thirrje pa llogari). */
async function adminCaller(req: Request): Promise<string | null> {
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token || token === anonKey) return null;
  const caller = createClient(supabaseUrl, anonKey, { auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data } = await caller.auth.getUser();
  const id = data?.user?.id;
  if (!id) return null;
  const { data: row } = await db.from("admins").select("user_id").eq("user_id", id).maybeSingle();
  return row ? id : null;
}

async function recentAiCount(sinceMs: number): Promise<number> {
  const { count } = await db
    .from("stories")
    .select("id", { count: "exact", head: true })
    .eq("source", "ai")
    .gte("created_at", new Date(Date.now() - sinceMs).toISOString());
  return count ?? 0;
}

async function notifyReviewer(title: string, summary: string) {
  if (!RESEND_KEY) return;
  const html = `<div style="font-family:Arial,sans-serif;color:#2B2620;line-height:1.5">
<p>Claude shkroi përrallën e javës dhe ajo pret aprovimin tuaj.</p>
<p><strong>${escapeHtml(title)}</strong><br>${escapeHtml(summary)}</p>
<p>Hapeni te app-i: Cilësimet → Paneli i adminit → Përrallat. Prindërit s'e shohin derisa ta publikoni.</p></div>`;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM, to: [REVIEW_EMAIL], subject: `Përrallë e re për aprovim: ${title}`, html }),
  }).catch((e) => console.warn("email:", e));
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

async function writeStory(idea: string | null): Promise<void> {
  const { data: rows, error } = await db.from("stories").select("slug, title, categories, age_min_months, age_max_months, status, sort_order");
  if (error) throw new Error(`stories: ${error.message}`);
  const all = (rows ?? []) as (StoryRow & { slug: string; sort_order: number | null })[];
  const theme = pickTheme(all, weekNumber(new Date()));

  const params: Record<string, unknown> = {
    model: MODEL,
    max_tokens: 32000,
    // Shkrim krijues një herë në javë: përpjekje mesatare (cilësi e mirë, brenda kohës së funksionit).
    output_config: { effort: "medium", format: { type: "json_schema", schema: OUTPUT_SCHEMA } },
    system: SYSTEM,
    messages: [{ role: "user", content: userPrompt({ ...theme, titles: all.map((r) => r.title), idea }) }],
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
  };
  // Me rrjedhë (stream): përgjigjja është e gjatë, dhe kështu s'ndalet nga afati i kërkesës HTTP.
  const stream = anthropic!.beta.messages.stream(params as never);
  const message = await stream.finalMessage();
  if (message.stop_reason === "refusal") throw new Error("refusal");
  if (message.stop_reason === "max_tokens") throw new Error("max_tokens");
  const text = message.content.map((b) => (b.type === "text" ? b.text : "")).join("");

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("json");
  }
  const result = validateDraft(parsed);
  if ("error" in result) throw new Error(`invalid: ${result.error}`);
  const d = result.draft;

  const slug = slugify(d.title, new Set(all.map((r) => r.slug)));
  const sortOrder = Math.max(0, ...all.map((r) => r.sort_order ?? 0)) + 10;
  const { error: insertError } = await db.from("stories").insert({
    slug,
    language: "sq",
    title: d.title,
    summary: d.summary,
    paragraphs: d.paragraphs,
    categories: d.categories,
    age_min_months: d.age_min_months,
    age_max_months: d.age_max_months,
    reading_minutes: d.reading_minutes,
    cover_key: d.cover_key,
    cover_svg: d.cover_svg,
    status: "draft",
    source: "ai",
    ai_idea: idea,
    featured: false,
    sort_order: sortOrder,
  });
  if (insertError) throw new Error(`insert: ${insertError.message}`);
  console.log(`story-draft: "${d.title}" (${slug}), ${theme.category}/${theme.band}, svg ${d.cover_svg ? "ok" : "refuzuar"}, tokens ${message.usage.output_tokens}`);
  await notifyReviewer(d.title, d.summary);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method" }, 405);

  let body: { idea?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const admin = await adminCaller(req);
  if (!anthropic) return json({ error: "not_configured" }, 503);

  // Kufijtë: cron-i dhe çdo thirrje pa admin, një në javë; admini, disa në ditë.
  if (admin) {
    if ((await recentAiCount(86_400_000)) >= ADMIN_DAILY_LIMIT) return json({ error: "limit", limit: ADMIN_DAILY_LIMIT }, 429);
  } else if ((await recentAiCount(WEEK_GAP_MS)) > 0) {
    return json({ skipped: "this_week" });
  }

  const idea = admin && typeof body.idea === "string" && body.idea.trim() ? body.idea.trim().slice(0, 300) : null;
  const job = writeStory(idea).catch((e) => console.error("story-draft:", e instanceof Anthropic.APIError ? `${e.status} ${e.message}` : String(e)));
  if (typeof EdgeRuntime !== "undefined") {
    EdgeRuntime.waitUntil(job);
    return json({ started: true }, 202);
  }
  await job;
  return json({ started: true });
});
