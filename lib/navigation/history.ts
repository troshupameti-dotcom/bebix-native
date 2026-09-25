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

/** Thirret nga rrënja e app-it sa herë ndryshon rruga. */
export function recordPath(path: string | null | undefined): void {
  if (!path) return;
  // E njëjta rrugë dy herë radhazi nuk është lëvizje.
  if (history[history.length - 1] === path) return;

  history.push(path);
  if (history.length > MAX_ENTRIES) history.shift();
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

/** Vetëm për teste. */
export function resetHistory(paths: string[] = []): void {
  history = [...paths];
}
