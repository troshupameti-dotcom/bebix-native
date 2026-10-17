import { log } from "@/lib/log";
import { useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { useAppState } from "@/lib/state/AppStateContext";
import {
  exportRecordsSyncState, importRecordsSyncState, mergeRecordsPatch, resetBabyRecordsSyncState, syncBabyRecords,
} from "@/lib/baby/babyRecordsSync";
import { ChildError, setActiveChildRemote } from "@/lib/children/api";
import { resolveChildren } from "@/lib/children/resolve";
import { childProfileOf, clearChildSnapshots, dropChildSnapshot, loadChildSnapshot, saveChildSnapshot } from "@/lib/children/stash";
import { clearChildrenStore, getChildrenState, setChildrenState } from "@/lib/children/store";
import { registerChildSwitchRunner, takeChildSwitch } from "@/lib/children/switchRequest";
import { parseDate } from "@/lib/age/engine";
import { claimDataOwner, claimLocalData } from "@/lib/auth/localDataOwner";
import { resolveDataOwnerId, resolveDataOwnerIdStrict } from "@/lib/baby/household";
import { registerSyncRequest, resetSyncStatus, setSyncPhase } from "@/lib/baby/syncStatus";
import { supabase } from "@/lib/supabase/client";
import { realtimeTopic } from "@/lib/supabase/realtimeTopic";
import { captureToSentry } from "@/lib/errors/sentry";

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
  const { state, hydrated, applyBabyRecordsPatch, resetBabyData, refreshProfileFromServer, replaceChildData, flushPendingProfile } =
    useAppState();

  // Refs, që efektet të mos rinisen në çdo shkrim (react-hooks/refs: shkrimi
  // bëhet në efekt, jo gjatë render-it).
  const latestBaby = useRef(state.baby);
  const latestProfile = useRef(state.profile);
  const apply = useRef(applyBabyRecordsPatch);
  const reset = useRef(resetBabyData);
  const refreshProfile = useRef(refreshProfileFromServer);
  const replaceChild = useRef(replaceChildData);
  const flushProfile = useRef(flushPendingProfile);
  useEffect(() => {
    latestBaby.current = state.baby;
    latestProfile.current = state.profile;
    apply.current = applyBabyRecordsPatch;
    reset.current = resetBabyData;
    refreshProfile.current = refreshProfileFromServer;
    replaceChild.current = replaceChildData;
    flushProfile.current = flushPendingProfile;
  });

  /**
   * Ndërrimi i fëmijës aktiv. Rendi ka rëndësi: (1) dërgohet gjithçka e fëmijës aktual, (2) serveri pranon
   * fëmijën e ri (i kyçuri refuzohet), (3) fëmija aktual ruhet në telefon, (4) hapet tjetri — nga kopja e tij
   * në telefon, ose bosh dhe merret i plotë nga serveri. Çdo dështim para hapit (4) e lë gjithçka si ishte.
   */
  const switchChild = useRef(async (target: string) => {
    const from = getChildrenState().activeChildId;
    if (from === target) return;
    const child = getChildrenState().children.find((c) => c.id === target);
    if (!child) throw new ChildError("NOT_ALLOWED");
    if (child.isLocked) throw new ChildError("PREMIUM_REQUIRED");
    if (!(await flushProfile.current())) throw new Error("OFFLINE");

    const patch = from ? await syncBabyRecords(latestBaby.current, from) : null;
    await setActiveChildRemote(target);
    if (from) {
      const baby = patch ? { ...latestBaby.current, ...mergeRecordsPatch(latestBaby.current, patch) } : latestBaby.current;
      await saveChildSnapshot(from, { baby, profile: childProfileOf(latestProfile.current), sync: await exportRecordsSyncState() });
    }
    const snapshot = await loadChildSnapshot(target);
    await importRecordsSyncState(snapshot?.sync ?? null);
    const dob = parseDate(child.birthDate);
    setChildrenState({
      activeChildId: target,
      children: getChildrenState().children.map((c) => ({ ...c, isActive: c.id === target })),
    });
    replaceChild.current({
      baby: snapshot?.baby ?? {},
      profile: snapshot?.profile ?? { babyName: child.name, babyDob: dob ? dob.toISOString() : null, babyPhotoPath: child.photoPath },
    });
    await dropChildSnapshot(target);
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

  // Rritet kur ndryshon pronari i të dhënave, që Realtime të dëgjojë pronarin e ri.
  const [ownerVersion, setOwnerVersion] = useState(0);

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
      (async () => {
        // Familja: nëse pronari i të dhënave ndryshoi (u bashkua me një familje,
        // doli prej saj, ose u hoq nga pronari), historiku lokal s'është më i tij.
        // Pastrohet dhe sync-u i radhës (pas render-it) tërheq gjithçka nga e para.
        const ownerId = await resolveDataOwnerIdStrict();
        if (ownerId && (await claimDataOwner(ownerId)) === "switched") {
          await resetBabyRecordsSyncState();
          // Fëmijët e familjes së mëparshme s'janë më të këtij telefoni.
          await clearChildrenStore();
          await clearChildSnapshots();
          reset.current({ keepParent: true });
          refreshProfile.current();
          setOwnerVersion((v) => v + 1);
          return null;
        }
        const children = await resolveChildren();
        // Premium skadoi dhe fëmija aktiv u kyç: kalohet te fëmija falas (të dhënat e tjetrit mbeten).
        const forced = children.mode === "ready" && children.switchTo ? children.switchTo : null;
        const request = takeChildSwitch();
        if (forced || request) {
          const target = forced ?? (request as NonNullable<typeof request>).childId;
          try {
            await switchChild.current(target);
            request?.resolve();
            // Sync-u i radhës tërheq shënimet e fëmijës së ri.
            queued.current = true;
            return null;
          } catch (e) {
            // Prindi e sheh arsyen te ekrani (p.sh. Premium); sync-u i fëmijës aktual vazhdon si zakonisht.
            request?.reject(e);
            if (forced) throw e;
          }
        }
        return syncBabyRecords(latestBaby.current, children.mode === "ready" ? children.activeChildId : null);
      })()
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
          log("Sync-u i baby_records dështoi:", e);
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
    registerChildSwitchRunner(() => runSync.current());
    (async () => {
      const { data } = await supabase.auth.getSession();
      const userId = data.session?.user.id;
      if (userId && (await claimLocalData(userId)) === "switched") {
        await resetBabyRecordsSyncState();
        await clearChildrenStore();
        await clearChildSnapshots();
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

    const interval = setInterval(() => {
      if (AppState.currentState === "active") runSync.current();
    }, INTERVAL_MS);
    const subscription = AppState.addEventListener("change", (next) => {
      if (next === "active") runSync.current();
    });

    return () => {
      cancelled = true;
      registerChildSwitchRunner(null);
      resetSyncStatus();
      clearInterval(interval);
      subscription.remove();
    };
  }, [enabled]);

  // Realtime: serveri njofton sapo ndryshon një rresht i këtij bebi. RLS
  // vendos se kush e merr njoftimin; filtri e ngushton te pronari i të
  // dhënave (vetja, ose prindi që e ftoi në shtëpi). Rinis kur ndryshon pronari.
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let remoteTimer: ReturnType<typeof setTimeout> | undefined;
    (async () => {
      const ownerId = await resolveDataOwnerId();
      if (!ownerId || cancelled) return;
      channel = supabase
        .channel(realtimeTopic(`baby_records:${ownerId}`))
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
    })().catch((e) => {
      // Realtime është vetëm përshpejtim (sync-u periodik i kap ndryshimet gjithsesi): një dështim këtu s'duhet të
      // dalë si gabim i pakapur (Sentry REACT-NATIVE-1), por raportohet si i trajtuar.
      captureToSentry(e, "realtime_baby_records");
    });
    return () => {
      cancelled = true;
      clearTimeout(remoteTimer);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [enabled, ownerVersion]);

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
