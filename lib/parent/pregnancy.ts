import { supabase } from "@/lib/supabase/client";

/**
 * Përmbajtja e javës së shtatzënisë nga tabela `pregnancy_weeks` (e shkruan Meti; fillimisht bosh).
 * Kur s'ka përmbajtje, s'ka rrjet, ose tabela s'ekziston ende: null, dhe kreu tregon vetëm javën dhe ditët.
 */
export type PregnancyWeek = { weekFrom: number; weekTo: number; title: string; body: string; ideas: string[] };

export async function loadPregnancyWeek(week: number, lang: "sq" | "en"): Promise<PregnancyWeek | null> {
  try {
    const { data, error } = await supabase
      .from("pregnancy_weeks")
      .select("week_from, week_to, title, body, ideas")
      .eq("lang", lang)
      .eq("is_active", true)
      .lte("week_from", week)
      .gte("week_to", week)
      .limit(1)
      .maybeSingle();
    if (error || !data) return null;
    return { weekFrom: data.week_from, weekTo: data.week_to, title: data.title, body: data.body, ideas: data.ideas ?? [] };
  } catch {
    return null;
  }
}
