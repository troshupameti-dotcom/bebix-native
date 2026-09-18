import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Fshirja e llogarisë.
 *
 * Kërkohet nga Google Play (çdo app me krijim llogarie duhet të ofrojë
 * fshirje brenda app-it) dhe nga GDPR ("e drejta për t'u harruar").
 *
 * Pse funksion i veçantë: klienti NUK mund ta fshijë vetë përdoruesin te
 * `auth.users` — kjo kërkon service_role. Po ashtu, asnjë çelës i huaj në
 * këtë projekt nuk tregon nga `auth.users`, pra fshirja e përdoruesit do
 * t'i linte të dhënat jetime. Këtu fshihen shprehimisht, tabelë për tabelë.
 *
 * Çfarë NUK fshihet: porositë. Te to varen `order_items`, komisionet dhe
 * payouts e partnerëve. Ato anonimizohen (user_id -> null, të dhënat
 * personale zëvendësohen) që të mbetet vetëm fakti tregtar.
 */

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Fshin gjithçka nën `<userId>/` në një bucket, faqe pas faqeje. */
async function removeUserFiles(bucket: string, userId: string): Promise<number> {
  let removed = 0;
  for (let page = 0; page < 50; page++) {
    const { data, error } = await admin.storage.from(bucket).list(userId, { limit: 100, offset: 0 });
    if (error || !data || data.length === 0) break;

    const paths = data.map((file) => `${userId}/${file.name}`);
    const { error: removeError } = await admin.storage.from(bucket).remove(paths);
    if (removeError) break;

    removed += paths.length;
    if (data.length < 100) break;
  }
  return removed;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  // --- Kush po e kërkon? Vetëm vetja mund ta fshijë veten.
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace("Bearer ", "").trim();
  if (!token) return json({ error: "Mungon token-i i sesionit." }, 401);

  const caller = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });

  const { data: userData, error: userError } = await caller.auth.getUser();
  const user = userData?.user;
  if (userError || !user) return json({ error: "Sesion i pavlefshëm." }, 401);

  const userId = user.id;

  // --- Mbrojtje: llogaritë e adminit dhe të partnerëve mbajnë biznesin.
  // Fshirja e tyre nga app-i do të hiqte aksesin te porositë dhe inventari.
  const [{ data: isAdmin }, { data: isPartner }] = await Promise.all([
    admin.from("admins").select("id").eq("user_id", userId).maybeSingle(),
    admin.from("partner_users").select("id").eq("user_id", userId).maybeSingle(),
  ]);

  if (isAdmin || isPartner) {
    return json(
      {
        error:
          "Kjo llogari është e lidhur me panelin e adminit ose me një partner. " +
          "Na shkruaj që ta shkëputim së pari, pastaj llogaria mund të fshihet.",
      },
      409
    );
  }

  const report: Record<string, number | string> = {};

  // --- 1. Skedarët: fotot e momenteve (private) dhe media e komunitetit.
  report.baby_moment_files = await removeUserFiles("baby-moments", userId);
  report.community_files = await removeUserFiles("community-media", userId);

  // --- 2. Të dhënat e bebit — pjesa më e ndjeshme.
  const tables: { table: string; column: string }[] = [
    { table: "baby_records", column: "user_id" },
    { table: "baby_profiles", column: "user_id" },
    { table: "push_tokens", column: "user_id" },
    // Komuniteti: reagimet e veta para përmbajtjes, që të mos mbeten të varura.
    { table: "community_post_likes", column: "user_id" },
    { table: "community_post_saves", column: "user_id" },
    { table: "community_expert_follows", column: "user_id" },
    { table: "community_group_members", column: "user_id" },
    { table: "community_reports", column: "reporter_id" },
    { table: "community_comments", column: "author_id" },
    { table: "community_posts", column: "author_id" },
    { table: "community_experts", column: "user_id" },
    { table: "expert_applications", column: "user_id" },
  ];

  for (const { table, column } of tables) {
    const { error, count } = await admin
      .from(table)
      .delete({ count: "exact" })
      .eq(column, userId);
    report[table] = error ? `gabim: ${error.message}` : count ?? 0;
  }

  // Bllokimet në të dy drejtimet.
  const { count: blocksMade } = await admin
    .from("community_blocks")
    .delete({ count: "exact" })
    .eq("blocker_id", userId);
  const { count: blocksReceived } = await admin
    .from("community_blocks")
    .delete({ count: "exact" })
    .eq("blocked_id", userId);
  report.community_blocks = (blocksMade ?? 0) + (blocksReceived ?? 0);

  // --- 3. Porositë: anonimizohen, nuk fshihen.
  const { count: anonymised, error: ordersError } = await admin
    .from("orders")
    .update(
      {
        user_id: null,
        full_name: "(llogari e fshirë)",
        phone: "",
        address: "",
        city: "",
      },
      { count: "exact" }
    )
    .eq("user_id", userId);
  report.orders_anonymised = ordersError ? `gabim: ${ordersError.message}` : anonymised ?? 0;

  // --- 4. Vetë llogaria. E fundit: nëse diçka më lart dështon, përdoruesi
  // ende mund të kyçet dhe ta provojë sërish.
  const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
  if (deleteError) {
    return json({ error: `Llogaria nuk u fshi: ${deleteError.message}`, report }, 500);
  }

  return json({ ok: true, report });
});
