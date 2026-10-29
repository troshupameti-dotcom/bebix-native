/**
 * Historiku i vërtetë i lëvizjes brenda app-it.
 *
 * Pse duhet: app-i ka katër tab-e, secili me stivën e vet. Kur nga "Më
 * shumë" shtyp "Porositë e mia", expo-router kalon te tab-i i Dyqanit dhe
 * e shton ekranin atje. `router.back()` atëherë kthehet brenda Dyqanit —
 * pra përdoruesi përfundon te Dyqani, jo te "Më shumë" prej nga erdhi.
 *
 * Ky modul mban rrugët nëpër të cilat ka kaluar përdoruesi, që kthimi të
 * dijë ku ishte vërtet. Është i vogël me qëllim: vetëm një listë rrugësh,
 * pa varësi nga React dhe pa gjendje tjetër.
 */

const MAX_ENTRIES = 25;

let history: string[] = [];

/**
 * Prej nga erdhi VËRTET përdoruesi te një ekran, kur hyri aty nga një pjesë tjetër e app-it
 * (p.sh. "/shop/orders" → "/more"). Ekrani i mëparshëm në histori s'mjafton: pas një ndërrimi tab-i
 * ai është tab-i tjetër. Gabimi (14 tetor): Më shumë → Modaliteti i natës → tab-i Home → tab-i Më shumë
 * (rihapet te nata) → "mbrapa" të çonte te Home, sepse Home ishte "i mëparshmi".
 */
const origins = new Map<string, string>();

/** Si u arrit rruga e radhës: me prekje tab-i, me kthim, apo me lëvizje përpara (parazgjedhja). */
type MoveKind = "tab" | "back";
let pending: { kind: MoveKind; at: number } | null = null;
/** Shënimi vlen vetëm për lëvizjen që pason menjëherë. */
const PENDING_MS = 1500;

/** Thirret para ndërrimit të tab-it nga shiriti poshtë: ekrani që hapet s'ka "prej nga erdhi" të ri. */
export function noteTabSwitch(): void {
  pending = { kind: "tab", at: Date.now() };
}

/** Thirret para çdo kthimi (butoni mbrapa, butoni fizik): kthimi s'është hyrje e re. */
export function noteBackMove(): void {
  pending = { kind: "back", at: Date.now() };
}

/**
 * Lidhjet e widget-it / Shortcuts / NFC (`bebix://log/feeding`, `bebix://sleep`…): ekrane kalimtare që ridrejtojnë
 * menjëherë te ekrani i vërtetë. S'janë vend ku kthehet përdoruesi: kur hynin në histori, "mbrapa" kthehej te lidhja,
 * ajo ridrejtonte sërish te i njëjti ekran, dhe butoni dukej sikur s'bënte asgjë (16 tetor). Edhe zgjedhja e shpejtë
 * (`bebix://quick/…`) ikën vetë pas prekjes.
 */
const PASS_THROUGH = new Set(["log", "sleep", "quick"]);

/** Thirret nga rrënja e app-it sa herë ndryshon rruga. */
export function recordPath(path: string | null | undefined): void {
  if (!path) return;
  if (PASS_THROUGH.has(sectionOf(path) ?? "")) return;
  // Shënimi i lëvizjes i përket kësaj thirrjeje, edhe kur rruga s'ndryshon: pas `rewindTo` historiku mbaron
  // tashmë te rruga ku kthehet përdoruesi, dhe pa këtë shënimi "kthim" mbetej i varur e ngjitej te lëvizja
  // e RADHËS (Cilësimet → Porositë → mbrapa → Produktet e ruajtura humbiste prej nga erdhi, 15 tetor).
  const note = pending && Date.now() - pending.at <= PENDING_MS ? pending.kind : null;
  pending = null;
  // E njëjta rrugë dy herë radhazi nuk është lëvizje.
  if (history[history.length - 1] === path) return;

  const previous = history[history.length - 1] ?? null;
  // Kthim pa shënim (rrëshqitja mbrapa në iPhone, "mbrapa" native): rruga është ajo para së fundit.
  const isBack = note === "back" || (note === null && history.length >= 2 && history[history.length - 2] === path);

  if (note === null && !isBack && previous) {
    // Lëvizje përpara: nga një pjesë tjetër mbahet mend prej nga erdhi; brenda së njëjtës pjesë kthimi
    // është thjesht ekrani poshtë në stivë, ndaj harrohet një "prej nga" i vjetër.
    if (sectionOf(previous) !== sectionOf(path)) origins.set(path, previous);
    else origins.delete(path);
  }

  history.push(path);
  if (history.length > MAX_ENTRIES) history.shift();
}

/** Prej nga erdhi përdoruesi te kjo rrugë nga një pjesë tjetër, ose null (kthimi bëhet brenda stivës). */
export function originOf(path: string | null | undefined): string | null {
  return path ? origins.get(path) ?? null : null;
}

