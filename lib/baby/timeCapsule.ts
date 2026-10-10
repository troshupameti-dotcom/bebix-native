import { supabase } from "@/lib/supabase/client";

/**
 * Kapsula e kohës: letra për fëmijën, të vulosura deri në një datë.
 * Mbyllja e ruan serveri (supabase/migrations/20261010090000_time_capsule.sql):
 * teksti s'merret dot para datës, as me SELECT, as nga ky app.
 */

export type CapsuleLetter = {
  id: string;
  ownerId: string;
  authorId: string | null;
  title: string;
  /** "2044-03-15" */
  unlockOn: string;
  createdAt: string;
};

const pad = (n: number) => String(n).padStart(2, "0");
export const toDateKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Ditëlindja e 18-të; pa datëlindje, 18 vjet nga sot. */
export function defaultUnlockDate(babyDob: string | null, now: Date = new Date()): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(babyDob ?? "");
  const base = m ? new Date(+m[1], +m[2] - 1, +m[3]) : now;
  const d = new Date(base.getFullYear() + 18, base.getMonth(), base.getDate());
  // Nëse fëmija është mbi 18 (s'ka gjasa), një vit nga sot.
  return toDateKey(d > now ? d : new Date(now.getFullYear() + 1, now.getMonth(), now.getDate()));
}

export function isUnlocked(unlockOn: string, now: Date = new Date()): boolean {
  return unlockOn <= toDateKey(now);
}

/** Sa ditë kanë mbetur (0 kur hapet sot ose ka kaluar). */
export function daysUntil(unlockOn: string, now: Date = new Date()): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(unlockOn);
  if (!m) return 0;
  const target = new Date(+m[1], +m[2] - 1, +m[3]).getTime();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.max(0, Math.round((target - today) / 86_400_000));
}

/** Data e hapjes duhet të jetë nesër ose më vonë, jo më larg se 30 vjet. */
export function isValidUnlockDate(unlockOn: string, now: Date = new Date()): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(unlockOn)) return false;
  const tomorrow = toDateKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1));
  const max = toDateKey(new Date(now.getFullYear() + 30, now.getMonth(), now.getDate()));
  return unlockOn >= tomorrow && unlockOn <= max;
}

type Row = { id: string; owner_id: string; author_id: string | null; title: string; unlock_on: string; created_at: string };

export async function listLetters(): Promise<CapsuleLetter[]> {
  // Kolonat me emër: `select *` refuzohet, sepse teksti s'lexohet.
  const { data, error } = await supabase
    .from("time_capsule_letters")
    .select("id, owner_id, author_id, title, unlock_on, created_at")
    .order("unlock_on", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as Row[]).map((r) => ({
    id: r.id,
    ownerId: r.owner_id,
    authorId: r.author_id,
    title: r.title,
    unlockOn: r.unlock_on,
    createdAt: r.created_at,
  }));
}

export async function sealLetter(title: string, body: string, unlockOn: string): Promise<string> {
  const { data, error } = await supabase.rpc("seal_capsule_letter", { p_title: title.trim(), p_body: body, p_unlock_on: unlockOn });
  if (error) throw error;
  return data as string;
}

/** Teksti, vetëm kur ka ardhur data; përndryshe null. */
export async function openLetter(id: string): Promise<string | null> {
  const { data, error } = await supabase.rpc("open_capsule_letter", { p_id: id });
  if (error) throw error;
  return (data as string | null) ?? null;
}

export async function deleteLetter(id: string): Promise<void> {
  const { error } = await supabase.from("time_capsule_letters").delete().eq("id", id);
  if (error) throw error;
}
