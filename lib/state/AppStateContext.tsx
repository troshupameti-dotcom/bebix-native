import { createContext, useContext, useEffect, useReducer, ReactNode } from "react";
import { useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  AppState,
  initialAppState,
  BabyProfile,
  FavoriteItem,
  MemoryPhoto,
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
  NotificationPrefs,
} from "./types";

const STORAGE_KEY = "bebix_app_state_v3";
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const nowIso = () => new Date().toISOString();

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
function withSoftDelete<T extends Identifiable & Lifecycle>(list: T[], id: string): T[] {
  return list.map((item) => (item.id === id ? { ...item, deletedAt: nowIso() } : item));
}
function withRestore<T extends Identifiable & Lifecycle>(list: T[], id: string): T[] {
  return list.map((item) => (item.id === id ? { ...item, deletedAt: null } : item));
}
function withArchive<T extends Identifiable & Lifecycle>(list: T[], id: string): T[] {
  return list.map((item) => (item.id === id ? { ...item, archivedAt: nowIso() } : item));
}
function withUnarchive<T extends Identifiable & Lifecycle>(list: T[], id: string): T[] {
  return list.map((item) => (item.id === id ? { ...item, archivedAt: null } : item));
}
/** Records visible in normal lists: not deleted, not archived. */
export function active<T extends Lifecycle>(list: T[]): T[] {
  return list.filter((item) => !item.deletedAt && !item.archivedAt);
}
/** Records visible in "Archived Records". */
export function archived<T extends Lifecycle>(list: T[]): T[] {
  return list.filter((item) => !item.deletedAt && !!item.archivedAt);
}

/** Toggle an id in/out of a string[] — shared by like/save/join/follow. */
function toggleId(list: string[], id: string): string[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

type Action =
  | { type: "SET_DARK_MODE"; value: boolean }
  | { type: "UPDATE_PROFILE"; value: Partial<BabyProfile> }
  | { type: "TOGGLE_FAVORITE"; item: FavoriteItem }
  | { type: "ADD_MEMORY"; memory: MemoryPhoto }
  | { type: "REMOVE_MEMORY"; id: string }
  | { type: "BUMP_CART"; delta: number }
  | { type: "SET_BABY"; value: Partial<BabyModuleState> }
  | { type: "TOGGLE_LIKE_POST"; id: string }
  | { type: "TOGGLE_SAVE_POST"; id: string }
  | { type: "TOGGLE_JOIN_GROUP"; id: string }
  | { type: "TOGGLE_FOLLOW_EXPERT"; id: string }
  | { type: "SET_NOTIFICATION_PREF"; key: keyof NotificationPrefs; value: boolean }
  | { type: "HYDRATE"; state: AppState };

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "SET_DARK_MODE":
      return { ...state, darkMode: action.value };
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
    case "SET_BABY":
      return { ...state, baby: { ...state.baby, ...action.value } };
    case "TOGGLE_LIKE_POST":
      return { ...state, community: { ...state.community, likedPostIds: toggleId(state.community.likedPostIds, action.id) } };
    case "TOGGLE_SAVE_POST":
      return { ...state, community: { ...state.community, savedPostIds: toggleId(state.community.savedPostIds, action.id) } };
    case "TOGGLE_JOIN_GROUP":
      return { ...state, community: { ...state.community, joinedGroupIds: toggleId(state.community.joinedGroupIds, action.id) } };
    case "TOGGLE_FOLLOW_EXPERT":
      return { ...state, community: { ...state.community, followedExpertIds: toggleId(state.community.followedExpertIds, action.id) } };
    case "SET_NOTIFICATION_PREF":
      return { ...state, notificationPrefs: { ...state.notificationPrefs, [action.key]: action.value } };
    case "HYDRATE":
      // Merr shtetin e ruajtur, por siguron që fusha të reja (si `community`
      // ose `notificationPrefs`) ekzistojnë edhe nëse instalimi i vjetër i
      // ruajtur s'i ka ende (p.sh. app i instaluar përpara këtij update-i).
      return {
        ...initialAppState,
        ...action.state,
        community: { ...initialAppState.community, ...(action.state as AppState).community },
        notificationPrefs: { ...initialAppState.notificationPrefs, ...(action.state as AppState).notificationPrefs },
      };
    default:
      return state;
  }
}

