import { supabase } from "@/lib/supabase/client";
import type { CommentExpert } from "@/lib/communityData";
import type { TranslationKey } from "@/lib/i18n/translations";

/**
 * "Pyet ekspertin": pyetje private te një ekspert i verifikuar i repartit të
 * zgjedhur. Prindi lexon dhe fshin vetëm të vetat (RLS); ekspertët marrin
 * radhën nga `list_expert_inbox()` — pa asnjë të dhënë të prindit. Shkrimi
 * bëhet vetëm me funksionet e bazës (limiti 3 në javë kontrollohet atje).
 * Asgjë s'publikohet në feed.
 */

export const BODY_MIN = 20;
export const BODY_MAX = 600;
export const ANSWER_MIN = 20;
export const ANSWER_MAX = 1500;
export const WEEKLY_LIMIT = 3;
/** Reparti i parazgjedhur te forma. */
export const DEFAULT_SPECIALTY = "pediatrician";

export type QuestionStatus = "pending" | "claimed" | "answered" | "closed";

export type MyQuestion = {
  id: string;
  specialty: string;
  body: string;
  babyAgeMonths: number | null;
  status: QuestionStatus;
  answer: string | null;
  createdAt: string;
  answeredAt: string | null;
  unread: boolean;
  expert: { name: string; badge: CommentExpert } | null;
};

export type InboxQuestion = {
  id: string;
  specialty: string;
  body: string;
  babyAgeMonths: number | null;
  createdAt: string;
  claimedByMine: boolean;
};

/** Teksti i pyetjes (20–600 shkronja pas pastrimit), ose null. */
export function cleanBody(text: string): string | null {
  const t = text.replace(/[ \t]+/g, " ").trim();
  return t.length >= BODY_MIN && t.length <= BODY_MAX ? t : null;
}

/** Teksti i përgjigjes (20–1500), ose null. */
export function cleanAnswer(text: string): string | null {
  const t = text.trim();
  return t.length >= ANSWER_MIN && t.length <= ANSWER_MAX ? t : null;
}

/** Për prindin: "Në pritje" edhe kur një ekspert e ka marrë. */
export function statusKey(s: QuestionStatus): TranslationKey {
  if (s === "answered") return "eq_status_answered";
  if (s === "closed") return "eq_status_closed";
  return "eq_status_pending";
}

/** Prindi mund ta mbyllë vetëm kur pret ende përgjigje. */
export const canClose = (s: QuestionStatus) => s === "pending" || s === "claimed";

/** Pyetja i përket repartit të ekspertit (eksperti pa repart s'merr pyetje). */
export function matchesSpecialty(questionSpecialty: string, expertSpecialty: string | null): boolean {
  return !!expertSpecialty && questionSpecialty === expertSpecialty;
}

/** Sa orë pret pyetja. */
export function waitingHours(createdAt: string, now: Date = new Date()): number {
  return Math.max(0, Math.floor((now.getTime() - new Date(createdAt).getTime()) / 3_600_000));
}

/** "tani" / "pret prej 5 orësh" / "pret prej 2 ditësh" (nga 48 orë e lart). */
export function waitingLabel(createdAt: string, t: (k: TranslationKey, p?: Record<string, string | number>) => string, now: Date = new Date()): string {
  const h = waitingHours(createdAt, now);
  if (h < 1) return t("eq_wait_new");
  if (h < 48) return t("eq_wait_hours", { n: h });
  return t("eq_wait_days", { n: Math.floor(h / 24) });
}

/**
 * Mosha e bebit në muaj të plotë nga datëlindja ("YYYY-MM-DD"), ose null kur
 * s'ka datë, data është e pavlefshme ose në të ardhmen. Vetëm ky numër shkon
 * te eksperti — kurrë data.
 */
export function ageInMonths(dob: string | null | undefined, now: Date = new Date()): number | null {
  if (!dob) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dob);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  let months = (now.getFullYear() - y) * 12 + (now.getMonth() + 1 - mo);
  if (now.getDate() < d) months -= 1;
  if (months < 0 || months > 240) return null;
  return months;
}

/** Gabimet e bazës → çelësi i tekstit për prindin/ekspertin. */
export function errorKey(err: unknown): TranslationKey {
  const msg = err instanceof Error ? err.message : String((err as { message?: string })?.message ?? err);
  if (msg.includes("weekly_limit")) return "eq_err_limit";
  if (msg.includes("claimed_by_other") || msg.includes("already_answered")) return "eq_err_taken";
  if (msg.includes("closed")) return "eq_err_closed";
  return "eq_err_generic";
}

/** Tabela s'ekziston (migrimi s'është ekzekutuar ende): PostgREST e kthen si PGRST205, Postgres si 42P01. */
export function isMissingTable(error: { code?: string } | null): boolean {
  return !!error && (error.code === "PGRST205" || error.code === "42P01");
}

// --- Prindi -----------------------------------------------------------------

export async function askExpertQuestion(specialty: string, body: string, babyAgeMonths: number | null): Promise<void> {
  const clean = cleanBody(body);
  if (!clean) throw new Error("bad_body");
  const { error } = await supabase.rpc("ask_expert_question", { p_specialty: specialty, p_body: clean, p_baby_age_months: babyAgeMonths });
  if (error) throw new Error(error.message);
}

