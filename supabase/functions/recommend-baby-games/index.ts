import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Anthropic from "npm:@anthropic-ai/sdk@0.131.0";

/**
 * Lojëra për moshën e fëmijës (ekrani "Lojëra" i bebit). App-i dërgon `ageMonths` dhe merr 4 lojëra.
 *
 * Mbrojtjet (auditimi, gjetja #74): AI vetëm për llogaritë e kyçura dhe brenda kufirit ditor të përbashkët
 * me asistentin (`ai_take_quota`); mysafiri, kufiri i arritur, mungesa e çelësit ose çdo gabim i Claude-it
 * kthejnë listën e gatshme më poshtë, që ekrani të mos mbetet kurrë bosh. Udhëzimi i Claude-it ka rregullat
 * e sigurisë (pa objekte të vogla nën 3 vjeç, gjithmonë me të rritur pranë) dhe kërkon shqip standard.
 * Model: Claude Haiku 5.5 me përpjekje të ulët (detyrë e thjeshtë); mund të ndryshohet me GAMES_MODEL.
 */

type Game = { title: string; description: string; benefit: string; durationMin: number };

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const apiKey = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
const MODEL = Deno.env.get("GAMES_MODEL") ?? "claude-haiku-5-5";
const DAILY_LIMIT = Number(Deno.env.get("AI_DAILY_LIMIT") ?? "30");
const MAX_AGE_MONTHS = 144;

const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
const anthropic = apiKey ? new Anthropic({ apiKey }) : null;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

