import { useSyncExternalStore } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/lib/supabase/client";
import type { TranslationKey } from "@/lib/i18n/translations";

/**
 * "Si je sot?" — prindi zgjedh 1–5 (+ shënim nëse do). PRIVAT: ruhet në
 * telefon dhe te serveri vetëm për llogarinë e tij (RLS), jo për partnerin.
 * Pa faj: s'ka seri ditësh, s'ka "harrove". Kur disa ditë rresht janë të
 * rënda, del një mesazh i ngrohtë me ndihmë — kurrë alarmues.
 */

export type Mood = 1 | 2 | 3 | 4 | 5;
export type CheckIn = { day: string; mood: Mood; note: string | null; updatedAt: string; synced: boolean };
export type CheckInPrefs = { enabled: boolean; skippedDay: string | null };

const pad = (n: number) => String(n).padStart(2, "0");
export const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const daysAgo = (now: Date, n: number) => dayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - n));

export const MOOD_EMOJI: Record<Mood, string> = { 1: "😫", 2: "😕", 3: "😐", 4: "🙂", 5: "😄" };

/** Këshilla e ditës: e butë kur je i/e lodhur, mirënjohje kur je mirë. Ndryshon me ditën. */
export function tipKeyFor(mood: Mood, day: string): TranslationKey {
  if (mood >= 4) return "ci_tip_high";
  if (mood === 3) return "ci_tip_mid";
  const n = Number(day.replace(/-/g, "")) % 3;
  return (["ci_tip_low_1", "ci_tip_low_2", "ci_tip_low_3"] as const)[n];
}

/** Sa ditë të rënda (≤ 2) në 7 ditët e fundit duhen që të ofrohet ndihmë. */
export const SUPPORT_LOW_DAYS = 3;

export function needsSupport(list: CheckIn[], now: Date = new Date()): boolean {
  const from = daysAgo(now, 6);
  return list.filter((c) => c.day >= from && c.day <= dayKey(now) && c.mood <= 2).length >= SUPPORT_LOW_DAYS;
}

/** 14 ditët e fundit (më e vjetra e para), me notën ose bosh. */
export function recentDays(list: CheckIn[], now: Date = new Date(), n = 14): { day: string; mood: Mood | null }[] {
  const byDay = new Map(list.map((c) => [c.day, c.mood]));
  return Array.from({ length: n }, (_, i) => {
    const day = daysAgo(now, n - 1 - i);
    return { day, mood: byDay.get(day) ?? null };
  });
}

/** Pyetja del sot? Jo kur është fikur, kur u përgjigj, ose kur u tha "Jo sot". */
export function shouldAsk(prefs: CheckInPrefs, list: CheckIn[], now: Date = new Date()): boolean {
  const today = dayKey(now);
  return prefs.enabled && prefs.skippedDay !== today && !list.some((c) => c.day === today);
}

/** Shkrirja me serverin: fiton më i riu; ai lokal që s'është dërguar ende s'humbet. */
export function mergeCheckins(local: CheckIn[], remote: CheckIn[]): CheckIn[] {
  const map = new Map(local.map((c) => [c.day, c]));
  for (const r of remote) {
    const l = map.get(r.day);
    if (!l || (l.synced && r.updatedAt >= l.updatedAt) || (!l.synced && r.updatedAt > l.updatedAt)) map.set(r.day, { ...r, synced: true });
  }
  return [...map.values()].sort((a, b) => (a.day < b.day ? -1 : 1));
}

// --- Ruajtja (e përbashkët për kartën dhe ekranin "Kujdesi për ty") -----------

const LIST_KEY = "bebix_parent_checkins_v1";
const PREFS_KEY = "bebix_checkin_prefs_v1";
const KEEP_DAYS = 120;

type Store = { list: CheckIn[]; prefs: CheckInPrefs; loaded: boolean; /** Llogaria që i shkroi (telefon i përbashkët). */ owner: string | null };
let store: Store = { list: [], prefs: { enabled: true, skippedDay: null }, loaded: false, owner: null };
const listeners = new Set<() => void>();

