import { log } from "@/lib/log";
import { ChildError, fetchMyChildren, setActiveChildRemote, type Child } from "@/lib/children/api";
import { getChildrenState, loadChildrenStore, setChildrenState } from "@/lib/children/store";

/** Sa kohë vlen lista e lexuar (sync-u xhiron shpesh; fëmijët ndryshojnë rrallë). */
const FRESH_MS = 60_000;

export type ChildResolution =
  /** Pa sistemin e fëmijëve: sync-u punon si më parë. */
  | { mode: "legacy" }
  /** `switchTo`: fëmija aktiv u kyç (Premium skadoi) dhe duhet kaluar te ky. */
  | { mode: "ready"; activeChildId: string; switchTo?: string };

/** Fëmija që merr telefoni kur s'ka zgjedhje të vlefshme: ai falas (të dhënat lokale të vjetra janë të tij). */
function fallbackChild(children: Child[]): Child {
  return children.find((c) => c.isFree) ?? children.find((c) => !c.isLocked) ?? children[0];
}

/**
 * Para çdo sync-u: cili është fëmija aktiv. Lista rilexohet nga serveri (më së shumti një herë në minutë,
 * ose menjëherë me `force`); pa rrjet përdoret ajo e ruajtur.
 */
export async function resolveChildren(options: { force?: boolean; now?: number } = {}): Promise<ChildResolution> {
  await loadChildrenStore();
  const now = options.now ?? Date.now();
  const cached = getChildrenState();
  if (!options.force && cached.mode === "ready" && cached.activeChildId && now - cached.loadedAt < FRESH_MS) {
    return { mode: "ready", activeChildId: cached.activeChildId };
  }

  let result: Awaited<ReturnType<typeof fetchMyChildren>>;
  try {
    result = await fetchMyChildren();
  } catch (e) {
    const code = e instanceof ChildError ? e.code : "UNKNOWN";
    if (code === "UNAVAILABLE" && cached.mode !== "ready") {
      setChildrenState({ mode: "legacy", loadedAt: now });
      return { mode: "legacy" };
    }
    // Pa rrjet: fëmija i ruajtur.
    if (cached.mode === "ready" && cached.activeChildId) return { mode: "ready", activeChildId: cached.activeChildId };
    throw e;
  }

  const { children, isPremium } = result;
  // Familja s'ka ende asnjë fëmijë (p.sh. llogari e re para profilit): si më parë. Serveri krijon fëmijën
  // falas sapo të vijë emri/data ose shënimi i parë, dhe herën tjetër telefoni e adopton.
  if (children.length === 0) {
    setChildrenState({ mode: "legacy", children: [], isPremium, loadedAt: now });
    return { mode: "legacy" };
  }

  const local = cached.activeChildId ? children.find((c) => c.id === cached.activeChildId) : undefined;
  let activeChildId: string;
  let switchTo: string | undefined;
  if (!cached.activeChildId) {
    // Hera e parë me fëmijët: të dhënat në telefon janë të bebit të vetëm, që tani është fëmija falas.
    activeChildId = fallbackChild(children).id;
  } else if (!local) {
    // Fëmija s'është më i kësaj familjeje (familja ndryshoi; të dhënat lokale u pastruan): ai i serverit.
    const server = children.find((c) => c.isActive && !c.isLocked);
    activeChildId = (server ?? fallbackChild(children)).id;
  } else if (local.isLocked) {
    activeChildId = local.id;
    switchTo = fallbackChild(children).id;
  } else {
    activeChildId = local.id;
  }

  setChildrenState({ mode: "ready", activeChildId, children, isPremium, loadedAt: now });

  // Serveri duhet të dijë fëmijën e këtij telefoni (njoftimet, sugjerimet).
  const serverActive = children.find((c) => c.isActive)?.id;
  if (!switchTo && serverActive !== activeChildId) {
    void setActiveChildRemote(activeChildId).catch((err) => log("set_active_child dështoi:", err));
  }
  return switchTo ? { mode: "ready", activeChildId, switchTo } : { mode: "ready", activeChildId };
}