// Lista e gatshme sipas moshës (muaj). Nën 3 vjeç: vetëm sende të mëdha, asgjë që gëlltitet.
const FALLBACK: { max: number; games: Game[] }[] = [
  { max: 2, games: [
    { title: "Koha në bark me pasqyrë", description: "Vendose bebin mbi bark për disa minuta, me një pasqyrë të sigurt para tij. Qëndro pranë gjatë gjithë kohës.", benefit: "Forcon qafën dhe krahët", durationMin: 5 },
    { title: "Shikim sy më sy", description: "Afrohu, buzëqesh dhe fol ngadalë ndërsa bebi të shikon në sy.", benefit: "Lidhja prind–fëmijë", durationMin: 5 },
    { title: "Zilja e butë", description: "Tunde ngadalë një zile të butë herë majtas e herë djathtas; bebi e ndjek me sy dhe me veshë.", benefit: "Dëgjimi dhe ndjekja me sy", durationMin: 5 },
    { title: "Prekje me pëlhura", description: "Kaloje lehtë dorën e bebit mbi pëlhura të ndryshme: pambuk, mëndafsh, lesh i butë.", benefit: "Ndjesia e prekjes", durationMin: 5 },
  ] },
  { max: 5, games: [
    { title: "Ku jam?", description: "Mbuloje fytyrën me duar, pyet „Ku jam?”, pastaj zbuloje me buzëqeshje.", benefit: "Pritja dhe gëzimi", durationMin: 8 },
    { title: "Kape lodrën", description: "Mbaje një lodër të madhe me ngjyra para bebit dhe nxite ta kapë me dorë.", benefit: "Koordinimi dorë–sy", durationMin: 10 },
    { title: "Muzikë dhe duartrokitje", description: "Vër muzikë të qetë dhe duartroki sipas ritmit ndërsa e mban bebin në prehër.", benefit: "Ritmi dhe dëgjimi", durationMin: 8 },
    { title: "Para pasqyrës", description: "Uluni bashkë para një pasqyre të madhe dhe vëzhgoni si reagon bebi.", benefit: "Njohja e vetvetes", durationMin: 6 },
  ] },
  { max: 8, games: [
    { title: "Ku u fsheh lodra?", description: "Fshihe një lodër nën një peshqir para syve të bebit dhe nxite ta gjejë.", benefit: "Kujtesa për sendet", durationMin: 10 },
    { title: "Kubet e buta", description: "Jepi bebit kube të buta e të mëdha për t'i kapur, goditur dhe kaluar nga një dorë në tjetrën.", benefit: "Lëvizjet e imta të duarve", durationMin: 10 },
    { title: "Zhurmuesi me ritëm", description: "Tunde një zhurmues lodër me ritme të ndryshme dhe lëre bebin të të imitojë.", benefit: "Ritmi dhe koordinimi", durationMin: 8 },
    { title: "Pjesët e fytyrës", description: "Para pasqyrës, emërto hundën, sytë dhe gojën, duke i treguar me gisht.", benefit: "Njohja e trupit", durationMin: 8 },
  ] },
  { max: 12, games: [
    { title: "Kutia e formave", description: "Përdorni një kuti me vrima dhe forma të mëdha që futen secila në vrimën e vet.", benefit: "Zgjidhja e problemeve", durationMin: 10 },
    { title: "Mbush dhe zbraz", description: "Jepi një enë dhe disa lodra më të mëdha se grushti i tij për t'i futur e nxjerrë. Asnjë send i vogël: rrezik mbytjeje.", benefit: "Lëvizjet e imta të duarve", durationMin: 10 },
    { title: "Ku e ke hundën?", description: "Emërto pjesët e trupit dhe kërkoji t'i tregojë te vetja ose te ti.", benefit: "Gjuha dhe njohja e trupit", durationMin: 8 },
    { title: "Hapat me mbështetje", description: "Mbaje për dore ose përdorni një lodër shtytëse të qëndrueshme për hapat e parë.", benefit: "Ecja dhe ekuilibri", durationMin: 10 },
  ] },
  { max: 18, games: [
    { title: "Piramida me unaza", description: "Ndihmoje të vendosë unazat e mëdha në shtyllë sipas madhësisë.", benefit: "Zgjidhja e problemeve", durationMin: 12 },
    { title: "Lodra shtytëse", description: "Nxite të shtyjë një lodër me rrota nëpër dhomë, në një vend pa pengesa.", benefit: "Ekuilibri dhe ecja", durationMin: 12 },
    { title: "Rrokullis topin", description: "Uluni përballë njëri-tjetrit dhe rrokullisni një top të butë.", benefit: "Loja me të tjerët", durationMin: 10 },
    { title: "Libra me figura", description: "Shfletoni bashkë libra me figura të mëdha dhe emërtoni çfarë shihni.", benefit: "Zhvillimi i gjuhës", durationMin: 10 },
  ] },
  { max: 24, games: [
    { title: "Kulla me kube", description: "Ndërtoni bashkë një kullë me 2–3 kube të mëdha dhe rrëzojeni me të qeshur.", benefit: "Lëvizjet e imta të duarve", durationMin: 12 },
    { title: "Vizatim i lirë", description: "Jepi lapsa dylli të trashë dhe lëre të vizatojë lirshëm mbi një fletë të madhe.", benefit: "Krijimtaria", durationMin: 15 },
    { title: "Imito punët e shtëpisë", description: "Luani me role: gatim, pastrim ose veshja e kukullës, ashtu si bëjnë prindërit.", benefit: "Imagjinata dhe sjellja me të tjerët", durationMin: 12 },
    { title: "Vallëzim në familje", description: "Vër muzikë dhe vallëzoni bashkë, duke ndryshuar ritmin herë pas here.", benefit: "Koordinimi dhe gëzimi", durationMin: 10 },
  ] },
  { max: 36, games: [
    { title: "Bashko pjesët", description: "Bashkoni një lojë me 4–6 pjesë të mëdha që formojnë një figurë.", benefit: "Zgjidhja e problemeve", durationMin: 15 },
    { title: "Lojë me kukulla", description: "Krijoni një histori të shkurtër me kukulla ose figura.", benefit: "Gjuha dhe imagjinata", durationMin: 15 },
    { title: "Gjuetia e ngjyrave", description: "Kërkoni bashkë nëpër shtëpi sende me një ngjyrë të caktuar.", benefit: "Njohja e ngjyrave", durationMin: 12 },
    { title: "Ngjyrosja e formave", description: "Jepi fletë me forma të mëdha për t'i ngjyrosur brenda vijave.", benefit: "Kontrolli i lapsit", durationMin: 15 },
  ] },
  { max: Infinity, games: [
    { title: "Hidhe dhe kape", description: "Hidhni nga afër një top të butë njëri-tjetrit.", benefit: "Koordinimi dhe reagimi", durationMin: 15 },
    { title: "Ndërtim me kube", description: "Ndërtoni struktura të thjeshta dhe tregoni çfarë po ndërtoni.", benefit: "Planifikimi dhe lëvizjet e imta", durationMin: 15 },
    { title: "Tregim me figura", description: "Tregoni një histori të shkurtër duke përdorur foto ose lodra si personazhe.", benefit: "Gjuha dhe kujtesa", durationMin: 15 },
    { title: "Simoni thotë", description: "Lojë me rregulla të thjeshta: bëj vetëm atë që thotë „Simoni”.", benefit: "Vëmendja dhe rregullat", durationMin: 15 },
  ] },
];

