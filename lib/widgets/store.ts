import AsyncStorage from "@react-native-async-storage/async-storage";
import { DeviceEventEmitter } from "react-native";
import { enqueue, parseQueue, resolveAction, type WidgetAction, type WidgetActionInput } from "@/lib/widgets/queue";
import { parseSnapshot, type WidgetSnapshot } from "@/lib/widgets/snapshot";

/**
 * Ruajtja e përbashkët app ↔ widget. Në Android widget-i ekzekuton JS-in e
 * vetë app-it (headless), ndaj AsyncStorage mjafton. Në iOS pamja do të
 * kopjohet edhe te App Group-i (group.com.bebix.app) — faza e iOS-it.
 */
export const SNAPSHOT_KEY = "bebix_widget_snapshot_v1";
export const QUEUE_KEY = "bebix_widget_queue_v1";
/** Njofton app-in (nëse është gjallë) që ka veprime të reja në radhë. */
export const QUEUE_EVENT = "bebixWidgetQueue";

// Widget-i dhe app-i shkruajnë në të njëjtën radhë nga i njëjti JS runtime:
// një zinxhir premtimesh mjafton që asnjë shkrim të mos humbasë.
let lock: Promise<unknown> = Promise.resolve();
function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = lock.then(fn, fn);
  lock = run.catch(() => undefined);
  return run;
}

export async function loadSnapshot(): Promise<WidgetSnapshot | null> {
  try {
    return parseSnapshot(await AsyncStorage.getItem(SNAPSHOT_KEY));
  } catch {
    return null;
  }
}

export async function saveSnapshot(snapshot: WidgetSnapshot): Promise<void> {
  try {
    await AsyncStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshot));
  } catch {
    // Widget-i mbetet me pamjen e mëparshme; rifreskohet herën tjetër.
  }
}

export async function loadQueue(): Promise<WidgetAction[]> {
  try {
    return parseQueue(await AsyncStorage.getItem(QUEUE_KEY));
  } catch {
    return [];
  }
}

/** Prekja nga widget-i ose nga lidhja: ruhet në radhë. Kthen veprimin, ose `null` kur ishte prekje e dyfishtë. */
export function pushAction(input: WidgetActionInput, now = new Date()): Promise<WidgetAction | null> {
  return withLock(async () => {
    const [queue, snapshot] = await Promise.all([loadQueue(), loadSnapshot()]);
    const action = resolveAction(input, snapshot, queue, now);
    if (!action) return null;
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(enqueue(queue, action)));
    DeviceEventEmitter.emit(QUEUE_EVENT);
    return action;
  });
}

/**
 * Zbrazja: `apply` merr veprimet në pritje dhe i zbaton, pastaj radha pastrohet.
 * Një prekje që vjen ndërkohë pret te lock-u dhe mbetet për zbrazjen tjetër.
 */
export function drainQueue(apply: (queue: WidgetAction[]) => void): Promise<number> {
  return withLock(async () => {
    const queue = await loadQueue();
    if (!queue.length) return 0;
    apply(queue);
    await AsyncStorage.removeItem(QUEUE_KEY);
    return queue.length;
  });
}
