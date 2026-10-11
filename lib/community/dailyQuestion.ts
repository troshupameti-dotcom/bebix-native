import { supabase } from "@/lib/supabase/client";
import type { CommunityComment } from "@/lib/communityData";
import type { TranslationKey } from "@/lib/i18n/translations";

/**
 * "Pyetja e ditës" te Komuniteti. Çdo pyetje ka një postim bazë nga llogaria
 * editoriale e Bebix-it; përgjigjet janë komentet e atij postimi (kështu
 * raportimi, bllokimi dhe njoftimet janë ato ekzistuese). Baza kontrollon:
 * një përgjigje (koment i parë) për prind, 1–280 shkronja; ndryshimi bëhet me
 * `edit_daily_answer`. Dita: Europe/Belgrade, e njëjtë për të gjithë.
 */

export const DAILY_ANSWER_MAX = 280;
/** Sa përgjigje dalin direkt te karta. */
export const CARD_PREVIEW = 2;

export type DailyQuestion = { id: string; text: string; date: string; postId: string; answerCount: number };

type Row = { id: string; text: string; text_en: string | null; active_date: string; post_id: string | null; answer_count: number };

/** Teksti në gjuhën e app-it; pa anglisht, shqip. */
export function questionText(row: { text: string; text_en: string | null }, lang: "sq" | "en"): string {
  return lang === "en" && row.text_en?.trim() ? row.text_en.trim() : row.text.trim();
}

/** Përgjigja e vlefshme: 1–280 shkronja pas pastrimit; null kur s'është. */
export function cleanAnswer(text: string): string | null {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length >= 1 && t.length <= DAILY_ANSWER_MAX ? t : null;
}

/** Rreshti i serverit → pyetja e sotme; null kur s'ka (karta s'shfaqet). */
export function toDailyQuestion(rows: Row[] | null | undefined, lang: "sq" | "en"): DailyQuestion | null {
  const r = rows?.[0];
  if (!r || !r.post_id) return null;
  return { id: r.id, text: questionText(r, lang), date: r.active_date, postId: r.post_id, answerCount: Number(r.answer_count) || 0 };
}

/** Përgjigjet (komentet e para), më të rejat para; përgjigjet ndaj tyre s'numërohen. */
export function latestAnswers(comments: CommunityComment[], limit: number = CARD_PREVIEW): CommunityComment[] {
  return comments
    .filter((c) => c.parentId === null)
    .sort((a, b) => (a.at < b.at ? 1 : -1))
    .slice(0, limit);
}

/** Përgjigja ime te kjo pyetje (një e vetme), ose null. */
export function myAnswer(comments: CommunityComment[], myId: string | null): CommunityComment | null {
  if (!myId) return null;
  return comments.find((c) => c.parentId === null && c.authorId === myId) ?? null;
}

/** Gabimet e bazës → teksti për prindin. */
export function answerErrorKey(err: unknown): TranslationKey {
  const msg = err instanceof Error ? err.message : String((err as { message?: string })?.message ?? err);
  if (msg.includes("daily_answer_exists")) return "dq_err_exists";
  if (msg.includes("daily_answer_length")) return "dq_err_length";
  return "dq_save_failed";
}

/** Pyetja e sotme (serveri krijon postimin bazë herën e parë), ose null. */
export async function fetchTodayQuestion(lang: "sq" | "en"): Promise<DailyQuestion | null> {
  const { data, error } = await supabase.rpc("today_daily_question");
  if (error) throw error;
  return toDailyQuestion(data as Row[] | null, lang);
}

/** Ndrysho përgjigjen time (komentet s'kanë UPDATE: kalon nga baza, me kufirin 280). */
export async function editDailyAnswer(commentId: string, text: string): Promise<void> {
  const clean = cleanAnswer(text);
  if (!clean) throw new Error("daily_answer_length");
  const { error } = await supabase.rpc("edit_daily_answer", { p_comment: commentId, p_text: clean });
  if (error) throw new Error(error.message);
}
