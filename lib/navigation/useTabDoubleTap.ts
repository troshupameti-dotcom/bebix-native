import { useEffect, useRef } from "react";
import { useNavigation } from "expo-router";

/** Dy prekje brenda kësaj kohe numërohen si prekje e dyfishtë. */
export const DOUBLE_TAP_MS = 350;

type TabNavigation = {
  getState: () => { type?: string; index: number; routes: { key: string }[] } | undefined;
  getParent: () => TabNavigation | undefined;
  addListener: (event: "tabPress", cb: (e: { target?: string }) => void) => () => void;
};

/**
 * Prekja e tab-it kur je tashmë në të: një prekje të kthen te faqja kryesore e pjesës ashtu siç ishte (stiva hiqet
 * vetë nga navigimi, pozicioni i listës mbetet); dy prekje të shpejta thërrasin `onDoubleTap` (p.sh. në krye dhe
 * rifreskim). Prekja që vjen nga një tab tjetër është vetëm kalim, jo prekje e parë.
 */
export function useTabDoubleTap(onDoubleTap: () => void): void {
  const navigation = useNavigation() as unknown as Partial<TabNavigation>;
  const latest = useRef(onDoubleTap);
  useEffect(() => {
    latest.current = onDoubleTap;
  });

  useEffect(() => {
    let tabs = navigation.getParent?.();
    while (tabs && tabs.getState()?.type !== "tab") tabs = tabs.getParent?.();
    if (!tabs) return;
    const nav = tabs;
    let lastTap = 0;
    return nav.addListener("tabPress", (e) => {
      const state = nav.getState();
      const alreadyHere = !!state && state.routes[state.index]?.key === e.target;
      if (!alreadyHere) {
        lastTap = 0;
        return;
      }
      const now = Date.now();
      if (now - lastTap < DOUBLE_TAP_MS) {
        lastTap = 0;
        // Pasi stiva të jetë kthyer te faqja kryesore.
        requestAnimationFrame(() => latest.current());
      } else {
        lastTap = now;
      }
    });
  }, [navigation]);
}