export function currentPath(): string | null {
  return history[history.length - 1] ?? null;
}

export function previousPath(): string | null {
  return history.length >= 2 ? history[history.length - 2] : null;
}

/**
 * Cila pjesë e app-it është kjo rrugë: "baby", "shop", "community",
 * "more", "notifications"... Segmenti i parë mjafton, sepse aty ndahen
 * stivat.
 */
export function sectionOf(path: string | null | undefined): string | null {
  if (!path) return null;
  const clean = path.split("?")[0];
  const segments = clean.split("/").filter(Boolean);
  return segments[0] ?? null;
}

export type BackDecision =
  /** Kthim i shprehur: erdhi nga nje pjese tjeter e app-it. */
  | { kind: "goto"; path: string }
  /** Kthim normal brenda stives se njejte. */
  | { kind: "pop" };

/**
 * Vendimi i kthimit, i ndare nga router-i qe te mund te testohet.
 */
export function decideBack(previous: string | null, current: string | null): BackDecision {
  if (previous && sectionOf(previous) !== sectionOf(current)) {
    return { kind: "goto", path: previous };
  }
  return { kind: "pop" };
}

/** Rrënjët e tab-eve: aty "mbrapa" i Android-it ndjek sjelljen e tab-eve (firstRoute / dalje). */
const TAB_ROOTS = new Set(["/", "/baby", "/shop", "/ai-chat", "/community", "/more"]);
/** Ekranet jashtë (main): stiva e rrënjës i kthen vetë saktë. */
const OUTSIDE_MAIN = new Set(["log", "sleep", "auth"]);

/**
 * Ku duhet ta çojë butoni fizik "mbrapa" i Android-it, ose null kur sjellja
 * native është e saktë. E njëjta logjikë si BackButton: pa këtë, "Më shumë" ->
 * "Porositë e mia" -> mbrapa (sistemi) përfundonte te Dyqani.
 */
export function hardwareBackTarget(previous: string | null, current: string | null): string | null {
  if (!current) return null;
  const clean = current.split("?")[0];
  if (TAB_ROOTS.has(clean)) return null;
  if (OUTSIDE_MAIN.has(sectionOf(clean) ?? "")) return null;
  const decision = decideBack(previous, current);
  return decision.kind === "goto" ? decision.path : null;
}

/** Gjendja e navigimit, aq sa duhet për të parë stivat në rrugën e hapur. */
export type NavState = { type?: string; index?: number; routes: { state?: NavState }[] };

/**
 * A ka një stivë në rrugën e hapur një faqe poshtë asaj që shihet, pra a ka çka të mbyllë `dismiss`. Si
 * `router.canDismiss()`, por njeh edhe stivat pa `type` që hapen me withAnchor: te expo-router 58 ai i anashkalon
 * (ENG-22019), dhe "Porositë" mbetej e hapur në stivën e Dyqanit.
 */
export function canDismissFocused(state: NavState | null | undefined): boolean {
  for (let s = state; s && s.routes.length > 0; ) {
    const index = s.index ?? (s.type === "tab" ? 0 : s.routes.length - 1);
    if (s.type !== "tab" && index > 0) return true;
    s = s.routes[index]?.state;
  }
  return false;
}

/**
 * Rruga e fundit që i përket një pjese TJETËR të app-it, duke kërkuar prapa
 * në krejt historikun — jo vetëm një hap. Përdoret kur stiva nismore (pop)
 * mbaron (canGoBack() = false) por ekrani aktual u arrit përmes disa
 * ekraneve brenda së njëjtës pjesë (p.sh. shportë -> arkëtim -> porositë,
 * të tria "shop"), ndërkohë që përdoruesi vinte nga një pjesë krejt tjetër
 * më parë (p.sh. "më shumë" ose "bebi").
 */
export function lastPathInOtherSection(current: string | null): string | null {
  const currentSection = sectionOf(current);
  for (let i = history.length - 2; i >= 0; i--) {
    if (sectionOf(history[i]) !== currentSection) return history[i];
  }
  return null;
}

/**
 * Pas një kthimi të shprehur te `path`, historiku duhet të mbyllet aty ku u kthye përdoruesi: ekranet pas tij hiqen.
 * Pa këtë, "mbrapa" nga një njoftim te ekrani i vaksinave të çonte te njoftimet, dhe "mbrapa" prej andej
 * përsëri te vaksinat (rrethi), në vend të kreut.
 */
export function rewindTo(path: string): void {
  for (let i = history.length - 2; i >= 0; i--) {
    if (history[i] === path) {
      history = history.slice(0, i + 1);
      return;
    }
  }
}

/** Vetëm për teste: historiku si të ishte lëvizur përpara nëpër këto rrugë. */
export function resetHistory(paths: string[] = []): void {
  history = [];
  origins.clear();
  pending = null;
  paths.forEach(recordPath);
}
