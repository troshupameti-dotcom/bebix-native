import { supabase } from "@/lib/supabase/client";

export type GameSuggestion = {
  title: string;
  description: string;
  benefit: string;
  durationMin: number;
};

export async function fetchGameRecommendations(ageMonths: number): Promise<GameSuggestion[]> {
  const { data, error } = await supabase.functions.invoke("recommend-baby-games", {
    body: { ageMonths },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data?.games ?? [];
}

export function ageInMonths(dob: string | null): number | null {
  if (!dob) return null;
  const birth = new Date(dob);
  const now = new Date();
  let months = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
  if (now.getDate() < birth.getDate()) months -= 1;
  return Math.max(0, months);
}