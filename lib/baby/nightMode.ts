import { useEffect, useState, useSyncExternalStore } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Modaliteti i natës (ora 3 e natës): ekran shumë i errët me ngjyrë të
 * ngrohtë, butona të mëdhenj për një dorë, pa animacione.
 *
 * Ndizet vetë natën (cilësim, i ndezur si parazgjedhje) ose me dorë. Kur
 * prindi e ndez/fik me dorë, zgjedhja vlen deri në mëngjes (07:00) — pastaj
 * rregulli automatik vazhdon si zakonisht.
 */

export type NightPrefs = { auto: boolean; fromHour: number; toHour: number };
export type NightOverride = { mode: "on" | "off"; until: string } | null;

export const DEFAULT_NIGHT_PREFS: NightPrefs = { auto: true, fromHour: 22, toHour: 6 };
/** Zgjedhja me dorë skadon në këtë orë të mëngjesit. */
export const MORNING_HOUR = 7;

export function isNightTime(now: Date, prefs: NightPrefs): boolean {
  const h = now.getHours();
  return prefs.fromHour > prefs.toHour ? h >= prefs.fromHour || h < prefs.toHour : h >= prefs.fromHour && h < prefs.toHour;
}

/** 07:00 e ardhshme: sot nëse s'ka ardhur ende, përndryshe nesër. */
export function nextMorning(now: Date): Date {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), MORNING_HOUR);
  return now < today ? today : new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, MORNING_HOUR);
}

export function nightModeActive(now: Date, prefs: NightPrefs, override: NightOverride): boolean {
  if (override && new Date(override.until).getTime() > now.getTime()) return override.mode === "on";
  return prefs.auto && isNightTime(now, prefs);
}

// --- Ruajtja e përbashkët (Home dhe cilësimet shohin të njëjtën gjë) ---------

const PREFS_KEY = "bebix_night_prefs_v1";
const OVERRIDE_KEY = "bebix_night_override_v1";

type Store = { prefs: NightPrefs; override: NightOverride; loaded: boolean };
let store: Store = { prefs: DEFAULT_NIGHT_PREFS, override: null, loaded: false };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function set(next: Partial<Store>) {
  store = { ...store, ...next };
  emit();
}

let loading = false;
function ensureLoaded() {
  if (store.loaded || loading) return;
  loading = true;
  void Promise.all([AsyncStorage.getItem(PREFS_KEY), AsyncStorage.getItem(OVERRIDE_KEY)])
    .then(([p, o]) => {
      const prefs = p ? { ...DEFAULT_NIGHT_PREFS, ...(JSON.parse(p) as Partial<NightPrefs>) } : DEFAULT_NIGHT_PREFS;
      const override = o ? (JSON.parse(o) as NightOverride) : null;
      set({ prefs, override, loaded: true });
    })
    .catch(() => set({ loaded: true }));
}

export function setNightAuto(auto: boolean) {
  const prefs = { ...store.prefs, auto };
  set({ prefs });
  AsyncStorage.setItem(PREFS_KEY, JSON.stringify(prefs)).catch(() => {});
}

/** Ndez ose fik me dorë, deri në mëngjes. */
export function setNightOverride(mode: "on" | "off", now: Date = new Date()) {
  const override: NightOverride = { mode, until: nextMorning(now).toISOString() };
  set({ override });
  AsyncStorage.setItem(OVERRIDE_KEY, JSON.stringify(override)).catch(() => {});
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  ensureLoaded();
  return () => listeners.delete(l);
};

/** Gjendja e modalitetit të natës, e rillogaritur çdo minutë. */
export function useNightMode(): { active: boolean; prefs: NightPrefs; loaded: boolean } {
  const s = useSyncExternalStore(subscribe, () => store);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);
  return { active: s.loaded && nightModeActive(now, s.prefs, s.override), prefs: s.prefs, loaded: s.loaded };
}
