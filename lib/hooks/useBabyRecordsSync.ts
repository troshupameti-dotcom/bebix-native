import { useEffect, useRef } from "react";
import { AppState } from "react-native";
import { useAppState } from "@/lib/state/AppStateContext";
import { syncBabyRecords } from "@/lib/baby/babyRecordsSync";

/** Sa shpesh kontrollohet serveri kur app-i është i hapur (ndryshimet nga webi). */
const INTERVAL_MS = 30_000;
/** Pas një shkrimi lokal, pritet pak që disa prekje radhazi të shkojnë bashkë. */
const DEBOUNCE_MS = 2_500;

/**
 * Mban historikun e bebit të sinkronizuar me Supabase, që e njëjta llogari
 * të shohë të njëjtat të dhëna në telefon dhe në web.
 *
 * Më parë sync-u bëhej vetëm një herë për session: një ushqyerje e shënuar
 * në telefon nuk dilte te webi derisa app-i të rihapej, dhe anasjelltas.
 * Tani sync-u nis:
 *  - kur app-i hapet ose kthehet në plan të parë,
 *  - çdo 30 sekonda sa kohë app-i është aktiv,
 *  - pak pas çdo shkrimi lokal.
 *
 * Asnjëherë dy sync-e njëkohësisht: nëse kërkohet një i ri ndërsa tjetri
 * punon, ai nis sapo mbaron i pari.
 */
export function useBabyRecordsSync(isAuthenticated: boolean) {
  const { state, hydrated, applyBabyRecordsPatch } = useAppState();

  // Refs, që efektet të mos rinisen në çdo shkrim (react-hooks/refs: shkrimi
  // bëhet në efekt, jo gjatë render-it).
  const latestBaby = useRef(state.baby);
  const apply = useRef(applyBabyRecordsPatch);
  useEffect(() => {
    latestBaby.current = state.baby;
    apply.current = applyBabyRecordsPatch;
  });

  const running = useRef(false);
  const queued = useRef(false);
  // Ndryshimi i state-it që vjen nga vetë sync-u s'duhet të nisë sync tjetër.
  const applyingRemote = useRef(false);
  const enabled = isAuthenticated && hydrated;
  const enabledRef = useRef(enabled);
  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  const runSync = useRef<() => void>(() => {});
  useEffect(() => {
    runSync.current = () => {
      if (!enabledRef.current) return;
      if (running.current) {
        queued.current = true;
        return;
      }
      running.current = true;
      syncBabyRecords(latestBaby.current)
        .then((patch) => {
          if (patch) {
            applyingRemote.current = true;
            apply.current(patch);
          }
        })
        .catch((e) => {
          // Dështimi i sync-ut s'duhet t'i prishë asgjë prindit: të dhënat janë
          // të ruajtura lokalisht dhe riprovohet herën tjetër.
          console.log("Sync-u i baby_records dështoi:", e);
        })
        .finally(() => {
          running.current = false;
          if (queued.current) {
            queued.current = false;
            runSync.current();
          }
        });
    };
  });

  // Hapja, kthimi në plan të parë dhe kontrolli periodik.
  useEffect(() => {
    if (!enabled) return;
    runSync.current();

    const interval = setInterval(() => {
      if (AppState.currentState === "active") runSync.current();
    }, INTERVAL_MS);
    const subscription = AppState.addEventListener("change", (next) => {
      if (next === "active") runSync.current();
    });

    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, [enabled]);

  // Pak pas çdo shkrimi lokal.
  useEffect(() => {
    if (!enabled) return;
    if (applyingRemote.current) {
      applyingRemote.current = false;
      return;
    }
    const timer = setTimeout(() => runSync.current(), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [state.baby, enabled]);
}
