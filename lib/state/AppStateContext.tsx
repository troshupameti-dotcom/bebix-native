import { createContext, useContext, useEffect, useReducer, useRef, useState, ReactNode } from "react";
import { AppState as RNAppState } from "react-native";
import { useColorScheme as useNativeWindColorScheme } from "nativewind";
import { syncNotificationSettings } from "@/lib/notifications/settingsSync";
import { signedUrlForProfilePhoto } from "@/lib/baby/profilePhotos";
import { fetchBabyProfileBasics, fetchProfilePhotoPaths, isBabyProfilePending, saveBabyProfileRemote } from "@/lib/babySync";
import { localDateKey } from "@/lib/babyProfile";
import { mergeRecordsPatch, resetBabyRecordsSyncState } from "@/lib/baby/babyRecordsSync";
import { loadAppState, saveAppState } from "@/lib/state/persistence";
import {
  detailsFromState,
  fetchProfileDetails,
  isProfileDetailsPending,
  saveProfileDetailsRemote,
} from "@/lib/baby/profileDetails";
import { supabase } from "@/lib/supabase/client";
import { applyProfileToMedical, type ProfileMedical } from "@/lib/baby/medicalSync";
import { cleanupSeedBabyData } from "@/lib/state/seedCleanup";
import { clampGap, migrateNotificationPrefs, type NotificationKey } from "@/lib/notifications/catalog";
import {
  AppState,
  initialAppState,
  BabyProfile,
  FavoriteItem,
  MemoryPhoto,
  CartItem,
  BabyModuleState,
  GrowthStat,
  MedicalInfoRow,
  MilestoneItem,
  TimelineEvent,
  FeedingEntry,
  SleepEntry,
  DiaperEntry,
  GrowthHistoryEntry,
  VaccineEntry,
  Moment,
  MedicalRecord,
  EmergencyContact,
  QuickActionKey,
  RecordKind,
  AuditEntry,
  Lifecycle,
  growthCatalog,
  medicalCatalog,
  milestoneCatalog,
} from "./types";

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const nowIso = () => new Date().toISOString();

/** Sa copë nga një produkt pranon porosia (e njëjta kufi si place_order). */
const MAX_CART_QTY = 99;

/** Ditari i ndryshimeve mban vetëm hyrjet e fundit: pa kufi rritej përgjithmonë. */
const MAX_AUDIT_ENTRIES = 500;
function capAudit(list: AuditEntry[]): AuditEntry[] {
  return list.length > MAX_AUDIT_ENTRIES ? list.slice(list.length - MAX_AUDIT_ENTRIES) : list;
}

// ---------------------------------------------------------------------
// Generic helpers shared by every Lifecycle-typed list (feeding, sleep,
// diaper, growth history, vaccines, moments, medical records, timeline).
// Writing add/update/duplicate/delete/archive/restore once here — 
// instead of once per domain — is what keeps this file from becoming
// unmaintainable as the module grows.
// ---------------------------------------------------------------------

type Identifiable = { id: string };

function withAdd<T>(list: T[], item: T): T[] {
  return [item, ...list];
}

/** Field-level diff -> AuditEntry[], plus bumps updatedAt/editCount on the record itself. */
function diffAndTrack<T extends Identifiable & Lifecycle>(
  list: T[],
  id: string,
  patch: Partial<T>,
  kind: RecordKind,
  recordLabel: string
): { list: T[]; entries: AuditEntry[] } {
  const idx = list.findIndex((i) => i.id === id);
  if (idx === -1) return { list, entries: [] };
  const old = list[idx];
  const at = nowIso();
  const entries: AuditEntry[] = [];
  (Object.keys(patch) as (keyof T)[]).forEach((key) => {
    if (key === "updatedAt" || key === "editCount" || key === "createdAt") return;
    const oldVal = old[key];
    const newVal = patch[key];
    if (newVal === undefined) return;
    if (JSON.stringify(oldVal) === JSON.stringify(newVal)) return;
    entries.push({
      id: uid(),
      recordKind: kind,
      recordId: old.id,
      recordLabel,
      field: String(key),
      fieldLabel: String(key),
      oldValue: formatAuditValue(oldVal),
      newValue: formatAuditValue(newVal),
      at,
    });
  });
  const updated: T = { ...old, ...patch, updatedAt: at, editCount: old.editCount + (entries.length ? 1 : 0) };
  const newList = [...list];
  newList[idx] = updated;
  return { list: newList, entries };
}

function formatAuditValue(v: unknown): string {
  if (v === null || v === undefined || v === "") return "–";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  return String(v);
}

function withDuplicate<T extends Identifiable & Lifecycle>(list: T[], id: string, overrides?: Partial<T>): T[] {
  const item = list.find((i) => i.id === id);
  if (!item) return list;
  const at = nowIso();
  return [{ ...item, ...overrides, id: uid(), createdAt: at, updatedAt: at, editCount: 0 }, ...list];
}
/**
 * Çdo ndryshim i lifecycle-it (fshirje, rikthim, arkivim) rrit `updatedAt`.
 * Sync-u dërgon vetëm ç'ka `updatedAt` pas sync-ut të fundit dhe shkrin
 * sipas tij: pa këtë, një fshirje në telefon s'arrinte kurrë te serveri dhe
 * shënimi mbetej i dukshëm te webi.
 */