const AppStateContext = createContext<ReturnType<typeof buildValue> | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialAppState);
  const systemScheme = useColorScheme();

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (raw) {
        try {
          dispatch({ type: "HYDRATE", state: JSON.parse(raw) });
          return;
        } catch {
          // Corrupt/old shape — fall through to system-theme default.
        }
      }
      if (systemScheme === "dark") dispatch({ type: "SET_DARK_MODE", value: true });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const value = buildValue(state, dispatch);
  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

function buildValue(state: AppState, dispatch: React.Dispatch<Action>) {
  const setBaby = (value: Partial<BabyModuleState>) => dispatch({ type: "SET_BABY", value });
  const b = state.baby;

  function pushAudit(entries: AuditEntry[]) {
    if (entries.length) setBaby({ auditLog: [...b.auditLog, ...entries] });
  }
  function logSimple(kind: RecordKind, recordId: string, recordLabel: string, field: string, oldValue: string, newValue: string) {
    if (oldValue === newValue) return;
    pushAudit([{ id: uid(), recordKind: kind, recordId, recordLabel, field, fieldLabel: field, oldValue: oldValue || "–", newValue: newValue || "–", at: nowIso() }]);
  }

  return {
    state,
    setDarkMode: (value: boolean) => dispatch({ type: "SET_DARK_MODE", value }),
    updateProfile: (value: Partial<BabyProfile>) => dispatch({ type: "UPDATE_PROFILE", value }),
    toggleFavorite: (item: FavoriteItem) => dispatch({ type: "TOGGLE_FAVORITE", item }),
    isFavorite: (id: string) => state.favorites.some((f) => f.id === id),
    addMemory: (memory: MemoryPhoto) => dispatch({ type: "ADD_MEMORY", memory }),
    removeMemory: (id: string) => dispatch({ type: "REMOVE_MEMORY", id }),
    bumpCart: (delta = 1) => dispatch({ type: "BUMP_CART", delta }),
    resetBabyData: () => {
      dispatch({ type: "UPDATE_PROFILE", value: initialAppState.profile });
      dispatch({ type: "SET_BABY", value: initialAppState.baby });
    },

    // ---- Community (local-only: likes/saves/joins/follows) ----
    toggleLikePost: (id: string) => dispatch({ type: "TOGGLE_LIKE_POST", id }),
    isPostLiked: (id: string) => state.community.likedPostIds.includes(id),
    toggleSavePost: (id: string) => dispatch({ type: "TOGGLE_SAVE_POST", id }),
    isPostSaved: (id: string) => state.community.savedPostIds.includes(id),
    toggleJoinGroup: (id: string) => dispatch({ type: "TOGGLE_JOIN_GROUP", id }),
    isGroupJoined: (id: string) => state.community.joinedGroupIds.includes(id),
    toggleFollowExpert: (id: string) => dispatch({ type: "TOGGLE_FOLLOW_EXPERT", id }),
    isExpertFollowed: (id: string) => state.community.followedExpertIds.includes(id),

    // ---- Notification preferences ----
    setNotificationPref: (key: keyof NotificationPrefs, value: boolean) =>
      dispatch({ type: "SET_NOTIFICATION_PREF", key, value }),

    baby: {
      // ---- Growth stat cards (profile summary) — this is the "Weight
      // changed: 8.4kg -> 8.7kg" example from the spec. ----
      addGrowthStat: (key: string) => {
        const preset = growthCatalog.find((g) => g.key === key);
        if (!preset || b.growthActiveKeys.includes(key)) return;
        setBaby({ growthStats: [...b.growthStats, preset], growthActiveKeys: [...b.growthActiveKeys, key] });
      },
      addCustomGrowthStat: (label: string, value: string) => {
        const key = `custom:${uid()}`;
        const stat: GrowthStat = { key, label, value, isCustom: true };
        setBaby({ growthStats: [...b.growthStats, stat], growthActiveKeys: [...b.growthActiveKeys, key] });
      },
      removeGrowthStat: (key: string) => {
        setBaby({
          growthStats: b.growthStats.filter((g) => g.key !== key),
          growthActiveKeys: b.growthActiveKeys.filter((k) => k !== key),
        });
      },
      updateGrowthStat: (key: string, patch: Partial<Pick<GrowthStat, "value" | "label">>) => {
        const stat = b.growthStats.find((g) => g.key === key);
        if (stat && patch.value !== undefined) logSimple("growthHistory", key, stat.label ?? stat.labelKey ?? key, "value", stat.value, patch.value);
        setBaby({ growthStats: b.growthStats.map((g) => (g.key === key ? { ...g, ...patch } : g)) });
      },
      availableGrowthPresets: () => growthCatalog.filter((g) => !b.growthActiveKeys.includes(g.key)),

      // ---- Growth history (measurements over time) ----
      addGrowthHistoryEntry: (entry: Partial<GrowthHistoryEntry>) => {
        const at = nowIso();
        const item: GrowthHistoryEntry = {
          id: uid(), date: at, weightKg: null, heightCm: null, headCm: null, note: "",
          createdAt: at, updatedAt: at, editCount: 0, deletedAt: null, archivedAt: null,
          ...entry,
        };
        setBaby({ growthHistory: withAdd(b.growthHistory, item) });
      },
      updateGrowthHistoryEntry: (id: string, patch: Partial<GrowthHistoryEntry>) => {
        const { list, entries } = diffAndTrack(b.growthHistory, id, patch, "growthHistory", "growth measurement");
        setBaby({ growthHistory: list });
        pushAudit(entries);
      },
      duplicateGrowthHistoryEntry: (id: string) => setBaby({ growthHistory: withDuplicate(b.growthHistory, id, { date: nowIso() }) }),
      deleteGrowthHistoryEntry: (id: string) => setBaby({ growthHistory: withSoftDelete(b.growthHistory, id) }),
      restoreGrowthHistoryEntry: (id: string) => setBaby({ growthHistory: withRestore(b.growthHistory, id) }),
      archiveGrowthHistoryEntry: (id: string) => setBaby({ growthHistory: withArchive(b.growthHistory, id) }),
      unarchiveGrowthHistoryEntry: (id: string) => setBaby({ growthHistory: withUnarchive(b.growthHistory, id) }),

      // ---- Quick actions ----
      addQuickAction: (key: QuickActionKey) => {
        if (b.quickActionKeys.includes(key)) return;
        setBaby({ quickActionKeys: [...b.quickActionKeys, key] });
      },
      removeQuickAction: (key: QuickActionKey) => setBaby({ quickActionKeys: b.quickActionKeys.filter((k) => k !== key) }),

      // ---- Medical info (profile summary rows) ----
      addMedicalRow: (key: string) => {
        const preset = medicalCatalog.find((m) => m.key === key);
        if (!preset || b.medicalActiveKeys.includes(key)) return;
        setBaby({
          medicalInfo: [...b.medicalInfo.filter((m) => m.key !== key), preset],
          medicalActiveKeys: [...b.medicalActiveKeys, key],
        });
      },
      addCustomMedicalRow: (label: string, value: string) => {
        const key = `custom:${uid()}`;
        const row: MedicalInfoRow = { key, label, value, isCustom: true };
        setBaby({ medicalInfo: [...b.medicalInfo, row], medicalActiveKeys: [...b.medicalActiveKeys, key] });
      },
      removeMedicalRow: (key: string) => setBaby({ medicalActiveKeys: b.medicalActiveKeys.filter((k) => k !== key) }),
      updateMedicalRow: (key: string, patch: Partial<Pick<MedicalInfoRow, "value" | "label">>) => {
        const row = b.medicalInfo.find((m) => m.key === key);
        if (row && patch.value !== undefined) logSimple("medical", key, row.label ?? row.labelKey ?? key, "value", row.value, patch.value);
        setBaby({ medicalInfo: b.medicalInfo.map((m) => (m.key === key ? { ...m, ...patch } : m)) });
      },
      availableMedicalPresets: () => medicalCatalog.filter((m) => !b.medicalActiveKeys.includes(m.key)),

      // ---- Milestones ----
      addMilestone: (key: string) => {
        const preset = milestoneCatalog.find((m) => m.key === key);
        if (!preset || b.milestoneActiveKeys.includes(key)) return;
        setBaby({
          milestones: [...b.milestones.filter((m) => m.key !== key), preset],
          milestoneActiveKeys: [...b.milestoneActiveKeys, key],
        });
      },
      addCustomMilestone: (label: string) => {
        const key = `custom:${uid()}`;
        const item: MilestoneItem = { key, label, done: false, isCustom: true };
        setBaby({ milestones: [...b.milestones, item], milestoneActiveKeys: [...b.milestoneActiveKeys, key] });
      },
      removeMilestone: (key: string) => setBaby({ milestoneActiveKeys: b.milestoneActiveKeys.filter((k) => k !== key) }),
      toggleMilestone: (key: string) => {
        const m = b.milestones.find((mm) => mm.key === key);
        if (m) logSimple("timeline", key, m.label ?? m.labelKey ?? key, "done", String(m.done), String(!m.done));
        setBaby({ milestones: b.milestones.map((mm) => (mm.key === key ? { ...mm, done: !mm.done } : mm)) });
      },
      updateMilestoneLabel: (key: string, label: string) =>
        setBaby({ milestones: b.milestones.map((m) => (m.key === key ? { ...m, label } : m)) }),
      availableMilestonePresets: () => milestoneCatalog.filter((m) => !b.milestoneActiveKeys.includes(m.key)),

      // ---- Timeline (unified, also manually-added custom events) ----
      addTimelineEvent: (title: string, date: string) => {
        const at = nowIso();
        const event: TimelineEvent = { id: uid(), title, date, color: "olive", note: "", createdAt: at, updatedAt: at, editCount: 0, deletedAt: null, archivedAt: null };
        setBaby({ timeline: withAdd(b.timeline, event) });
      },
      updateTimelineEvent: (id: string, patch: Partial<TimelineEvent>) => {
        const { list, entries } = diffAndTrack(b.timeline, id, patch, "timeline", "event");
        setBaby({ timeline: list });
        pushAudit(entries);
      },
      duplicateTimelineEvent: (id: string) => setBaby({ timeline: withDuplicate(b.timeline, id) }),
      deleteTimelineEvent: (id: string) => setBaby({ timeline: withSoftDelete(b.timeline, id) }),
      restoreTimelineEvent: (id: string) => setBaby({ timeline: withRestore(b.timeline, id) }),
      archiveTimelineEvent: (id: string) => setBaby({ timeline: withArchive(b.timeline, id) }),
      unarchiveTimelineEvent: (id: string) => setBaby({ timeline: withUnarchive(b.timeline, id) }),

      // ---- Feeding ----
      addFeedingEntry: (entry: Partial<FeedingEntry>) => {
        const at = nowIso();
        const item: FeedingEntry = {
          id: uid(), type: "bottle", amountMl: null, durationMin: null, side: null, foodCategory: null,
          at, note: "", createdAt: at, updatedAt: at, editCount: 0, deletedAt: null, archivedAt: null,
          ...entry,
        };
        setBaby({ feedingLog: withAdd(b.feedingLog, item) });
      },
      updateFeedingEntry: (id: string, patch: Partial<FeedingEntry>) => {
        const { list, entries } = diffAndTrack(b.feedingLog, id, patch, "feeding", "feeding");
        setBaby({ feedingLog: list });
        pushAudit(entries);
      },
      // Smart duplicate: never copy the original timestamp — a duplicated
      // feeding is logged as happening now, not back-dated to the original.
      duplicateFeedingEntry: (id: string) => setBaby({ feedingLog: withDuplicate(b.feedingLog, id, { at: nowIso() }) }),
      deleteFeedingEntry: (id: string) => setBaby({ feedingLog: withSoftDelete(b.feedingLog, id) }),
      restoreFeedingEntry: (id: string) => setBaby({ feedingLog: withRestore(b.feedingLog, id) }),
      archiveFeedingEntry: (id: string) => setBaby({ feedingLog: withArchive(b.feedingLog, id) }),
      unarchiveFeedingEntry: (id: string) => setBaby({ feedingLog: withUnarchive(b.feedingLog, id) }),

      // ---- Sleep ----
      startSleep: (isNap: boolean) => {
        const at = nowIso();
        const item: SleepEntry = {
          id: uid(), startAt: at, endAt: null, pausedIntervalsMin: 0, pausedAt: null, isNap, quality: null,
          note: "", createdAt: at, updatedAt: at, editCount: 0, deletedAt: null, archivedAt: null,
        };
        setBaby({ sleepLog: withAdd(b.sleepLog, item) });
      },
      pauseSleep: (id: string) => setBaby({ sleepLog: b.sleepLog.map((s) => (s.id === id ? { ...s, pausedAt: nowIso() } : s)) }),
      resumeSleep: (id: string) => {
        const entry = b.sleepLog.find((s) => s.id === id);
        if (!entry?.pausedAt) return;
        const pausedMin = Math.round((Date.now() - new Date(entry.pausedAt).getTime()) / 60000);
        setBaby({
          sleepLog: b.sleepLog.map((s) =>
            s.id === id ? { ...s, pausedAt: null, pausedIntervalsMin: s.pausedIntervalsMin + pausedMin } : s
          ),
        });
      },
      endSleep: (id: string) => setBaby({ sleepLog: b.sleepLog.map((s) => (s.id === id ? { ...s, endAt: nowIso() } : s)) }),
      updateSleepEntry: (id: string, patch: Partial<SleepEntry>) => {
        const { list, entries } = diffAndTrack(b.sleepLog, id, patch, "sleep", "sleep");
        setBaby({ sleepLog: list });
        pushAudit(entries);
      },
      duplicateSleepEntry: (id: string) => setBaby({ sleepLog: withDuplicate(b.sleepLog, id, { startAt: nowIso(), endAt: null, pausedAt: null }) }),
      deleteSleepEntry: (id: string) => setBaby({ sleepLog: withSoftDelete(b.sleepLog, id) }),
      restoreSleepEntry: (id: string) => setBaby({ sleepLog: withRestore(b.sleepLog, id) }),
      archiveSleepEntry: (id: string) => setBaby({ sleepLog: withArchive(b.sleepLog, id) }),
      unarchiveSleepEntry: (id: string) => setBaby({ sleepLog: withUnarchive(b.sleepLog, id) }),

      // ---- Diaper ----
      addDiaperEntry: (entry: Partial<DiaperEntry>) => {
        const at = nowIso();
        const item: DiaperEntry = {
          id: uid(), type: "wet", color: null, consistency: null, at, note: "",
          createdAt: at, updatedAt: at, editCount: 0, deletedAt: null, archivedAt: null,
          ...entry,
        };
        setBaby({ diaperLog: withAdd(b.diaperLog, item) });
      },
      updateDiaperEntry: (id: string, patch: Partial<DiaperEntry>) => {
        const { list, entries } = diffAndTrack(b.diaperLog, id, patch, "diaper", "diaper");
        setBaby({ diaperLog: list });
        pushAudit(entries);
      },
      duplicateDiaperEntry: (id: string) => setBaby({ diaperLog: withDuplicate(b.diaperLog, id, { at: nowIso() }) }),
      deleteDiaperEntry: (id: string) => setBaby({ diaperLog: withSoftDelete(b.diaperLog, id) }),
      restoreDiaperEntry: (id: string) => setBaby({ diaperLog: withRestore(b.diaperLog, id) }),
      archiveDiaperEntry: (id: string) => setBaby({ diaperLog: withArchive(b.diaperLog, id) }),
      unarchiveDiaperEntry: (id: string) => setBaby({ diaperLog: withUnarchive(b.diaperLog, id) }),

      // ---- Vaccinations ----
      addVaccine: (entry: Partial<VaccineEntry> & { name: string; dueDate: string }) => {
        const at = nowIso();
        const item: VaccineEntry = {
          id: uid(), description: "", givenDate: null, doctor: "", clinic: "", batchNumber: "", note: "",
          reminderEnabled: true, createdAt: at, updatedAt: at, editCount: 0, deletedAt: null, archivedAt: null,
          ...entry,
        };
        setBaby({ vaccines: withAdd(b.vaccines, item) });
      },
      updateVaccine: (id: string, patch: Partial<VaccineEntry>) => {
        const { list, entries } = diffAndTrack(b.vaccines, id, patch, "vaccine", "vaccine");
        setBaby({ vaccines: list });
        pushAudit(entries);
      },
      markVaccineDone: (id: string) => {
        const { list, entries } = diffAndTrack(b.vaccines, id, { givenDate: nowIso() } as Partial<VaccineEntry>, "vaccine", "vaccine");
        setBaby({ vaccines: list });
        pushAudit(entries);
      },
      duplicateVaccine: (id: string) => setBaby({ vaccines: withDuplicate(b.vaccines, id, { givenDate: null }) }),
      deleteVaccine: (id: string) => setBaby({ vaccines: withSoftDelete(b.vaccines, id) }),
      restoreVaccine: (id: string) => setBaby({ vaccines: withRestore(b.vaccines, id) }),
      archiveVaccine: (id: string) => setBaby({ vaccines: withArchive(b.vaccines, id) }),
      unarchiveVaccine: (id: string) => setBaby({ vaccines: withUnarchive(b.vaccines, id) }),

      // ---- Moments ----
      addMoment: (entry: Partial<Moment> & { type: Moment["type"] }) => {
        const at = nowIso();
        const item: Moment = {
          id: uid(), uri: null, title: "", description: "", date: at, tags: [], favorite: false,
          createdAt: at, updatedAt: at, editCount: 0, deletedAt: null, archivedAt: null,
          ...entry,
        };
        setBaby({ moments: withAdd(b.moments, item) });
      },
      updateMoment: (id: string, patch: Partial<Moment>) => {
        const { list, entries } = diffAndTrack(b.moments, id, patch, "moment", "moment");
        setBaby({ moments: list });
        pushAudit(entries);
      },
      toggleMomentFavorite: (id: string) => {
        const m = b.moments.find((mo) => mo.id === id);
        if (m) setBaby({ moments: b.moments.map((mo) => (mo.id === id ? { ...mo, favorite: !mo.favorite } : mo)) });
      },
      // Smart duplicate: reset to "now", never copy the original date.
      duplicateMoment: (id: string) => setBaby({ moments: withDuplicate(b.moments, id, { date: nowIso() }) }),
      deleteMoment: (id: string) => setBaby({ moments: withSoftDelete(b.moments, id) }),
      restoreMoment: (id: string) => setBaby({ moments: withRestore(b.moments, id) }),
      archiveMoment: (id: string) => setBaby({ moments: withArchive(b.moments, id) }),
      unarchiveMoment: (id: string) => setBaby({ moments: withUnarchive(b.moments, id) }),

      // ---- Medical records ----
      addMedicalRecord: (entry: Partial<MedicalRecord> & { type: MedicalRecord["type"]; title: string }) => {
        const at = nowIso();
        const item: MedicalRecord = {
          id: uid(), value: "", doctor: "", at, note: "", attachmentUri: null, pinned: false,
          createdAt: at, updatedAt: at, editCount: 0, deletedAt: null, archivedAt: null,
          ...entry,
        };
        setBaby({ medicalRecords: withAdd(b.medicalRecords, item) });
      },
      updateMedicalRecord: (id: string, patch: Partial<MedicalRecord>) => {
        const { list, entries } = diffAndTrack(b.medicalRecords, id, patch, "medical", "medical record");
        setBaby({ medicalRecords: list });
        pushAudit(entries);
      },
      togglePinMedicalRecord: (id: string) =>
        setBaby({ medicalRecords: b.medicalRecords.map((m) => (m.id === id ? { ...m, pinned: !m.pinned } : m)) }),
      duplicateMedicalRecord: (id: string) => setBaby({ medicalRecords: withDuplicate(b.medicalRecords, id, { at: nowIso() }) }),
      deleteMedicalRecord: (id: string) => setBaby({ medicalRecords: withSoftDelete(b.medicalRecords, id) }),
      restoreMedicalRecord: (id: string) => setBaby({ medicalRecords: withRestore(b.medicalRecords, id) }),
      archiveMedicalRecord: (id: string) => setBaby({ medicalRecords: withArchive(b.medicalRecords, id) }),
      unarchiveMedicalRecord: (id: string) => setBaby({ medicalRecords: withUnarchive(b.medicalRecords, id) }),

      // ---- Emergency contacts ----
      addEmergencyContact: (contact: Omit<EmergencyContact, "id">) =>
        setBaby({ emergencyContacts: [...b.emergencyContacts, { id: uid(), ...contact }] }),
      updateEmergencyContact: (id: string, patch: Partial<EmergencyContact>) =>
        setBaby({ emergencyContacts: b.emergencyContacts.map((c) => (c.id === id ? { ...c, ...patch } : c)) }),
      removeEmergencyContact: (id: string) => setBaby({ emergencyContacts: b.emergencyContacts.filter((c) => c.id !== id) }),

      // ---- Bulk actions (Timeline multi-select) ----
      bulkDelete: (items: { kind: RecordKind; id: string }[]) => {
        const ids = (k: RecordKind) => items.filter((i) => i.kind === k).map((i) => i.id);
        setBaby({
          feedingLog: b.feedingLog.map((e) => (ids("feeding").includes(e.id) ? { ...e, deletedAt: nowIso() } : e)),
          sleepLog: b.sleepLog.map((e) => (ids("sleep").includes(e.id) ? { ...e, deletedAt: nowIso() } : e)),
          diaperLog: b.diaperLog.map((e) => (ids("diaper").includes(e.id) ? { ...e, deletedAt: nowIso() } : e)),
          growthHistory: b.growthHistory.map((e) => (ids("growthHistory").includes(e.id) ? { ...e, deletedAt: nowIso() } : e)),
          vaccines: b.vaccines.map((e) => (ids("vaccine").includes(e.id) ? { ...e, deletedAt: nowIso() } : e)),
          medicalRecords: b.medicalRecords.map((e) => (ids("medical").includes(e.id) ? { ...e, deletedAt: nowIso() } : e)),
          timeline: b.timeline.map((e) => (ids("timeline").includes(e.id) ? { ...e, deletedAt: nowIso() } : e)),
        });
      },
      bulkArchive: (items: { kind: RecordKind; id: string }[]) => {
        const ids = (k: RecordKind) => items.filter((i) => i.kind === k).map((i) => i.id);
        setBaby({
          feedingLog: b.feedingLog.map((e) => (ids("feeding").includes(e.id) ? { ...e, archivedAt: nowIso() } : e)),
          sleepLog: b.sleepLog.map((e) => (ids("sleep").includes(e.id) ? { ...e, archivedAt: nowIso() } : e)),
          diaperLog: b.diaperLog.map((e) => (ids("diaper").includes(e.id) ? { ...e, archivedAt: nowIso() } : e)),
          growthHistory: b.growthHistory.map((e) => (ids("growthHistory").includes(e.id) ? { ...e, archivedAt: nowIso() } : e)),
          vaccines: b.vaccines.map((e) => (ids("vaccine").includes(e.id) ? { ...e, archivedAt: nowIso() } : e)),
          medicalRecords: b.medicalRecords.map((e) => (ids("medical").includes(e.id) ? { ...e, archivedAt: nowIso() } : e)),
          timeline: b.timeline.map((e) => (ids("timeline").includes(e.id) ? { ...e, archivedAt: nowIso() } : e)),
        });
      },
      bulkRestore: (items: { kind: RecordKind; id: string }[]) => {
        const ids = (k: RecordKind) => items.filter((i) => i.kind === k).map((i) => i.id);
        setBaby({
          feedingLog: b.feedingLog.map((e) => (ids("feeding").includes(e.id) ? { ...e, deletedAt: null } : e)),
          sleepLog: b.sleepLog.map((e) => (ids("sleep").includes(e.id) ? { ...e, deletedAt: null } : e)),
          diaperLog: b.diaperLog.map((e) => (ids("diaper").includes(e.id) ? { ...e, deletedAt: null } : e)),
          growthHistory: b.growthHistory.map((e) => (ids("growthHistory").includes(e.id) ? { ...e, deletedAt: null } : e)),
          vaccines: b.vaccines.map((e) => (ids("vaccine").includes(e.id) ? { ...e, deletedAt: null } : e)),
          medicalRecords: b.medicalRecords.map((e) => (ids("medical").includes(e.id) ? { ...e, deletedAt: null } : e)),
          timeline: b.timeline.map((e) => (ids("timeline").includes(e.id) ? { ...e, deletedAt: null } : e)),
        });
      },
    },
  };
}

export function useAppState() {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error("useAppState must be used within an AppStateProvider");
  return ctx;
}