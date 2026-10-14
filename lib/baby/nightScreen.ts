/* eslint-disable @typescript-eslint/no-require-imports -- modulet native ngarkohen me require() brenda try, që një build pa to të mos rrëzohet */
import { useEffect, useRef } from "react";
import { AppState, Platform } from "react-native";

/**
 * Ekrani gjatë pamjes së natës: ndriçimi ulet kur hapet dhe kthehet si ishte kur mbyllet ose kur app-i del
 * në sfond; drita e kuqe e mban ekranin ndezur. Ndryshohet vetëm dritarja e app-it, jo cilësimi i sistemit
 * (pa leje të veçanta). Pa modulin native (p.sh. në teste) s'bën asgjë: pamja punon njësoj, vetëm pa errësim.
 */

type BrightnessApi = {
  getBrightnessAsync(): Promise<number>;
  setBrightnessAsync(v: number): Promise<void>;
  restoreSystemBrightnessAsync(): Promise<void>;
};
type KeepAwakeApi = { activateKeepAwakeAsync(tag?: string): Promise<void>; deactivateKeepAwake(tag?: string): Promise<void> };

function load<T>(name: "expo-brightness" | "expo-keep-awake"): T | null {
  try {
    return (name === "expo-brightness" ? require("expo-brightness") : require("expo-keep-awake")) as T;
  } catch {
    return null;
  }
}

/** Ndriçimi: vlera para pamjes ruhet një herë; çdo nivel i ri vendoset drejt, pa u kthyer më parë te ajo. */
export function brightnessController(api: BrightnessApi) {
  let original: number | null = null;
  let wanted: number | null = null;
  return {
    async set(level: number | null) {
      wanted = level;
      if (level === null) return this.restore();
      try {
        if (original === null) original = await api.getBrightnessAsync();
        // Ndërkohë mund të jetë kërkuar një nivel tjetër ose të jetë mbyllur pamja.
        if (wanted === level) await api.setBrightnessAsync(level);
      } catch {
        // Pajisja s'e lejon: pamja mbetet me ndriçimin e telefonit.
      }
    },
    /** Rivendos nivelin e fundit (kur app-i rikthehet nga sfondi). */
    reapply() {
      void this.set(wanted);
    },
    restore() {
      const saved = original;
      original = null;
      if (saved === null) return;
      // Android: dritarja kthehet te ndriçimi i sistemit; iPhone: vendoset vlera që kishte para pamjes.
      const done = Platform.OS === "android" ? api.restoreSystemBrightnessAsync() : api.setBrightnessAsync(saved);
      void done.catch(() => {});
    },
  };
}

/**
 * Ndriçimi i ekranit (0–1) sa kohë është hapur pamja; null = s'preket. Kur ndryshon niveli (p.sh. ndizet drita
 * e kuqe), kalohet drejt te niveli i ri, pa ndezje të shkurtër në ndriçimin e plotë.
 */
export function useScreenBrightness(level: number | null): void {
  const ctrl = useRef<ReturnType<typeof brightnessController> | null | undefined>(undefined);
  if (ctrl.current === undefined) {
    const api = load<BrightnessApi>("expo-brightness");
    ctrl.current = api ? brightnessController(api) : null;
  }

  useEffect(() => {
    const c = ctrl.current;
    if (!c) return;
    const sub = AppState.addEventListener("change", (s) => (s === "active" ? c.reapply() : c.restore()));
    return () => {
      sub.remove();
      void c.set(null);
    };
  }, []);

  useEffect(() => {
    void ctrl.current?.set(level);
  }, [level]);
}

/** Ekrani s'fiket vetë sa kohë `on` është true (drita e kuqe). */
export function useKeepScreenOn(on: boolean, tag = "bebix-night-light"): void {
  useEffect(() => {
    if (!on) return;
    const api = load<KeepAwakeApi>("expo-keep-awake");
    if (!api) return;
    void api.activateKeepAwakeAsync(tag).catch(() => {});
    return () => {
      void Promise.resolve(api.deactivateKeepAwake(tag)).catch(() => {});
    };
  }, [on, tag]);
}