function touch<T extends Lifecycle>(item: T, patch: Partial<T>, at: string): T {
  return { ...item, ...patch, updatedAt: at, editCount: item.editCount + 1 };
}
function withLifecycle<T extends Identifiable & Lifecycle>(list: T[], ids: string[], patch: (at: string) => Partial<Lifecycle>): T[] {
  const at = nowIso();
  return list.map((item) => (ids.includes(item.id) ? touch(item, patch(at) as Partial<T>, at) : item));
}
function withSoftDelete<T extends Identifiable & Lifecycle>(list: T[], id: string): T[] {
  return withLifecycle(list, [id], (at) => ({ deletedAt: at }));
}
function withRestore<T extends Identifiable & Lifecycle>(list: T[], id: string): T[] {
  return withLifecycle(list, [id], () => ({ deletedAt: null }));
}
function withArchive<T extends Identifiable & Lifecycle>(list: T[], id: string): T[] {
  return withLifecycle(list, [id], (at) => ({ archivedAt: at }));
}
function withUnarchive<T extends Identifiable & Lifecycle>(list: T[], id: string): T[] {
  return withLifecycle(list, [id], () => ({ archivedAt: null }));
}
/** E njëjta për shumë shënime njëherësh (zgjedhja te Ditari). */
function bulkLifecycle(
  b: BabyModuleState,
  items: { kind: RecordKind; id: string }[],
  patch: (at: string) => Partial<Lifecycle>
): Partial<BabyModuleState> {
  const ids = (k: RecordKind) => items.filter((i) => i.kind === k).map((i) => i.id);
  return {
    feedingLog: withLifecycle(b.feedingLog, ids("feeding"), patch),
    sleepLog: withLifecycle(b.sleepLog, ids("sleep"), patch),
    diaperLog: withLifecycle(b.diaperLog, ids("diaper"), patch),
    growthHistory: withLifecycle(b.growthHistory, ids("growthHistory"), patch),
    vaccines: withLifecycle(b.vaccines, ids("vaccine"), patch),
    medicalRecords: withLifecycle(b.medicalRecords, ids("medical"), patch),
    timeline: withLifecycle(b.timeline, ids("timeline"), patch),
  };
}

/** Records visible in normal lists: not deleted, not archived. */
export function active<T extends Lifecycle>(list: T[]): T[] {
  return list.filter((item) => !item.deletedAt && !item.archivedAt);
}
/** Records visible in "Archived Records". */
export function archived<T extends Lifecycle>(list: T[]): T[] {
  return list.filter((item) => !item.deletedAt && !!item.archivedAt);
}

type Action =
  | { type: "SET_DARK_MODE"; value: boolean }
  | { type: "UPDATE_PROFILE"; value: Partial<BabyProfile> }
  | { type: "TOGGLE_FAVORITE"; item: FavoriteItem }
  | { type: "ADD_MEMORY"; memory: MemoryPhoto }
  | { type: "REMOVE_MEMORY"; id: string }
  | { type: "BUMP_CART"; delta: number }
  | { type: "ADD_TO_CART"; item: CartItem }
  | { type: "REMOVE_FROM_CART"; id: string }
  | { type: "UPDATE_CART_QTY"; id: string; qty: number }
  | { type: "CLEAR_CART" }
  | { type: "SET_BABY"; value: Partial<BabyModuleState> }
  | { type: "UPDATE_BABY"; fn: (cur: BabyModuleState) => Partial<BabyModuleState> }
  | { type: "REPLACE_CART"; items: CartItem[] }
  | { type: "MERGE_BABY_RECORDS"; value: Partial<BabyModuleState> }
  | { type: "SET_NOTIFICATION_PREF"; key: NotificationKey; value: boolean }
  | { type: "SET_QUIET_HOURS"; from: number; to: number }
  | { type: "SET_REMINDER_GAP"; kind: "feeding" | "diaper"; hours: number }
  | { type: "SET_READ_NOTIFICATIONS"; ids: string[] }
  | { type: "HYDRATE"; state: AppState };

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "SET_DARK_MODE":
      return { ...state, darkMode: action.value, themeChosen: true };
    case "UPDATE_PROFILE":
      return { ...state, profile: { ...state.profile, ...action.value } };
    case "TOGGLE_FAVORITE": {
      const exists = state.favorites.some((f) => f.id === action.item.id);
      return {
        ...state,
        favorites: exists
          ? state.favorites.filter((f) => f.id !== action.item.id)
          : [...state.favorites, action.item],
      };
    }
    case "ADD_MEMORY":
      return { ...state, memories: [...state.memories, action.memory] };
    case "REMOVE_MEMORY":
      return { ...state, memories: state.memories.filter((m) => m.id !== action.id) };
    case "BUMP_CART":
      return { ...state, cartCount: Math.max(0, state.cartCount + action.delta) };
      case "ADD_TO_CART": {
      const existing = state.cartItems.find((i) => i.id === action.item.id);
      const cartItems = existing
        ? state.cartItems.map((i) => (i.id === action.item.id ? { ...i, qty: Math.min(MAX_CART_QTY, i.qty + action.item.qty) } : i))
        : [...state.cartItems, action.item];
      return { ...state, cartItems, cartCount: cartItems.reduce((s, i) => s + i.qty, 0) };
    }
    case "REMOVE_FROM_CART": {
      const cartItems = state.cartItems.filter((i) => i.id !== action.id);
      return { ...state, cartItems, cartCount: cartItems.reduce((s, i) => s + i.qty, 0) };
    }
    case "UPDATE_CART_QTY": {
      const cartItems = state.cartItems
        .map((i) => (i.id === action.id ? { ...i, qty: Math.min(MAX_CART_QTY, Math.max(0, action.qty)) } : i))
        .filter((i) => i.qty > 0);
      return { ...state, cartItems, cartCount: cartItems.reduce((s, i) => s + i.qty, 0) };
    }
    case "CLEAR_CART":
      return { ...state, cartItems: [], cartCount: 0 };
    case "SET_BABY":
      return { ...state, baby: { ...state.baby, ...action.value } };
    case "UPDATE_BABY": {
      const patch = action.fn(state.baby);
      return Object.keys(patch).length ? { ...state, baby: { ...state.baby, ...patch } } : state;
    }
    case "REPLACE_CART":
      return { ...state, cartItems: action.items, cartCount: action.items.reduce((s, i) => s + i.qty, 0) };
    case "MERGE_BABY_RECORDS":
      return { ...state, baby: { ...state.baby, ...mergeRecordsPatch(state.baby, action.value) } };
    case "SET_NOTIFICATION_PREF":
      return {
        ...state,
        notificationPrefs: {
          ...state.notificationPrefs,
          keys: { ...state.notificationPrefs.keys, [action.key]: action.value },
        },
      };

    case "SET_QUIET_HOURS":
      return {
        ...state,
        notificationPrefs: { ...state.notificationPrefs, quietFrom: action.from, quietTo: action.to },
      };
    case "SET_REMINDER_GAP":
      return {
        ...state,
        notificationPrefs: {
          ...state.notificationPrefs,
          [action.kind === "feeding" ? "feedingGapH" : "diaperGapH"]: clampGap(action.hours),
        },
      };
    case "SET_READ_NOTIFICATIONS":
      return { ...state, readNotificationIds: action.ids };
    case "HYDRATE":
      // Merr shtetin e ruajtur, por siguron që fushat e reja (si
      // `notificationPrefs`) ekzistojnë edhe nëse instalimi i vjetër i
      // ruajtur s'i ka ende (p.sh. app i instaluar përpara këtij update-i).
      return {
        ...initialAppState,
        ...action.state,
        // Listat e reja qe s'ishin te versioni i ruajtur marrin vleren fillestare.
        baby: { ...initialAppState.baby, ...((action.state as AppState).baby ?? {}) },
        cartItems: (action.state as AppState).cartItems ?? initialAppState.cartItems,
        // Instalimet e vjetra kane celesa si `feedingReminders`; pa migrim,
        // zgjedhjet e tyre do te zhdukeshin pa zhurme.
        notificationPrefs: migrateNotificationPrefs((action.state as AppState).notificationPrefs),
        readNotificationIds: (action.state as AppState).readNotificationIds ?? [],
      };
    default:
      return state;
  }
}

