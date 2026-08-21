import { supabase } from "@/lib/supabase/client";

/**
 * Sinkronizon emrin dhe datëlindjen e bebit te Supabase (tabela
 * `baby_profiles`) — nevojitet sepse skeduluesi i notifications
 * (Edge Function + cron) xhirohet në server dhe s'ka qasje te
 * AsyncStorage lokal i telefonit. Thirre çdo herë që ndryshon emri
 * ose data e lindjes (psh te "save()" te Cilësimet e bebit).
 */
export async function syncBabyProfileToSupabase(babyName: string | null, babyDobIso: string | null) {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData?.user?.id;
  if (!userId) return;

  const { error } = await supabase.from("baby_profiles").upsert(
    {
      user_id: userId,
      baby_name: babyName,
      baby_dob: babyDobIso ? babyDobIso.slice(0, 10) : null, // vetëm YYYY-MM-DD
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  if (error) console.log("Gabim gjatë sinkronizimit të profilit të bebit:", error.message);
}