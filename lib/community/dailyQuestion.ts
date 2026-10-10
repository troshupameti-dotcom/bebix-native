import { supabase } from "@/lib/supabase/client";
import { expertsByUserId, fetchBlockedUserIds, getCurrentUserId, type CommentExpert } from "@/lib/communityData";

/**
 * Pyetja e ditës te Komuniteti: një pyetje në ditë (tabela `daily_questions`,
 * sipas `active_date`) dhe përgjigje të shkurtra (`daily_question_answers`,
 * një për prind, e ndryshueshme). Emrin e autorit e vendos serveri, si te
 * komentet.
 */

export const ANSWER_MAX = 280;
/** Sa përgjigje dalin direkt te karta. */
export const CARD_PREVIEW = 3;

export type DailyQuestion = { id: string; text: string; date: string };

export type DailyAnswer = {
  id: string;
  authorId: string;
  authorName: string;
  text: string;
  at: string;
  edited: boolean;
  expert: CommentExpert | null;
};

const pad = (n: number) => String(n).padStart(2, "0");
/** Data lokale e telefonit ("2026-10-13") — pyetja ndryshon në mesnatën e prindit. */
export const localDateKey = (d: Date = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Teksti në gjuhën e app-it; pa anglisht, shqip. */
export function questionText(row: { text_sq: string; text_en: string | null }, lang: "sq" | "en"): string {
  return lang === "en" && row.text_en?.trim() ? row.text_en.trim() : row.text_sq.trim();
}

/** Përgjigja e vlefshme: 1–280 shkronja pas pastrimit; null kur s'është. */
export function cleanAnswer(text: string): string | null {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length >= 1 && t.length <= ANSWER_MAX ? t : null;
}

/** Pyetja e sotme, ose null kur për sot s'ka (karta s'shfaqet). */
export async function fetchTodayQuestion(lang: "sq" | "en", now: Date = new Date()): Promise<DailyQuestion | null> {
  const { data, error } = await supabase
    .from("daily_questions")
    .select("id, text_sq, text_en, active_date")
    .eq("active_date", localDateKey(now))
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { id: data.id, text: questionText(data, lang), date: data.active_date };
}

export async function fetchQuestionById(id: string, lang: "sq" | "en"): Promise<DailyQuestion | null> {
  const { data, error } = await supabase.from("daily_questions").select("id, text_sq, text_en, active_date").eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? { id: data.id, text: questionText(data, lang), date: data.active_date } : null;
}

type AnswerRow = { id: string; author_id: string; author_name: string | null; text: string; created_at: string; updated_at: string };

/**
 * Përgjigjet (më të parat para), pa ato të përdoruesve të bllokuar, me
 * numrin total. `limit` për kartën; pa `limit`, të gjitha.
 */
export async function fetchAnswers(questionId: string, limit?: number): Promise<{ answers: DailyAnswer[]; total: number; mine: DailyAnswer | null }> {
  let query = supabase
    .from("daily_question_answers")
    .select("id, author_id, author_name, text, created_at, updated_at", { count: "exact" })
    .eq("question_id", questionId)
    .order("created_at", { ascending: true });
  if (limit) query = query.limit(limit + 10); // pak më shumë: disa mund të jenë të bllokuar
  const [{ data, error, count }, blocked, uid] = await Promise.all([query, fetchBlockedUserIds(), getCurrentUserId()]);
  if (error) throw error;

  const rows = ((data ?? []) as AnswerRow[]).filter((r) => !blocked.has(r.author_id));
  const experts = await expertsByUserId([...new Set(rows.map((r) => r.author_id))]);
  const all = rows.map((r) => ({
    id: r.id,
    authorId: r.author_id,
    authorName: r.author_name || "Prind",
    text: r.text,
    at: r.created_at,
    edited: new Date(r.updated_at).getTime() - new Date(r.created_at).getTime() > 60_000,
    expert: experts.get(r.author_id) ?? null,
  }));

  // Përgjigja ime, edhe kur s'është mes të parave (për "Ndrysho përgjigjen").
  let mine = all.find((a) => a.authorId === uid) ?? null;
  if (!mine && uid && limit) {
    const { data: own } = await supabase
      .from("daily_question_answers")
      .select("id, author_id, author_name, text, created_at, updated_at")
      .eq("question_id", questionId)
      .eq("author_id", uid)
      .maybeSingle();
    if (own) {
      const r = own as AnswerRow;
      mine = { id: r.id, authorId: r.author_id, authorName: r.author_name || "Prind", text: r.text, at: r.created_at, edited: false, expert: null };
    }
  }
  return { answers: limit ? all.slice(0, limit) : all, total: count ?? all.length, mine };
}

/** Ruaj ose ndrysho përgjigjen time (një për pyetje). */
export async function saveAnswer(questionId: string, text: string, authorName: string): Promise<void> {
  const uid = await getCurrentUserId();
  if (!uid) throw new Error("Duhet të jesh i kyçur.");
  const clean = cleanAnswer(text);
  if (!clean) throw new Error("Përgjigja duhet të ketë 1–280 shkronja.");
  const { error } = await supabase
    .from("daily_question_answers")
    .upsert({ question_id: questionId, author_id: uid, author_name: authorName.trim(), text: clean }, { onConflict: "question_id,author_id" });
  if (error) throw error;
}

export async function deleteAnswer(id: string): Promise<void> {
  const { error } = await supabase.from("daily_question_answers").delete().eq("id", id);
  if (error) throw error;
}