/** Vlera e kontekstit: buildValue plus flag-u i ngarkimit nga AsyncStorage. */
type AppStateValue = ReturnType<typeof buildValue> & { hydrated: boolean; refreshProfileFromServer: () => void };

const AppStateContext = createContext<AppStateValue | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialAppState);
  // Sync-u me Supabase s'duhet te nise para ngarkimit nga AsyncStorage:
  // state-i bosh do e shenonte migrimin si te kryer pa derguar asgje.
  const [hydrated, setHydrated] = useState(false);
  // Rritet kur ndryshon pronari i të dhënave (familja): profili rimerret.
  const [profileRefresh, setProfileRefresh] = useState(0);
  const { setColorScheme } = useNativeWindColorScheme();

  useEffect(() => {
    let alive = true;
    void loadAppState().then(async ({ state: stored, failed }) => {
      if (!alive) return;
      // Diçka s'u lexua dot: historiku rimerret i plotë nga serveri në sync-un
      // e radhës, në vend që telefoni të mbetet me një kopje të cunguar.
      if (failed) await resetBabyRecordsSyncState();
      if (stored) {
        let baby = stored.baby;
        if (!stored.seedCleanupDone && baby) {
          const patch = cleanupSeedBabyData({ ...initialAppState.baby, ...baby });
          if (patch) baby = { ...baby, ...patch };
        }
        const darkMode = stored.themeChosen ? stored.darkMode : false;
        dispatch({ type: "HYDRATE", state: { ...stored, baby, darkMode, seedCleanupDone: true } as AppState });
      }
      setHydrated(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  // Ruajtja: kurrë para ngarkimit (do të mbishkruante historikun me gjendjen
  // bosh), me vonesë të shkurtër që disa prekje radhazi të shkojnë bashkë, dhe
  // menjëherë kur app-i del në sfond (sistemi mund ta mbyllë pa paralajmërim).
  const latestState = useRef(state);
  const hydratedRef = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    latestState.current = state;
    hydratedRef.current = hydrated;
    if (!hydrated) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => void saveAppState(latestState.current), 400);
  }, [state, hydrated]);

  useEffect(() => {
    const subscription = RNAppState.addEventListener("change", (next) => {
      if (next === "active" || !hydratedRef.current) return;
      clearTimeout(saveTimer.current);
      void saveAppState(latestState.current);
    });
    return () => {
      subscription.remove();
      clearTimeout(saveTimer.current);
    };
  }, []);

  // Pas ngarkimit, cilesimet e njoftimeve i shkojne edhe serverit: kujtesat
  // e vaksinave dhe statusi i porosise dergohen prej andej, jo nga telefoni.
  useEffect(() => {
    if (!hydrated) return;
    void syncNotificationSettings(state.notificationPrefs);
  }, [hydrated, state.notificationPrefs]);

  // Profili i bebit nga serveri: emri dhe data e lindjes (telefoni i ri,
  // prindi i dytë i familjes, ri-instalimi). Nëse ndryshimi lokal s'ka arritur
  // ende në server, dërgohet ai — nuk mbishkruhet me versionin e vjetër.
  useEffect(() => {
    if (!hydrated) return;
    let alive = true;
    void (async () => {
      const profile = latestState.current.profile;
      if (await isBabyProfilePending()) {
        const dob = profile.babyDob ? localDateKey(new Date(profile.babyDob)) : null;
        await saveBabyProfileRemote(profile.babyName, dob);
        return;
      }
      const basics = await fetchBabyProfileBasics().catch(() => null);
      if (!alive || !basics) return;
      const patch: Partial<BabyProfile> = {};
      if (basics.babyName && basics.babyName !== profile.babyName) patch.babyName = basics.babyName;
      if (basics.babyDob) {
        const [y, m, d] = basics.babyDob.slice(0, 10).split("-").map(Number);
        const same = profile.babyDob && localDateKey(new Date(profile.babyDob)) === basics.babyDob.slice(0, 10);
        if (!same && y && m && d) patch.babyDob = new Date(y, m - 1, d).toISOString();
      }
      if (Object.keys(patch).length) dispatch({ type: "UPDATE_PROFILE", value: patch });
    })();
    return () => {
      alive = false;
    };
  }, [hydrated, profileRefresh]);

  // Sapo hyrja përfundon (ose rikthehet sesioni), profili dhe fotot rimerren:
  // kërkesat e nisura para sesionit shkonin si të paidentifikuara dhe serveri
  // i refuzonte (fotoja private e bebit s'dilte).
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "INITIAL_SESSION") setProfileRefresh((v) => v + 1);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  // Cilësimet e bebit (gjinia, gjaku, alergjitë, kontaktet, info mjekësore)
  // te serveri. Tërheqja: pas ngarkimit dhe kur ndryshon llogaria/familja.
  // Nëse ka ndryshim lokal të padërguar, ai fiton dhe dërgohet.
  const lastDetailsSent = useRef<string | null>(null);
  useEffect(() => {
    if (!hydrated) return;
    let alive = true;
    // Asnjë dërgim derisa të dihet çfarë ka serveri: pas ndërrimit të familjes,
    // gjendja e pastruar përndryshe mund të mbishkruante detajet e pronarit.
    lastDetailsSent.current = null;
    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session || !alive) return;
      const local = detailsFromState(latestState.current);
      if (await isProfileDetailsPending()) {
        if (await saveProfileDetailsRemote(local)) lastDetailsSent.current = JSON.stringify(local);
        return;
      }
      const remote = await fetchProfileDetails().catch(() => null);
      if (!alive) return;
      if (!remote) {
        // Serveri s'ka ende detaje: dërgohen ato të telefonit (instalimet e vjetra).
        if (await saveProfileDetailsRemote(local)) lastDetailsSent.current = JSON.stringify(local);
        return;
      }
      const { emergencyContacts, medicalInfo, medicalActiveKeys, ...profilePart } = remote;
      if (Object.keys(profilePart).length) dispatch({ type: "UPDATE_PROFILE", value: profilePart });
      const babyPart = {
        ...(emergencyContacts ? { emergencyContacts } : {}),
        ...(medicalInfo ? { medicalInfo } : {}),
        ...(medicalActiveKeys ? { medicalActiveKeys } : {}),
      };
      if (Object.keys(babyPart).length) dispatch({ type: "UPDATE_BABY", fn: () => babyPart });
      lastDetailsSent.current = JSON.stringify({ ...local, ...remote });
    })();
    return () => {
      alive = false;
    };
  }, [hydrated, profileRefresh]);

  // Dërgimi: pak pas çdo ndryshimi të këtyre fushave, nga cilido ekran.
  const detailsKey = hydrated ? JSON.stringify(detailsFromState(state)) : null;
  useEffect(() => {
    if (!detailsKey || lastDetailsSent.current === null || detailsKey === lastDetailsSent.current) return;
    const timer = setTimeout(() => {
      const details = JSON.parse(detailsKey);
      void saveProfileDetailsRemote(details).then((ok) => {
        if (ok) lastDetailsSent.current = detailsKey;
      });
    }, 1500);
    return () => clearTimeout(timer);
  }, [detailsKey]);

  // Fotot e profilit. Rruga lokale (nga ky telefon) dhe ajo e serverit
  // (e ruajtur qe prindi/bebi ta rigjejne edhe ne nje pajisje tjeter, ose
  // pas nje ri-instalimi) merren te dyja; e serverit fiton kur ndryshojne,
  // sepse ajo eshte burimi i qendrueshem. Pastaj kerkohet nje URL e re per
  // shfaqje, qe fotoja te mos "zhduket" pa asnje shenje kur URL-ja e vjeter
  // skadon.
  useEffect(() => {
    if (!hydrated) return;
    let alive = true;

    void (async () => {
      // Pa sesion, serveri e refuzon foton private: pritet hyrja (efekti
      // rinis me `profileRefresh` sapo sesioni të jetë gati).
      const { data: auth } = await supabase.auth.getSession();
      if (!auth.session || !alive) return;
      const remote = await fetchProfilePhotoPaths();

      const paths: { path: string | null; pathKey: "babyPhotoPath" | "parentPhotoPath"; urlKey: "babyPhoto" | "parentPhoto" }[] = [
        {
          path: remote?.babyPhotoPath ?? state.profile.babyPhotoPath,
          pathKey: "babyPhotoPath",
          urlKey: "babyPhoto",
        },
        {
          path: remote?.parentPhotoPath ?? state.profile.parentPhotoPath,
          pathKey: "parentPhotoPath",
          urlKey: "parentPhoto",
        },
      ];

      for (const { path, pathKey, urlKey } of paths) {
        if (!path || !alive) continue;
        if (path !== state.profile[pathKey]) {
          dispatch({ type: "UPDATE_PROFILE", value: { [pathKey]: path } });
        }
        const url = await signedUrlForProfilePhoto(path);
        if (alive && url) dispatch({ type: "UPDATE_PROFILE", value: { [urlKey]: url } });
      }
    })();

    return () => {
      alive = false;
    };
    // Pas ngarkimit dhe kur ndryshon pronari i të dhënave: URL-ja vlen një
    // javë dhe rifreskohet në hapjen tjetër. Varësia te vetë rrugët do të
    // rinisej në çdo ndryshim.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, profileRefresh]);

  // Real dark mode: whenever the user's chosen darkMode value changes,
  // sync NativeWind's color scheme so every `dark:` class in the app
  // (not just this screen) updates automatically.
  // Requires `darkMode: "class"` in tailwind.config.js.
  useEffect(() => {
    setColorScheme(state.darkMode ? "dark" : "light");
  }, [state.darkMode, setColorScheme]);

  const value = { ...buildValue(state, dispatch), hydrated, refreshProfileFromServer: () => setProfileRefresh((v) => v + 1) };
  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

function buildValue(state: AppState, dispatch: React.Dispatch<Action>) {
  const b = state.baby;
  /**
   * Çdo ndryshim i bebit llogaritet mbi gjendjen e ÇASTIT (brenda reducer-it),
   * jo mbi `b` të render-it. Pa këtë, një veprim pas një pritjeje (p.sh. pasi
   * mbyllet zgjedhësi i fotos) llogariste listën nga një kopje e vjetër dhe
   * zëvendësonte shënimet që sync-u kishte sjellë ndërkohë nga webi.
   */
  const update = (fn: (cur: BabyModuleState) => Partial<BabyModuleState>) => dispatch({ type: "UPDATE_BABY", fn });

  /** Shton hyrje në ditarin e ndryshimeve, brenda të njëjtit përditësim. */
  function audit(cur: BabyModuleState, entries: AuditEntry[]): Partial<BabyModuleState> {
    return entries.length ? { auditLog: capAudit([...cur.auditLog, ...entries]) } : {};
  }
  function simpleEntry(kind: RecordKind, recordId: string, recordLabel: string, field: string, oldValue: string, newValue: string): AuditEntry[] {
    if (oldValue === newValue) return [];
    return [{ id: uid(), recordKind: kind, recordId, recordLabel, field, fieldLabel: field, oldValue: oldValue || "–", newValue: newValue || "–", at: nowIso() }];
  }

  return {
    state,
    /** Aplikon listat e shkrira nga sync-u i baby_records. */
    // Shkrihet me gjendjen në çastin e zbatimit (reducer), jo me atë nga e
    // cila nisi sync-u — përndryshe një shënim i shtuar gjatë sync-ut humbet.
    applyBabyRecordsPatch: (patch: Partial<BabyModuleState>) => dispatch({ type: "MERGE_BABY_RECORDS", value: patch }),
    setDarkMode: (value: boolean) => dispatch({ type: "SET_DARK_MODE", value }),
    updateProfile: (value: Partial<BabyProfile>) => dispatch({ type: "UPDATE_PROFILE", value }),
    toggleFavorite: (item: FavoriteItem) => dispatch({ type: "TOGGLE_FAVORITE", item }),
    isFavorite: (id: string) => state.favorites.some((f) => f.id === id),
    addMemory: (memory: MemoryPhoto) => dispatch({ type: "ADD_MEMORY", memory }),
    removeMemory: (id: string) => dispatch({ type: "REMOVE_MEMORY", id }),
    bumpCart: (delta = 1) => dispatch({ type: "BUMP_CART", delta }),
    addToCart: (item: Omit<CartItem, "qty">, qty = 1) => dispatch({ type: "ADD_TO_CART", item: { ...item, qty } }),
    removeFromCart: (id: string) => dispatch({ type: "REMOVE_FROM_CART", id }),
    updateCartQty: (id: string, qty: number) => dispatch({ type: "UPDATE_CART_QTY", id, qty }),
    /** Çmimet/emrat e rifreskuar nga serveri para arkëtimit. */
    replaceCartItems: (items: CartItem[]) => dispatch({ type: "REPLACE_CART", items }),
    clearCart: () => dispatch({ type: "CLEAR_CART" }),
    cartTotal: () => state.cartItems.reduce((sum, i) => sum + i.price * i.qty, 0),
    /**
     * Pastron të dhënat e bebit në telefon. `keepParent`: kur ndryshon vetëm
     * familja (pronari i të dhënave), emri dhe fotoja e prindit mbeten — janë
     * të llogarisë, jo të bebit.
     */
    resetBabyData: (options?: { keepParent?: boolean }) => {
      const p = state.profile;
      dispatch({
        type: "UPDATE_PROFILE",
        value: options?.keepParent
          ? { ...initialAppState.profile, parentName: p.parentName, relation: p.relation, parentPhoto: p.parentPhoto, parentPhotoPath: p.parentPhotoPath }
          : initialAppState.profile,
      });
      dispatch({ type: "SET_BABY", value: initialAppState.baby });
    },

    // ---- Notification preferences ----
    /**
     * Shënon njoftimet si të lexuara. Ruhen vetëm id-të që ekzistojnë ende
     * (`currentIds`), që lista të mos rritet pa fund me kujtesa të vjetra.
     */
    markNotificationsRead: (ids: string[], currentIds: string[]) => {
      const current = new Set(currentIds);
      const next = new Set([...state.readNotificationIds, ...ids].filter((id) => current.has(id)));
      dispatch({ type: "SET_READ_NOTIFICATIONS", ids: [...next] });
    },
    setQuietHours: (from: number, to: number) => dispatch({ type: "SET_QUIET_HOURS", from, to }),
    setReminderGap: (kind: "feeding" | "diaper", hours: number) => dispatch({ type: "SET_REMINDER_GAP", kind, hours }),
    setNotificationPref: (key: NotificationKey, value: boolean) =>
      // Dergimi te serveri behet nga efekti me poshte, qe mbulon edhe
      // ngarkimin e pare — jo ketu, qe te mos kete dy rruge per te njejten gje.
      dispatch({ type: "SET_NOTIFICATION_PREF", key, value }),

    baby: {
      // ---- Growth stat cards (profile summary) ----
      addGrowthStat: (key: string) =>
        update((cur) => {
          const preset = growthCatalog.find((g) => g.key === key);
          if (!preset || cur.growthActiveKeys.includes(key)) return {};
          return { growthStats: [...cur.growthStats, preset], growthActiveKeys: [...cur.growthActiveKeys, key] };
        }),
      addCustomGrowthStat: (label: string, value: string) => {
        const key = `custom:${uid()}`;
        const stat: GrowthStat = { key, label, value, isCustom: true };
        update((cur) => ({ growthStats: [...cur.growthStats, stat], growthActiveKeys: [...cur.growthActiveKeys, key] }));
      },
      removeGrowthStat: (key: string) =>
        update((cur) => ({
          growthStats: cur.growthStats.filter((g) => g.key !== key),
          growthActiveKeys: cur.growthActiveKeys.filter((k) => k !== key),
        })),
      updateGrowthStat: (key: string, patch: Partial<Pick<GrowthStat, "value" | "label">>) =>
        update((cur) => {
          const stat = cur.growthStats.find((g) => g.key === key);
          const entries =
            stat && patch.value !== undefined
              ? simpleEntry("growthHistory", key, stat.label ?? stat.labelKey ?? key, "value", stat.value, patch.value)
              : [];
          return { growthStats: cur.growthStats.map((g) => (g.key === key ? { ...g, ...patch } : g)), ...audit(cur, entries) };
        }),
      availableGrowthPresets: () => growthCatalog.filter((g) => !b.growthActiveKeys.includes(g.key)),

      // ---- Growth history (measurements over time) ----
      addGrowthHistoryEntry: (entry: Partial<GrowthHistoryEntry>) => {
        const at = nowIso();
        const item: GrowthHistoryEntry = {
          id: uid(), date: at, weightKg: null, heightCm: null, headCm: null, note: "",
          createdAt: at, updatedAt: at, editCount: 0, deletedAt: null, archivedAt: null,
          ...entry,
        };
        update((cur) => ({ growthHistory: withAdd(cur.growthHistory, item) }));
      },
      updateGrowthHistoryEntry: (id: string, patch: Partial<GrowthHistoryEntry>) =>
        update((cur) => {
          const { list, entries } = diffAndTrack(cur.growthHistory, id, patch, "growthHistory", "growth measurement");
          return { growthHistory: list, ...audit(cur, entries) };
        }),
      duplicateGrowthHistoryEntry: (id: string) => update((cur) => ({ growthHistory: withDuplicate(cur.growthHistory, id, { date: nowIso() }) })),
      deleteGrowthHistoryEntry: (id: string) => update((cur) => ({ growthHistory: withSoftDelete(cur.growthHistory, id) })),
      restoreGrowthHistoryEntry: (id: string) => update((cur) => ({ growthHistory: withRestore(cur.growthHistory, id) })),
      archiveGrowthHistoryEntry: (id: string) => update((cur) => ({ growthHistory: withArchive(cur.growthHistory, id) })),
      unarchiveGrowthHistoryEntry: (id: string) => update((cur) => ({ growthHistory: withUnarchive(cur.growthHistory, id) })),

      // ---- Quick actions ----
      addQuickAction: (key: QuickActionKey) =>
        update((cur) => (cur.quickActionKeys.includes(key) ? {} : { quickActionKeys: [...cur.quickActionKeys, key] })),
      removeQuickAction: (key: QuickActionKey) => update((cur) => ({ quickActionKeys: cur.quickActionKeys.filter((k) => k !== key) })),

      // ---- Medical info (profile summary rows) ----
      addMedicalRow: (key: string) =>
        update((cur) => {
          const preset = medicalCatalog.find((m) => m.key === key);
          if (!preset || cur.medicalActiveKeys.includes(key)) return {};
          return {
            medicalInfo: [...cur.medicalInfo.filter((m) => m.key !== key), preset],
            medicalActiveKeys: [...cur.medicalActiveKeys, key],
          };
        }),
      addCustomMedicalRow: (label: string, value: string) => {
        const key = `custom:${uid()}`;
        const row: MedicalInfoRow = { key, label, value, isCustom: true };
        update((cur) => ({ medicalInfo: [...cur.medicalInfo, row], medicalActiveKeys: [...cur.medicalActiveKeys, key] }));
      },
      /** Grupi i gjakut, pediatri dhe alergjitë nga cilësimet → rreshtat e "Info mjekësore". */
      syncMedicalFromProfile: (profile: ProfileMedical) =>
        update((cur) => applyProfileToMedical(cur.medicalInfo, cur.medicalActiveKeys, profile)),
      removeMedicalRow: (key: string) => update((cur) => ({ medicalActiveKeys: cur.medicalActiveKeys.filter((k) => k !== key) })),
      updateMedicalRow: (key: string, patch: Partial<Pick<MedicalInfoRow, "value" | "label">>) =>
        update((cur) => {
          const row = cur.medicalInfo.find((m) => m.key === key);
          const entries =
            row && patch.value !== undefined
              ? simpleEntry("medical", key, row.label ?? row.labelKey ?? key, "value", row.value, patch.value)
              : [];
          return { medicalInfo: cur.medicalInfo.map((m) => (m.key === key ? { ...m, ...patch } : m)), ...audit(cur, entries) };
        }),
      availableMedicalPresets: () => medicalCatalog.filter((m) => !b.medicalActiveKeys.includes(m.key)),

      // ---- Milestones ----
      addMilestone: (key: string) =>
        update((cur) => {
          const preset = milestoneCatalog.find((m) => m.key === key);
          if (!preset || cur.milestoneActiveKeys.includes(key)) return {};
          return {
            milestones: [...cur.milestones.filter((m) => m.key !== key), preset],
            milestoneActiveKeys: [...cur.milestoneActiveKeys, key],
          };
        }),
      addCustomMilestone: (label: string) => {
        const key = `custom:${uid()}`;
        const item: MilestoneItem = { key, label, done: false, isCustom: true };
        update((cur) => ({ milestones: [...cur.milestones, item], milestoneActiveKeys: [...cur.milestoneActiveKeys, key] }));
      },
      removeMilestone: (key: string) => update((cur) => ({ milestoneActiveKeys: cur.milestoneActiveKeys.filter((k) => k !== key) })),
      toggleMilestone: (key: string) =>
        update((cur) => {
          const m = cur.milestones.find((mm) => mm.key === key);
          const entries = m ? simpleEntry("timeline", key, m.label ?? m.labelKey ?? key, "done", String(m.done), String(!m.done)) : [];
          return { milestones: cur.milestones.map((mm) => (mm.key === key ? { ...mm, done: !mm.done } : mm)), ...audit(cur, entries) };
        }),
      updateMilestoneLabel: (key: string, label: string) =>
        update((cur) => ({ milestones: cur.milestones.map((m) => (m.key === key ? { ...m, label } : m)) })),
      availableMilestonePresets: () => milestoneCatalog.filter((m) => !b.milestoneActiveKeys.includes(m.key)),

      // ---- Timeline (unified, also manually-added custom events) ----
      addTimelineEvent: (title: string, date: string) => {
        const at = nowIso();
        const event: TimelineEvent = { id: uid(), title, date, color: "olive", note: "", createdAt: at, updatedAt: at, editCount: 0, deletedAt: null, archivedAt: null };
        update((cur) => ({ timeline: withAdd(cur.timeline, event) }));
      },
      updateTimelineEvent: (id: string, patch: Partial<TimelineEvent>) =>
        update((cur) => {
          const { list, entries } = diffAndTrack(cur.timeline, id, patch, "timeline", "event");
          return { timeline: list, ...audit(cur, entries) };
        }),
      duplicateTimelineEvent: (id: string) => update((cur) => ({ timeline: withDuplicate(cur.timeline, id) })),
      deleteTimelineEvent: (id: string) => update((cur) => ({ timeline: withSoftDelete(cur.timeline, id) })),
      restoreTimelineEvent: (id: string) => update((cur) => ({ timeline: withRestore(cur.timeline, id) })),
      archiveTimelineEvent: (id: string) => update((cur) => ({ timeline: withArchive(cur.timeline, id) })),
      unarchiveTimelineEvent: (id: string) => update((cur) => ({ timeline: withUnarchive(cur.timeline, id) })),

      // ---- Feeding ----
      addFeedingEntry: (entry: Partial<FeedingEntry>) => {
        const at = nowIso();
        const item: FeedingEntry = {
          id: uid(), type: "bottle", amountMl: null, durationMin: null, side: null, foodCategory: null,
          at, note: "", createdAt: at, updatedAt: at, editCount: 0, deletedAt: null, archivedAt: null,
          ...entry,
        };
        update((cur) => ({ feedingLog: withAdd(cur.feedingLog, item) }));
        return item.id;
      },
      updateFeedingEntry: (id: string, patch: Partial<FeedingEntry>) =>
        update((cur) => {
          const { list, entries } = diffAndTrack(cur.feedingLog, id, patch, "feeding", "feeding");
          return { feedingLog: list, ...audit(cur, entries) };
        }),
      // Smart duplicate: never copy the original timestamp — a duplicated
      // feeding is logged as happening now, not back-dated to the original.
      duplicateFeedingEntry: (id: string) => update((cur) => ({ feedingLog: withDuplicate(cur.feedingLog, id, { at: nowIso() }) })),
      deleteFeedingEntry: (id: string) => update((cur) => ({ feedingLog: withSoftDelete(cur.feedingLog, id) })),
      restoreFeedingEntry: (id: string) => update((cur) => ({ feedingLog: withRestore(cur.feedingLog, id) })),
      archiveFeedingEntry: (id: string) => update((cur) => ({ feedingLog: withArchive(cur.feedingLog, id) })),
      unarchiveFeedingEntry: (id: string) => update((cur) => ({ feedingLog: withUnarchive(cur.feedingLog, id) })),

      // ---- Sleep ----
      startSleep: (isNap: boolean) => {
        const at = nowIso();
        const item: SleepEntry = {
          id: uid(), startAt: at, endAt: null, pausedIntervalsMin: 0, pausedAt: null, isNap, quality: null,
          note: "", createdAt: at, updatedAt: at, editCount: 0, deletedAt: null, archivedAt: null,
        };
        update((cur) => ({ sleepLog: withAdd(cur.sleepLog, item) }));
      },
      // Pauza, vazhdimi dhe mbyllja rrisin `updatedAt`: pa të, sync-u s'e
      // dërgonte ndryshimin dhe webi e tregonte gjumin "në vazhdim" përgjithmonë.
      pauseSleep: (id: string) => {
        const at = nowIso();
        update((cur) => ({ sleepLog: cur.sleepLog.map((s) => (s.id === id ? { ...s, pausedAt: at, updatedAt: at, editCount: s.editCount + 1 } : s)) }));
      },
      resumeSleep: (id: string) => {
        const at = nowIso();
        const nowMs = Date.now();
        update((cur) => {
          const entry = cur.sleepLog.find((s) => s.id === id);
          if (!entry?.pausedAt) return {};
          const pausedMin = Math.round((nowMs - new Date(entry.pausedAt).getTime()) / 60000);
          return {
            sleepLog: cur.sleepLog.map((s) =>
              s.id === id
                ? { ...s, pausedAt: null, pausedIntervalsMin: s.pausedIntervalsMin + pausedMin, updatedAt: at, editCount: s.editCount + 1 }
                : s
            ),
          };
        });
      },
      endSleep: (id: string) => {
        const at = nowIso();
        update((cur) => ({ sleepLog: cur.sleepLog.map((s) => (s.id === id ? { ...s, endAt: at, updatedAt: at, editCount: s.editCount + 1 } : s)) }));
      },
      updateSleepEntry: (id: string, patch: Partial<SleepEntry>) =>
        update((cur) => {
          const { list, entries } = diffAndTrack(cur.sleepLog, id, patch, "sleep", "sleep");
          return { sleepLog: list, ...audit(cur, entries) };
        }),
      duplicateSleepEntry: (id: string) =>
        update((cur) => ({ sleepLog: withDuplicate(cur.sleepLog, id, { startAt: nowIso(), endAt: null, pausedAt: null }) })),
      deleteSleepEntry: (id: string) => update((cur) => ({ sleepLog: withSoftDelete(cur.sleepLog, id) })),
      restoreSleepEntry: (id: string) => update((cur) => ({ sleepLog: withRestore(cur.sleepLog, id) })),
      archiveSleepEntry: (id: string) => update((cur) => ({ sleepLog: withArchive(cur.sleepLog, id) })),
      unarchiveSleepEntry: (id: string) => update((cur) => ({ sleepLog: withUnarchive(cur.sleepLog, id) })),

      // ---- Diaper ----
      addDiaperEntry: (entry: Partial<DiaperEntry>) => {
        const at = nowIso();
        const item: DiaperEntry = {
          id: uid(), type: "wet", color: null, consistency: null, at, note: "",
          createdAt: at, updatedAt: at, editCount: 0, deletedAt: null, archivedAt: null,
          ...entry,
        };
        update((cur) => ({ diaperLog: withAdd(cur.diaperLog, item) }));
        return item.id;
      },
      updateDiaperEntry: (id: string, patch: Partial<DiaperEntry>) =>
        update((cur) => {
          const { list, entries } = diffAndTrack(cur.diaperLog, id, patch, "diaper", "diaper");
          return { diaperLog: list, ...audit(cur, entries) };
        }),
      duplicateDiaperEntry: (id: string) => update((cur) => ({ diaperLog: withDuplicate(cur.diaperLog, id, { at: nowIso() }) })),
      deleteDiaperEntry: (id: string) => update((cur) => ({ diaperLog: withSoftDelete(cur.diaperLog, id) })),
      restoreDiaperEntry: (id: string) => update((cur) => ({ diaperLog: withRestore(cur.diaperLog, id) })),
      archiveDiaperEntry: (id: string) => update((cur) => ({ diaperLog: withArchive(cur.diaperLog, id) })),
      unarchiveDiaperEntry: (id: string) => update((cur) => ({ diaperLog: withUnarchive(cur.diaperLog, id) })),

      // ---- Vaccinations ----
      addVaccine: (entry: Partial<VaccineEntry> & { name: string; dueDate: string }) => {
        const at = nowIso();
        const item: VaccineEntry = {
          id: uid(), description: "", givenDate: null, doctor: "", clinic: "", batchNumber: "", note: "",
          reminderEnabled: true, createdAt: at, updatedAt: at, editCount: 0, deletedAt: null, archivedAt: null,
          ...entry,
        };
        update((cur) => ({ vaccines: withAdd(cur.vaccines, item) }));
      },
      updateVaccine: (id: string, patch: Partial<VaccineEntry>) =>
        update((cur) => {
          const { list, entries } = diffAndTrack(cur.vaccines, id, patch, "vaccine", "vaccine");
          return { vaccines: list, ...audit(cur, entries) };
        }),
      markVaccineDone: (id: string) => {
        const givenDate = nowIso();
        update((cur) => {
          const { list, entries } = diffAndTrack(cur.vaccines, id, { givenDate } as Partial<VaccineEntry>, "vaccine", "vaccine");
          return { vaccines: list, ...audit(cur, entries) };
        });
      },
      duplicateVaccine: (id: string) => update((cur) => ({ vaccines: withDuplicate(cur.vaccines, id, { givenDate: null }) })),
      deleteVaccine: (id: string) => update((cur) => ({ vaccines: withSoftDelete(cur.vaccines, id) })),
      restoreVaccine: (id: string) => update((cur) => ({ vaccines: withRestore(cur.vaccines, id) })),
      archiveVaccine: (id: string) => update((cur) => ({ vaccines: withArchive(cur.vaccines, id) })),
      unarchiveVaccine: (id: string) => update((cur) => ({ vaccines: withUnarchive(cur.vaccines, id) })),

      // ---- Moments ----
      addMoment: (entry: Partial<Moment> & { type: Moment["type"] }) => {
        const at = nowIso();
        const item: Moment = {
          id: uid(), uri: null, title: "", description: "", date: at, tags: [], favorite: false,
          createdAt: at, updatedAt: at, editCount: 0, deletedAt: null, archivedAt: null,
          ...entry,
        };
        update((cur) => ({ moments: withAdd(cur.moments, item) }));
      },
      updateMoment: (id: string, patch: Partial<Moment>) =>
        update((cur) => {
          const { list, entries } = diffAndTrack(cur.moments, id, patch, "moment", "moment");
          return { moments: list, ...audit(cur, entries) };
        }),
      // `updatedAt` rritet: pa të, "i preferuar" s'arrinte kurrë te serveri dhe webi.
      toggleMomentFavorite: (id: string) => {
        const at = nowIso();
        update((cur) => ({
          moments: cur.moments.map((mo) => (mo.id === id ? { ...mo, favorite: !mo.favorite, updatedAt: at, editCount: mo.editCount + 1 } : mo)),
        }));
      },
      // Smart duplicate: reset to "now", never copy the original date.
      duplicateMoment: (id: string) => update((cur) => ({ moments: withDuplicate(cur.moments, id, { date: nowIso() }) })),
      deleteMoment: (id: string) => update((cur) => ({ moments: withSoftDelete(cur.moments, id) })),
      restoreMoment: (id: string) => update((cur) => ({ moments: withRestore(cur.moments, id) })),
      archiveMoment: (id: string) => update((cur) => ({ moments: withArchive(cur.moments, id) })),
      unarchiveMoment: (id: string) => update((cur) => ({ moments: withUnarchive(cur.moments, id) })),

      // ---- Medical records ----
      addMedicalRecord: (entry: Partial<MedicalRecord> & { type: MedicalRecord["type"]; title: string }) => {
        const at = nowIso();
        const item: MedicalRecord = {
          id: uid(), value: "", doctor: "", at, note: "", attachmentUri: null, pinned: false,
          createdAt: at, updatedAt: at, editCount: 0, deletedAt: null, archivedAt: null,
          ...entry,
        };
        update((cur) => ({ medicalRecords: withAdd(cur.medicalRecords, item) }));
      },
      updateMedicalRecord: (id: string, patch: Partial<MedicalRecord>) =>
        update((cur) => {
          const { list, entries } = diffAndTrack(cur.medicalRecords, id, patch, "medical", "medical record");
          return { medicalRecords: list, ...audit(cur, entries) };
        }),
      // `updatedAt` rritet, që gozhdimi të arrijë edhe te webi.
      togglePinMedicalRecord: (id: string) => {
        const at = nowIso();
        update((cur) => ({
          medicalRecords: cur.medicalRecords.map((m) => (m.id === id ? { ...m, pinned: !m.pinned, updatedAt: at, editCount: m.editCount + 1 } : m)),
        }));
      },
      duplicateMedicalRecord: (id: string) => update((cur) => ({ medicalRecords: withDuplicate(cur.medicalRecords, id, { at: nowIso() }) })),
      deleteMedicalRecord: (id: string) => update((cur) => ({ medicalRecords: withSoftDelete(cur.medicalRecords, id) })),
      restoreMedicalRecord: (id: string) => update((cur) => ({ medicalRecords: withRestore(cur.medicalRecords, id) })),
      archiveMedicalRecord: (id: string) => update((cur) => ({ medicalRecords: withArchive(cur.medicalRecords, id) })),
      unarchiveMedicalRecord: (id: string) => update((cur) => ({ medicalRecords: withUnarchive(cur.medicalRecords, id) })),

      // ---- Emergency contacts ----
      addEmergencyContact: (contact: Omit<EmergencyContact, "id">) => {
        const id = uid();
        update((cur) => ({ emergencyContacts: [...cur.emergencyContacts, { id, ...contact }] }));
      },
      updateEmergencyContact: (id: string, patch: Partial<EmergencyContact>) =>
        update((cur) => ({ emergencyContacts: cur.emergencyContacts.map((c) => (c.id === id ? { ...c, ...patch } : c)) })),
      removeEmergencyContact: (id: string) => update((cur) => ({ emergencyContacts: cur.emergencyContacts.filter((c) => c.id !== id) })),

      // ---- Bulk actions (Timeline multi-select) ----
      bulkDelete: (items: { kind: RecordKind; id: string }[]) => update((cur) => bulkLifecycle(cur, items, (at) => ({ deletedAt: at }))),
      bulkArchive: (items: { kind: RecordKind; id: string }[]) => update((cur) => bulkLifecycle(cur, items, (at) => ({ archivedAt: at }))),
      bulkRestore: (items: { kind: RecordKind; id: string }[]) => update((cur) => bulkLifecycle(cur, items, () => ({ deletedAt: null }))),
    },
  };
}

export function useAppState() {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error("useAppState must be used within an AppStateProvider");
  return ctx;
}