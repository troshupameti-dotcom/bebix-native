import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

function isMonthDayMatch(dobStr: string, target: Date): boolean {
  const dob = new Date(dobStr);
  return dob.getUTCMonth() === target.getUTCMonth() && dob.getUTCDate() === target.getUTCDate();
}

serve(async () => {
  const today = new Date();
  const in7Days = new Date(today);
  in7Days.setUTCDate(today.getUTCDate() + 7);

  const { data: babies, error } = await supabase
    .from("baby_profiles")
    .select("user_id, baby_name, baby_dob");

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  const birthdayToday = (babies ?? []).filter((b) => b.baby_dob && isMonthDayMatch(b.baby_dob, today));
  const giftReminder = (babies ?? []).filter((b) => b.baby_dob && isMonthDayMatch(b.baby_dob, in7Days));

  const messages: { to: string; title: string; body: string; sound: string }[] = [];

  for (const b of birthdayToday) {
    const { data: tokens } = await supabase.from("push_tokens").select("expo_push_token").eq("user_id", b.user_id);
    (tokens ?? []).forEach((t) =>
      messages.push({
        to: t.expo_push_token,
        title: "🎂 Gëzuar ditëlindjen!",
        body: `Sot ${b.baby_name ?? "bebi"} feston ditëlindjen! 🎉`,
        sound: "default",
      })
    );
  }

  for (const b of giftReminder) {
    const { data: tokens } = await supabase.from("push_tokens").select("expo_push_token").eq("user_id", b.user_id);
    (tokens ?? []).forEach((t) =>
      messages.push({
        to: t.expo_push_token,
        title: "🎁 Kujtesë dhurate",
        body: `Ditëlindja e ${b.baby_name ?? "bebit"} âsht pas 7 ditësh — koha me ble dhuratën!`,
        sound: "default",
      })
    );
  }

  if (messages.length > 0) {
    await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(messages),
    });
  }

  return new Response(JSON.stringify({ sent: messages.length }), {
    headers: { "Content-Type": "application/json" },
    status: 200,
  });
});