function fallbackGames(ageMonths: number): Game[] {
  return (FALLBACK.find((b) => ageMonths <= b.max) ?? FALLBACK[FALLBACK.length - 1]).games;
}

// I njëjti për çdo kërkesë, që të mos ndryshojë nga një thirrje te tjetra.
const SYSTEM = `You suggest play activities for a baby or young child, for parents using the Bebix app in Kosovo and Albania.

Write every field in standard literary Albanian (gjuha standarde) with correct ë and ç: warm, simple and concrete, never slang or dialect.

Safety comes first:
- Every activity is done with an adult present.
- For children under 3 years, never suggest small objects or anything that could be swallowed or wrapped around the neck: coins, beads, buttons, marbles, small balls, balloons, magnets, batteries, cords or strings.
- No water play without constant supervision, nothing hot, sharp or toxic, and no screens.
- Match the child's age in months and use things found in an ordinary home.

Each activity: a title of at most 5 words; a description of 1–2 sentences saying how to play; a benefit as a short phrase; durationMin as a realistic number of minutes between 5 and 20.`;

const SCHEMA = {
  type: "object",
  properties: {
    games: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          benefit: { type: "string" },
          durationMin: { type: "integer" },
        },
        required: ["title", "description", "benefit", "durationMin"],
        additionalProperties: false,
      },
    },
  },
  required: ["games"],
  additionalProperties: false,
};

function cleanGames(value: unknown): Game[] | null {
  const list = (value as { games?: unknown })?.games;
  if (!Array.isArray(list)) return null;
  const games = list
    .filter((g): g is Game => !!g && typeof g.title === "string" && typeof g.description === "string" && typeof g.benefit === "string")
    .map((g) => ({
      title: g.title.trim().slice(0, 60),
      description: g.description.trim().slice(0, 300),
      benefit: g.benefit.trim().slice(0, 80),
      durationMin: Math.min(30, Math.max(3, Math.round(Number(g.durationMin) || 10))),
    }))
    .filter((g) => g.title && g.description && g.benefit)
    .slice(0, 4);
  return games.length === 4 ? games : null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method" }, 405);

  let body: { ageMonths?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: "bad_request" }, 400);
  }
  const ageMonths = Math.floor(Number(body.ageMonths));
  if (!Number.isFinite(ageMonths) || ageMonths < 0 || ageMonths > MAX_AGE_MONTHS) {
    return json({ error: "Mosha s'është e vlefshme." }, 400);
  }
  const fallback = () => json({ ageMonths, games: fallbackGames(ageMonths), source: "fallback" });

  if (!anthropic) return fallback();

  // Vetëm llogari e kyçur merr lojëra nga AI; mysafiri merr listën e gatshme.
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const caller = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: userData } = await caller.auth.getUser();
  const userId = userData?.user?.id;
  if (!userId) return fallback();

  const { data: allowed, error: quotaError } = await admin.rpc("ai_take_quota", { p_user: userId, p_limit: DAILY_LIMIT });
  if (quotaError) {
    console.warn("ai_take_quota:", quotaError.message);
    return fallback();
  }
  if (allowed === false) return fallback();

  const params = {
    model: MODEL,
    max_tokens: 4000,
    // Detyrë e thjeshtë: përpjekje e ulët; përgjigjja kthehet si JSON sipas skemës.
    output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
    system: SYSTEM,
    messages: [{ role: "user", content: `The child is ${ageMonths} months old. Suggest exactly 4 different activities.` }],
  };

  try {
    const response = await anthropic.messages.create(params as unknown as Anthropic.MessageCreateParamsNonStreaming);
    if (response.stop_reason === "refusal") return fallback();
    const text = response.content.map((block) => (block.type === "text" ? block.text : "")).join("");
    const games = cleanGames(JSON.parse(text));
    if (!games) return fallback();
    return json({ ageMonths, games, source: "ai" });
  } catch (e) {
    if (e instanceof Anthropic.APIError) console.error("Claude API:", e.status, e.message);
    else console.error("recommend-baby-games:", e);
    return fallback();
  }
});
