import { useEffect, useRef } from "react";
import { AppState } from "react-native";
import { useAppState } from "@/lib/state/AppStateContext";
import { resetBabyRecordsSyncState, syncBabyRecords } from "@/lib/baby/babyRecordsSync";
import { claimLocalData } from "@/lib/auth/localDataOwner";
import { resolveDataOwnerId } from "@/lib/baby/household";
import { registerSyncRequest, resetSyncStatus, setSyncPhase } from "@/lib/baby/syncStatus";
import { supabase } from "@/lib/supabase/client";

/**
 * Kontrolli periodik mbetet vetëm si rrjet sigurie: ndryshimet nga webi
 * vijnë me Realtime. Nëse lidhja Realtime bie pa u vënë re, prapë kapen.
 */
const INTERVAL_MS = 5 * 60_000;
/** Njoftimet Realtime që vijnë radhazi (p.sh. disa shënime nga webi) bashkohen. */
const REMOTE_DEBOUNCE_MS = 800;
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
 *  - sapo webi ose partneri shkruan (Realtime te `baby_records`),
 *  - çdo 5 minuta sa kohë app-i është aktiv, si rrjet sigurie,
 *  - pak pas çdo shkrimi lokal.
 *
 * Asnjëherë dy sync-e njëkohësisht: nëse kërkohet një i ri ndërsa tjetri
 * punon, ai nis sapo mbaron i pari.
 */
export function useBabyRecordsSync(isAuthenticated: boolean) {
  const { state, hydrated, applyBabyRecordsPatch, resetBabyData } = useAppState();

  // Refs, që efektet të mos rinisen në çdo shkrim (react-hooks/refs: shkrimi
  // bëhet në efekt, jo gjatë render-it).
  const latestBaby = useRef(state.baby);
  const apply = useRef(applyBabyRecordsPatch);
  const reset = useRef(resetBabyData);
  useEffect(() => {
    latestBaby.current = state.baby;
    apply.current = applyBabyRecordsPatch;
    reset.current = resetBabyData;
  });

  const running = useRef(false);
  const queued = useRef(false);
  // Asnjë sync para se të dihet që të dhënat lokale i përkasin kësaj llogarie.
  const ownerReady = useRef(false);
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
      if (running.current || !ownerReady.current) {
        queued.current = true;
        return;
      }
      running.current = true;
      setSyncPhase("syncing");
      syncBabyRecords(latestBaby.current)
        .then((patch) => {
          setSyncPhase("synced");
          if (patch) {
            applyingRemote.current = true;
            apply.current(patch);
          }
        })
        .catch((e) => {
          // Dështimi i sync-ut s'duhet t'i prishë asgjë prindit: të dhënat janë
          // të ruajtura lokalisht dhe riprovohet herën tjetër.
          console.log("Sync-u i baby_records dështoi:", e);
          setSyncPhase("error");
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
    let cancelled = false;

    // Para sync-ut të parë: a i përkasin të dhënat lokale kësaj llogarie?
    // Nëse jo (hyri dikush tjetër në këtë telefon), pastrohen, dhe sync-u nis
    // vetëm pasi state-i i pastër të jetë renderuar — efekti i shkrimeve
    // lokale më poshtë e nis vetë. Pa këtë pritje, sync-u do të dërgonte
    // historikun e llogarisë së mëparshme te kjo.
    ownerReady.current = false;
    registerSyncRequest(() => runSync.current());
    (async () => {
      const { data } = await supabase.auth.getSession();
      const userId = data.session?.user.id;
      if (userId && (await claimLocalData(userId)) === "switched") {
        await resetBabyRecordsSyncState();
        if (cancelled) return;
        reset.current();
        queued.current = false;
        // Sync-u i parë e pret state-in e pastër: e nis efekti i shkrimeve
        // lokale, sapo pastrimi të renderohet.
        ownerReady.current = true;
        return;
      }
      if (cancelled) return;
      ownerReady.current = true;
      queued.current = false;
      runSync.current();
    })();

    // Realtime: serveri njofton sapo ndryshon një rresht i këtij bebi. RLS
    // vendos se kush e merr njoftimin; filtri e ngushton te pronari i të
    // dhënave (vetja, ose prindi që e ftoi në shtëpi).
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let remoteTimer: ReturnType<typeof setTimeout> | undefined;
    (async () => {
      const ownerId = await resolveDataOwnerId();
      if (!ownerId || cancelled) return;
      channel = supabase
        .channel(`baby_records:${ownerId}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "baby_records", filter: `user_id=eq.${ownerId}` },
          () => {
            clearTimeout(remoteTimer);
            remoteTimer = setTimeout(() => runSync.current(), REMOTE_DEBOUNCE_MS);
          }
        )
        .subscribe((status) => {
          // Pas rilidhjes mund të kenë humbur njoftime: një sync i kap.
          if (status === "SUBSCRIBED") runSync.current();
        });
      if (cancelled) void supabase.removeChannel(channel);
    })();

    const interval = setInterval(() => {
      if (AppState.currentState === "active") runSync.current();
    }, INTERVAL_MS);
    const subscription = AppState.addEventListener("change", (next) => {
      if (next === "active") runSync.current();
    });

    return () => {
      cancelled = true;
      resetSyncStatus();
      clearTimeout(remoteTimer);
      if (channel) void supabase.removeChannel(channel);
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
