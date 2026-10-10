import type { DiaperEntry, DiaperType, SleepEntry } from "@/lib/state/babyTypes";
import type { WidgetSnapshot } from "@/lib/widgets/snapshot";

/**
 * Radha e veprimeve nga widget-i / lidhjet `bebix://`. Prekja ruhet menjëherë
 * me orën e saj (edhe pa internet, edhe kur app-i është i mbyllur) dhe app-i e
 * zbraz kur hapet ose kur kthehet në plan të parë.
 *
 * Kundër dyfishimit:
 *  - `id` e veprimit bëhet id e shënimit: nëse shënimi ekziston, s'shtohet sërish;
 *  - dy prekje të njëjta brenda DEBOUNCE_MS llogariten si një.
 */
export type WidgetAction =
  | { id: string; at: string; kind: "diaper"; type: DiaperType }
  | { id: string; at: string; kind: "sleep_start" }
  | { id: string; at: string; kind: "sleep_end"; sleepId: string };

export type WidgetActionInput = { kind: "diaper"; type: DiaperType } | { kind: "sleep_toggle" };

export const DEBOUNCE_MS = 3000;
/** Më shumë se kaq veprime në pritje s'ka kuptim (dikush luajti me widget-in); të vjetrat bien. */
export const MAX_QUEUE = 50;

export const DIAPER_TYPES: DiaperType[] = ["wet", "dirty", "both"];

export function newActionId(now: Date): string {
  return "w" + now.getTime().toString(36) + Math.random().toString(36).slice(2, 7);
}

/** Pamja pasi zbatohen veprimet që s'i ka parë ende app-i — widget-i e tregon menjëherë. */
export function applyPending(snapshot: WidgetSnapshot | null, queue: WidgetAction[]): WidgetSnapshot | null {
  if (!snapshot) return null;
  let s = snapshot;
  for (const a of queue) {
    if (a.kind === "diaper") {
      if (!s.diaper || new Date(a.at) >= new Date(s.diaper.at)) s = { ...s, diaper: { at: a.at, type: a.type } };
    } else if (a.kind === "sleep_start") {
      if (!s.sleep) s = { ...s, sleep: { id: a.id, since: a.at } };
    } else if (s.sleep?.id === a.sleepId) {
      s = { ...s, sleep: null, lastWakeAt: a.at };
    }
  }
  return s;
}

/**
 * Prekja → veprim në radhë. `null` = prekje e dyfishtë (injorohet).
 * "Gjumi" vendoset këtu, sipas asaj që sheh prindi në widget: fle → zgjohet, zgjuar → fle.
 */
export function resolveAction(
  input: WidgetActionInput,
  snapshot: WidgetSnapshot | null,
  queue: WidgetAction[],
  now: Date,
  id: string = newActionId(now)
): WidgetAction | null {
  const last = queue[queue.length - 1];
  const recent = last && now.getTime() - new Date(last.at).getTime() < DEBOUNCE_MS;
  if (recent) {
    if (input.kind === "diaper" && last.kind === "diaper" && last.type === input.type) return null;
    if (input.kind === "sleep_toggle" && last.kind !== "diaper") return null;
  }
  const at = now.toISOString();
  if (input.kind === "diaper") return { id, at, kind: "diaper", type: input.type };
  const current = applyPending(snapshot, queue);
  if (current?.sleep) return { id, at, kind: "sleep_end", sleepId: current.sleep.id };
  return { id, at, kind: "sleep_start" };
}

export function enqueue(queue: WidgetAction[], action: WidgetAction): WidgetAction[] {
  return [...queue, action].slice(-MAX_QUEUE);
}

/**
 * Cilat veprime duhen zbatuar vërtet, duke parë gjendjen aktuale të app-it.
 * Hidhen: shënimet që ekzistojnë tashmë (zbrazje e dyfishtë), mbyllja e një
 * gjumi që s'ekziston a është mbyllur, dhe nisja kur një gjumë po vazhdon.
 */
export function planDrain(
  queue: WidgetAction[],
  logs: { diaperLog: DiaperEntry[]; sleepLog: SleepEntry[] }
): WidgetAction[] {
  const diaperIds = new Set(logs.diaperLog.map((e) => e.id));
  const sleeps = new Map(logs.sleepLog.map((s) => [s.id, { ended: !!s.endAt || !!s.deletedAt }]));
  let sleeping = logs.sleepLog.some((s) => !s.endAt && !s.deletedAt && !s.archivedAt);
  const out: WidgetAction[] = [];
  for (const a of queue) {
    if (a.kind === "diaper") {
      if (diaperIds.has(a.id)) continue;
      diaperIds.add(a.id);
      out.push(a);
    } else if (a.kind === "sleep_start") {
      if (sleeps.has(a.id) || sleeping) continue;
      sleeps.set(a.id, { ended: false });
      sleeping = true;
      out.push(a);
    } else {
      const target = sleeps.get(a.sleepId);
      if (!target || target.ended) continue;
      target.ended = true;
      sleeping = false;
      out.push(a);
    }
  }
  return out;
}

export function parseQueue(raw: string | null): WidgetAction[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    if (!Array.isArray(v)) return [];
    return v.filter(
      (a): a is WidgetAction =>
        !!a &&
        typeof a.id === "string" &&
        typeof a.at === "string" &&
        !Number.isNaN(new Date(a.at).getTime()) &&
        ((a.kind === "diaper" && DIAPER_TYPES.includes(a.type)) ||
          a.kind === "sleep_start" ||
          (a.kind === "sleep_end" && typeof a.sleepId === "string"))
    );
  } catch {
    return [];
  }
}
