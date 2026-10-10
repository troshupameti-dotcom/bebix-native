import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/lib/supabase/client";

/**
 * Kalendari i zhvillimit: "Këtë javë bebi mëson…" + 3 ide loje, sipas javës
 * së jetës. Përmbajtja vjen nga tabela `development_weeks` (e ndryshon admini
 * pa përditësim të app-it) dhe ruhet në telefon për përdorim pa internet.
 */

export type DevelopmentWeek = { weekFrom: number; weekTo: number; title: string; body: string; ideas: string[] };

const DAY = 86_400_000;
/** Përmbajtja rifreskohet një herë në ditë (admini mund ta ketë ndryshuar). */
export const CACHE_MS = DAY;

/** Java e jetës (0 = java e parë), ose null pa datëlindje / në të ardhmen. */
export function weekOfLife(dob: string | null, now: Date = new Date()): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dob ?? "");
  if (!m) return null;
  const born = new Date(+m[1], +m[2] - 1, +m[3]).getTime();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (born > today) return null;
  return Math.floor(Math.round((today - born) / DAY) / 7);
}

type Cached = DevelopmentWeek & { fetchedAt: number };

export function cacheCovers(c: Cached | null, week: number, now: number = Date.now()): boolean {
  return !!c && week >= c.weekFrom && week <= c.weekTo && now - c.fetchedAt < CACHE_MS;
}

const cacheKey = (lang: "sq" | "en") => `bebix_dev_week_v1:${lang}`;

export async function loadDevelopmentWeek(week: number, lang: "sq" | "en"): Promise<DevelopmentWeek | null> {
  let cached: Cached | null = null;
  try {
    const raw = await AsyncStorage.getItem(cacheKey(lang));
    cached = raw ? (JSON.parse(raw) as Cached) : null;
  } catch {
    cached = null;
  }
  if (cacheCovers(cached, week)) return cached;

  try {
    const { data, error } = await supabase
      .from("development_weeks")
      .select("week_from, week_to, title, body, ideas")
      .eq("lang", lang)
      .eq("is_active", true)
      .lte("week_from", week)
      .gte("week_to", week)
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const row: Cached = { weekFrom: data.week_from, weekTo: data.week_to, title: data.title, body: data.body, ideas: data.ideas ?? [], fetchedAt: Date.now() };
    AsyncStorage.setItem(cacheKey(lang), JSON.stringify(row)).catch(() => {});
    return row;
  } catch {
    // Pa internet: përmbajtja e ruajtur, nëse i përket ende kësaj jave.
    return cached && week >= cached.weekFrom && week <= cached.weekTo ? cached : null;
  }
}