/** Sa pyetje mund të dërgojë ende këtë javë (nga baza: edhe pas fshirjeve). */
export async function fetchRemaining(): Promise<number | null> {
  const { data, error } = await supabase.rpc("expert_questions_remaining");
  if (error || typeof data !== "number") return null;
  return data;
}

type Row = {
  id: string; specialty_key: string; body: string; baby_age_months: number | null; status: QuestionStatus;
  answer: string | null; created_at: string; answered_at: string | null; answer_read_at: string | null; expert_id: string | null;
};

export async function fetchMyQuestions(): Promise<MyQuestion[]> {
  const { data, error } = await supabase
    .from("expert_questions")
    .select("id, specialty_key, body, baby_age_months, status, answer, created_at, answered_at, answer_read_at, expert_id")
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
    specialty: r.specialty_key,
    body: r.body,
    babyAgeMonths: r.baby_age_months,
    status: r.status,
    answer: r.answer,
    createdAt: r.created_at,
    answeredAt: r.answered_at,
    unread: r.status === "answered" && !r.answer_read_at,
    expert: r.status === "answered" && r.expert_id ? (experts.get(r.expert_id) ?? null) : null,
  }));
}

/**
 * Sa përgjigje të palexuara ka prindi (pika e kuqe), dhe a ekziston fare veçoria
 * në server: pa migrimin, butonat s'shfaqen, që prindi të mos shkruajë një pyetje
 * që s'dërgohet dot.
 */
export async function fetchExpertQuestionsStatus(): Promise<{ available: boolean; unread: number }> {
  // GET me limit 0 (jo HEAD): vetëm kështu gabimi vjen me kodin e tij.
  const { count, error } = await supabase
    .from("expert_questions")
    .select("id", { count: "exact" })
    .eq("status", "answered")
    .is("answer_read_at", null)
    .limit(0);
  if (isMissingTable(error)) return { available: false, unread: 0 };
  return { available: true, unread: error ? 0 : (count ?? 0) };
}

/** Përgjigjet e palexuara për listën e Njoftimeve (vetëm id, ora dhe eksperti). */
export async function fetchUnreadAnswers(): Promise<{ id: string; answeredAt: string; expertName: string | null }[]> {
  const { data, error } = await supabase
    .from("expert_questions")
    .select("id, answered_at, expert_id")
    .eq("status", "answered")
    .is("answer_read_at", null)
    .order("answered_at", { ascending: false })
    .limit(20);
  if (error || !data?.length) return [];
  const rows = data as { id: string; answered_at: string | null; expert_id: string | null }[];
  const ids = [...new Set(rows.map((r) => r.expert_id).filter((x): x is string => !!x))];
  const names = new Map<string, string>();
  if (ids.length) {
    const { data: ex } = await supabase.from("community_experts").select("user_id, name").in("user_id", ids);
    for (const e of (ex ?? []) as { user_id: string; name: string }[]) names.set(e.user_id, e.name);
  }
  return rows
    .filter((r) => !!r.answered_at)
    .map((r) => ({ id: r.id, answeredAt: r.answered_at as string, expertName: r.expert_id ? (names.get(r.expert_id) ?? null) : null }));
}

/** Shëno të lexuar një përgjigje, ose të gjitha (pa id). */
export async function markAnswerRead(id?: string): Promise<void> {
  await supabase.rpc("mark_answer_read", { p_id: id ?? null });
}

/** false = s'mbyllej më (ndërkohë mori përgjigje). */
export async function closeQuestion(id: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("close_expert_question", { p_id: id });
  if (error) throw new Error(error.message);
  return data === true;
}

export async function deleteQuestion(id: string): Promise<void> {
  const { error } = await supabase.from("expert_questions").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// --- Eksperti ---------------------------------------------------------------

export async function isVerifiedExpert(): Promise<boolean> {
  const { data, error } = await supabase.rpc("is_verified_expert");
  return !error && data === true;
}

export async function fetchInbox(): Promise<InboxQuestion[]> {
  const { data, error } = await supabase.rpc("list_expert_inbox");
  if (error) throw error;
  return (
    (data ?? []) as { id: string; specialty_key: string; body: string; baby_age_months: number | null; created_at: string; claimed_by_me: boolean }[]
  ).map((r) => ({
    id: r.id,
    specialty: r.specialty_key,
    body: r.body,
    babyAgeMonths: r.baby_age_months,
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

/** "Kalo": e kthen në radhë për ekspertët e tjerë. */
export async function passQuestion(id: string): Promise<void> {
  const { error } = await supabase.rpc("pass_expert_question", { p_id: id });
  if (error) throw new Error(error.message);
}

export async function answerQuestion(id: string, answer: string): Promise<void> {
  const clean = cleanAnswer(answer);
  if (!clean) throw new Error("bad_answer");
  const { error } = await supabase.rpc("answer_expert_question", { p_id: id, p_answer: clean });
  if (error) throw new Error(error.message);
}
