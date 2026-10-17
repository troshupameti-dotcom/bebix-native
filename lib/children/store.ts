import { useSyncExternalStore } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Child } from "@/lib/children/api";

/**
 * Fëmijët e familjes dhe fëmija aktiv në këtë telefon. Store i vogël jashtë React-it (si syncStatus), që edhe
 * sync-u dhe funksionet e profilit ta lexojnë pa kontekst.
 *
 * mode:
 *  - "unknown": s'është pyetur ende serveri;
 *  - "legacy":  serveri s'e ka ende tabelën e fëmijëve (ose familja s'ka asnjë fëmijë): app-i punon si më parë,
 *               me një bebi të vetëm;
 *  - "ready":   `activeChildId` vendos çfarë shfaqet dhe çfarë sinkronizohet.
 */
export type ChildrenState = {
  mode: "unknown" | "legacy" | "ready";
  activeChildId: string | null;
  children: Child[];
  isPremium: boolean;
  /** Kur u lexua lista nga serveri (ms); 0 = kurrë në këtë hapje. */
  loadedAt: number;
};

export const CHILDREN_KEY = "bebix_children_v1";

const initial: ChildrenState = { mode: "unknown", activeChildId: null, children: [], isPremium: false, loadedAt: 0 };
let state: ChildrenState = initial;
const listeners = new Set<() => void>();
let loaded: Promise<void> | null = null;

export function getChildrenState(): ChildrenState {
  return state;
}

/** Fëmija aktiv kur sistemi i fëmijëve është gati; null = mënyra e vjetër (një bebi). */
export function getActiveChildId(): string | null {
  return state.mode === "ready" ? state.activeChildId : null;
}

export function setChildrenState(patch: Partial<ChildrenState>): void {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
  // "legacy" s'ruhet: herën tjetër serveri pyetet sërish (migrimi mund të jetë aplikuar ndërkohë).
  if (state.mode === "ready") {
    const { activeChildId, children, isPremium } = state;
    void AsyncStorage.setItem(CHILDREN_KEY, JSON.stringify({ activeChildId, children, isPremium })).catch(() => {});
  }
}

/** Gjendja e ruajtur në telefon (pa rrjet, fëmija aktiv dihet prapë). */
export function loadChildrenStore(): Promise<void> {
  loaded ??= (async () => {
    try {
      const raw = await AsyncStorage.getItem(CHILDREN_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as Partial<ChildrenState>;
      if (saved.activeChildId && state.mode === "unknown") {
        state = {
          ...state,
          mode: "ready",
          activeChildId: saved.activeChildId,
          children: Array.isArray(saved.children) ? saved.children : [],
          isPremium: !!saved.isPremium,
        };
        listeners.forEach((l) => l());
      }
    } catch {
      // E prishur: lexohet sërish nga serveri.
    }
  })();
  return loaded;
}

/** Dalja nga llogaria ose ndërrimi i familjes: fëmijët e mëparshëm s'janë më të këtij telefoni. */
export async function clearChildrenStore(): Promise<void> {
  state = initial;
  loaded = Promise.resolve();
  listeners.forEach((l) => l());
  await AsyncStorage.removeItem(CHILDREN_KEY).catch(() => {});
}

export function subscribeChildren(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useChildren(): ChildrenState {
  return useSyncExternalStore(subscribeChildren, getChildrenState, getChildrenState);
}

/** Vetëm për testet. */
export function __resetChildrenStoreForTests(): void {
  state = initial;
  loaded = null;
  listeners.clear();
}
