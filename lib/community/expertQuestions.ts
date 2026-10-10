import { supabase } from "@/lib/supabase/client";
import type { CommentExpert } from "@/lib/communityData";
import type { TranslationKey } from "@/lib/i18n/translations";

/**
 * "Pyet ekspertin": pyetje private te një ekspert i verifikuar.
 * Prindi lexon vetëm të vetat (RLS); ekspertët marrin radhën nga
 * `expert_question_queue()` — pa asnjë të dhënë të prindit. Shkrimi bëhet
 * vetëm me funksionet e bazës (limiti 3 në javë kontrollohet atje).
 * Pa njoftime push: përgjigja e re tregohet me pikën e kuqe.
 */

export const BODY_MIN = 20;
export const BODY_MAX = 600;
export const ANSWER_MAX = 1500;
export const WEEKLY_LIMIT = 3;
/** Etiketa që vendos baza te postimi i publikuar pa emër. */
export const EXPERT_QA_TAG = "Pyetje për ekspert";

export type QuestionCategory = "sleep" | "feeding" | "health" | "development" | "other";
export const CATEGORIES: QuestionCategory[] = ["sleep", "feeding", "health", "development", "other"];
export const categoryKey = (c: string) => `eq_cat_${CATEGORIES.includes(c as QuestionCategory) ? c : "other"}` as TranslationKey;

export type QuestionStatus = "pending" | "claimed" | "answered";

export type MyQuestion = {
  id: string;
  category: QuestionCategory;
  body: string;
  status: QuestionStatus;
  publish: boolean;
  answer: string | null;
  createdAt: string;
  answeredAt: string | null;
  unread: boolean;
  expert: { name: string; badge: CommentExpert } | null;
};

export type QueueItem = { id: string; category: QuestionCategory; body: string; createdAt: string; claimedByMine: boolean };

/** Teksti i vlefshëm (20–600 shkronja pas pastrimit), ose null. */
export function cleanBody(text: string): string | null {
  const t = text.replace(/[ \t]+/g, " ").trim();
  return t.length >= BODY_MIN && t.length <= BODY_MAX ? t : null;
}

/** Për prindin: "Në pritje" edhe kur një ekspert e ka marrë, "U përgjigj" kur ka përgjigje. */
export const statusKey = (s: QuestionStatus): TranslationKey => (s === "answered" ? "eq_status_answered" : "eq_status_pending");

/** Sa orë pret pyetja (për ekspertin). */
export function waitingHours(createdAt: string, now: Date = new Date()): number {
  return Math.max(0, Math.floor((now.getTime() - new Date(createdAt).getTime()) / 3_600_000));
}

/** Sa pyetje mbeten këtë javë (7 ditët e fundit). */
export function remainingThisWeek(createdAts: string[], now: Date = new Date()): number {
  const from = now.getTime() - 7 * 86_400_000;
  return Math.max(0, WEEKLY_LIMIT - createdAts.filter((c) => new Date(c).getTime() > from).length);
}

/** Gabimet e bazës → çelësi i tekstit për prindin/ekspertin. */
export function errorKey(err: unknown): TranslationKey {
  const msg = err instanceof Error ? err.message : String((err as { message?: string })?.message ?? err);
  if (msg.includes("weekly_limit")) return "eq_err_limit";
  if (msg.includes("claimed_by_other") || msg.includes("already_answered")) return "eq_err_taken";
  return "eq_err_generic";
}

// --- Prindi -----------------------------------------------------------------

export async function askExpert(category: QuestionCategory, body: string, publish: boolean): Promise<void> {
  const clean = cleanBody(body);
  if (!clean) throw new Error("bad_body");
  const { error } = await supabase.rpc("ask_expert", { p_category: category, p_body: clean, p_publish: publish });
  if (error) throw new Error(error.message);
}

type Row = {
  id: string; category: QuestionCategory; body: string; status: QuestionStatus; publish_anonymously: boolean;
  answer: string | null; created_at: string; answered_at: string | null; answer_read_at: string | null; expert_id: string | null;
};

export async function fetchMyQuestions(): Promise<MyQuestion[]> {
  const { data, error } = await supabase
    .from("expert_questions")
    .select("id, category, body, status, publish_anonymously, answer, created_at, answered_at, answer_read_at, expert_id")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  const rows = (data ?? []) as Row[];

  // Emri dhe reparti i ekspertit që u përgjigj (community_experts lexohet publikisht).
  const ids = [...new Set(rows.filter((r) => r.status === "answered" && r.expert_id).map((r) => r.expert_id as string))];
  const experts = new Map<string, { name: string; badge: CommentExpert }>();
  if (ids.length) {
    const { data: ex } = await supabase.from("community_experts").select("user_id, name, kind, specialty_key").in("user_id", ids);
    for (const e of (ex ?? []) as { user_id: string; name: string; kind: string; specialty_key: string | null }[]) {
      experts.set(e.user_id, { name: e.name, badge: { kind: e.kind, specialty: e.specialty_key } });
    }
  }
  return rows.map((r) => ({
    id: r.id,
    category: r.category,
    body: r.body,
    status: r.status,
    publish: r.publish_anonymously,
    answer: r.answer,
    createdAt: r.created_at,
    answeredAt: r.answered_at,
    unread: r.status === "answered" && !r.answer_read_at,
    expert: r.status === "answered" && r.expert_id ? (experts.get(r.expert_id) ?? null) : null,
  }));
}

/** Sa përgjigje të palexuara ka prindi (pika e kuqe). */
export async function fetchUnreadCount(): Promise<number> {
  const { count, error } = await supabase
    .from("expert_questions")
    .select("id", { count: "exact", head: true })
    .eq("status", "answered")
    .is("answer_read_at", null);
  if (error) return 0;
  return count ?? 0;
}

export async function markAnswersRead(): Promise<void> {
  await supabase.rpc("mark_expert_answers_read");
}

// --- Eksperti ---------------------------------------------------------------

export async function isVerifiedExpert(): Promise<boolean> {
  const { data, error } = await supabase.rpc("is_verified_expert");
  return !error && data === true;
}

export async function fetchQueue(): Promise<QueueItem[]> {
  const { data, error } = await supabase.rpc("expert_question_queue");
  if (error) throw error;
  return ((data ?? []) as { id: string; category: QuestionCategory; body: string; created_at: string; claimed_by_me: boolean }[]).map((r) => ({
    id: r.id,
    category: r.category,
    body: r.body,
    createdAt: r.created_at,
    claimedByMine: r.claimed_by_me,
  }));
}

/** false = e mori ndërkohë një ekspert tjetër. */
export async function claimQuestion(id: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("claim_expert_question", { p_id: id });
  if (error) throw new Error(error.message);
  return data === true;
}

export async function skipQuestion(id: string): Promise<void> {
  const { error } = await supabase.rpc("skip_expert_question", { p_id: id });
  if (error) throw new Error(error.message);
}

export async function answerQuestion(id: string, answer: string): Promise<void> {
  const clean = answer.trim();
  if (clean.length < 1 || clean.length > ANSWER_MAX) throw new Error("bad_answer");
  const { error } = await supabase.rpc("answer_expert_question", { p_id: id, p_answer: clean });
  if (error) throw new Error(error.message);
}
