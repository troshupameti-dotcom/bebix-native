import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/lib/supabase/client";
import type { TranslationKey } from "@/lib/i18n/translations";

/**
 * Grupet sipas moshës së bebit dhe kohës së lindjes: SUGJERIM me një prekje,
 * jo anëtarësim automatik. Mosha llogaritet në bazë
 * (supabase/migrations/20261015090000_auto_groups.sql); këtu vijnë vetëm
 * çelësat ("age:3-6", "birth:2026-Q4"), kurrë data e lindjes.
 *
 * Ndizet me EXPO_PUBLIC_AUTO_GROUPS=1 te EAS, pasi të jetë ekzekutuar SQL-i
 * (si GIFTS_ENABLED); pa të, s'shfaqet asgjë.
 */
export const AUTO_GROUPS_ENABLED = (process.env.EXPO_PUBLIC_AUTO_GROUPS ?? "").trim() === "1";

export type AutoKey = string;
export type Suggestion = { key: AutoKey; action: "join" | "leave" };

// --- Logjika e pastër (e njëjtë me community_auto_keys_for në bazë) ----------

/** Muaj të plotë nga data e lindjes deri sot; null kur data mungon ose është në të ardhmen. */
export function fullMonths(dob: Date, today: Date): number | null {
  const d = new Date(dob.getFullYear(), dob.getMonth(), dob.getDate());
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (Number.isNaN(d.getTime()) || d > t) return null;
  let months = (t.getFullYear() - d.getFullYear()) * 12 + (t.getMonth() - d.getMonth());
  if (t.getDate() < d.getDate()) months -= 1;
  return Math.max(0, months);
}

/** [0,3) [3,6) [6,12) [12,24); mbi 24 muaj: s'ka grup moshe. */
export function ageKeyForMonths(months: number | null): AutoKey | null {
  if (months == null || months < 0) return null;
  if (months < 3) return "age:0-3";
  if (months < 6) return "age:3-6";
  if (months < 12) return "age:6-12";
  if (months < 24) return "age:12-24";
  return null;
}

/** Tremujori i lindjes: grupe më të mëdha se ato mujore, që s'mbeten bosh. */
export function birthQuarterKey(dob: Date): AutoKey {
  return `birth:${dob.getFullYear()}-Q${Math.floor(dob.getMonth() / 3) + 1}`;
}

export function autoKeysFor(dob: Date | null, today: Date): AutoKey[] {
  if (!dob) return [];
  const months = fullMonths(dob, today);
  if (months == null) return [];
  const age = ageKeyForMonths(months);
  return [...(age ? [age] : []), birthQuarterKey(dob)];
}

export type ParsedKey = { kind: "age"; from: number; to: number } | { kind: "birth"; year: number; quarter: 1 | 2 | 3 | 4 };

export function parseAutoKey(key: string): ParsedKey | null {
  const age = /^age:(\d{1,2})-(\d{1,2})$/.exec(key);
  if (age) return { kind: "age", from: Number(age[1]), to: Number(age[2]) };
  const birth = /^birth:(\d{4})-Q([1-4])$/.exec(key);
  if (birth) return { kind: "birth", year: Number(birth[1]), quarter: Number(birth[2]) as 1 | 2 | 3 | 4 };
  return null;
}

type T = (key: TranslationKey, params?: Record<string, string | number>) => string;

/** Emri i grupit në gjuhën e app-it ("Bebat 3–6 muaj", "Born Oct–Dec 2026"). */
export function autoGroupLabel(key: string, t: T): string {
  const p = parseAutoKey(key);
  if (!p) return key;
  if (p.kind === "age") return t("ag_age_label", { from: p.from, to: p.to });
  return t("ag_birth_label", { range: t(`ag_q${p.quarter}` as TranslationKey), year: p.year });
}

/** "Bebi po rritet": një grup moshe për t'u bashkuar dhe një tjetër për t'u lënë. */
export function growthPair(list: Suggestion[]): { join: AutoKey; leave: AutoKey } | null {
  const join = list.find((s) => s.action === "join" && s.key.startsWith("age:"));
  const leave = list.find((s) => s.action === "leave" && s.key.startsWith("age:"));
  return join && leave ? { join: join.key, leave: leave.key } : null;
}

// --- "Jo tash" (30 ditë, vetëm në këtë telefon) ------------------------------

const SNOOZE_KEY = "bebix_auto_groups_snooze_v1";
export const SNOOZE_DAYS = 30;

export function activeSnoozes(stored: Record<string, string>, now: Date = new Date()): Set<string> {
  return new Set(Object.entries(stored).filter(([, until]) => new Date(until).getTime() > now.getTime()).map(([k]) => k));
}

export async function loadSnoozes(): Promise<Record<string, string>> {
  try {
    const raw = await AsyncStorage.getItem(SNOOZE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

export async function snooze(key: AutoKey, now: Date = new Date()): Promise<Record<string, string>> {
  const current = await loadSnoozes();
  const next = { ...current, [key]: new Date(now.getTime() + SNOOZE_DAYS * 86_400_000).toISOString() };
  await AsyncStorage.setItem(SNOOZE_KEY, JSON.stringify(next)).catch(() => {});
  return next;
}

// --- Serveri ---------------------------------------------------------------

/** Sugjerimet për bebin tim (bosh pa bebe, pa datëlindje, ose para migrimit). */
export async function fetchGroupSuggestions(): Promise<Suggestion[]> {
  const { data, error } = await supabase.rpc("suggest_community_groups");
  if (error) return [];
  return ((data ?? []) as { auto_key: string; action: string }[])
    .filter((r) => parseAutoKey(r.auto_key) && (r.action === "join" || r.action === "leave"))
    .map((r) => ({ key: r.auto_key, action: r.action as "join" | "leave" }));
}

/** Bashkohu me grupin e sugjeruar; kthen id-në e grupit. */
export async function joinSuggestedGroup(key: AutoKey): Promise<string> {
  const { data, error } = await supabase.rpc("join_suggested_group", { p_key: key });
  if (error) throw new Error(error.message);
  return data as string;
}

/** Dil nga një grup moshe/lindjeje (anëtarësia s'hiqet kurrë vetë). */
export async function leaveAutoGroup(key: AutoKey): Promise<void> {
  const { data: session } = await supabase.auth.getSession();
  const uid = session.session?.user.id;
  if (!uid) throw new Error("Duhet të jesh i kyçur.");
  const { data: group } = await supabase.from("community_groups").select("id").eq("auto_key", key).maybeSingle();
  if (!group) return;
  const { error } = await supabase.from("community_group_members").delete().eq("group_id", group.id).eq("user_id", uid);
  if (error) throw new Error(error.message);
}