function set(next: Partial<Store>) {
  store = { ...store, ...next };
  listeners.forEach((l) => l());
}

function persist() {
  const cutoff = daysAgo(new Date(), KEEP_DAYS);
  const list = store.list.filter((c) => c.day >= cutoff);
  AsyncStorage.setItem(LIST_KEY, JSON.stringify({ owner: store.owner, list })).catch(() => {});
  AsyncStorage.setItem(PREFS_KEY, JSON.stringify(store.prefs)).catch(() => {});
}

let loading = false;
function ensureLoaded() {
  if (store.loaded || loading) return;
  loading = true;
  void Promise.all([AsyncStorage.getItem(LIST_KEY), AsyncStorage.getItem(PREFS_KEY)])
    .then(([l, p]) => {
      const saved = l ? (JSON.parse(l) as { owner: string | null; list: CheckIn[] } | CheckIn[]) : null;
      set({
        list: Array.isArray(saved) ? saved : (saved?.list ?? []),
        owner: Array.isArray(saved) ? null : (saved?.owner ?? null),
        prefs: p ? { ...store.prefs, ...(JSON.parse(p) as Partial<CheckInPrefs>) } : store.prefs,
        loaded: true,
      });
      void syncCheckins();
    })
    .catch(() => set({ loaded: true }));
}

/** Dërgon të padërguarat dhe merr 30 ditët e fundit (p.sh. nga një telefon tjetër). */
export async function syncCheckins(): Promise<void> {
  try {
    const { data: session } = await supabase.auth.getSession();
    const userId = session.session?.user.id;
    if (!userId) return;
    // Telefon i përbashkët: shënimet e një llogarie tjetër s'shfaqen këtu.
    if (store.owner !== userId) set({ list: store.owner === null ? store.list : [], owner: userId });
    const pending = store.list.filter((c) => !c.synced);
    if (pending.length) {
      const { error } = await supabase
        .from("parent_checkins")
        .upsert(pending.map((c) => ({ day: c.day, mood: c.mood, note: c.note, updated_at: c.updatedAt })), { onConflict: "user_id,day" });
      if (!error) set({ list: store.list.map((c) => (pending.some((p) => p.day === c.day) ? { ...c, synced: true } : c)) });
    }
    const { data } = await supabase
      .from("parent_checkins")
      .select("day, mood, note, updated_at")
      .gte("day", daysAgo(new Date(), 30));
    if (data) {
      const remote = (data as { day: string; mood: Mood; note: string | null; updated_at: string }[]).map((r) => ({
        day: r.day, mood: r.mood, note: r.note, updatedAt: r.updated_at, synced: true,
      }));
      set({ list: mergeCheckins(store.list, remote) });
    }
    persist();
  } catch {
    // Pa rrjet ose pa migrimin: mbetet në telefon dhe dërgohet herën tjetër.
  }
}

export function saveCheckin(mood: Mood, note: string | null = null, now: Date = new Date()) {
  const day = dayKey(now);
  const prev = store.list.find((c) => c.day === day);
  const entry: CheckIn = { day, mood, note: note ?? prev?.note ?? null, updatedAt: now.toISOString(), synced: false };
  set({ list: [...store.list.filter((c) => c.day !== day), entry].sort((a, b) => (a.day < b.day ? -1 : 1)) });
  persist();
  void syncCheckins();
}

export function saveTodayNote(note: string, now: Date = new Date()) {
  const today = store.list.find((c) => c.day === dayKey(now));
  if (today) saveCheckin(today.mood, note.trim().slice(0, 500) || null, now);
}

export function skipCheckinToday(now: Date = new Date()) {
  set({ prefs: { ...store.prefs, skippedDay: dayKey(now) } });
  persist();
}

export function setCheckinEnabled(enabled: boolean) {
  set({ prefs: { ...store.prefs, enabled } });
  persist();
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  ensureLoaded();
  return () => listeners.delete(l);
};

export function useCheckins(): Store {
  return useSyncExternalStore(subscribe, () => store);
}
