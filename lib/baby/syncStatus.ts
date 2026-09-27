import { useSyncExternalStore } from "react";

/**
 * Gjendja e sinkronizimit të historikut të bebit, që prindi ta shohë nëse
 * shënimi i fundit ka arritur te webi / te partneri.
 *
 * Store i vogël në modul (jo në context): e shkruan useBabyRecordsSync, e
 * lexon kushdo me useSyncStatus, pa ri-renderuar gjithë app-in.
 */
export type SyncPhase = "idle" | "syncing" | "synced" | "error";
export type SyncStatus = { phase: SyncPhase; lastSyncedAt: number | null };

let status: SyncStatus = { phase: "idle", lastSyncedAt: null };
const listeners = new Set<() => void>();
let requestSync: () => void = () => {};

export function setSyncPhase(phase: SyncPhase) {
  status = { phase, lastSyncedAt: phase === "synced" ? Date.now() : status.lastSyncedAt };
  listeners.forEach((l) => l());
}

/** useBabyRecordsSync e regjistron, që "Provo përsëri" ta nisë menjëherë. */
export function registerSyncRequest(fn: () => void) {
  requestSync = fn;
}

export function retrySync() {
  requestSync();
}

/** Për testet dhe për daljen nga llogaria. */
export function resetSyncStatus() {
  status = { phase: "idle", lastSyncedAt: null };
  requestSync = () => {};
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getSyncStatus(): SyncStatus {
  return status;
}

export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(subscribe, getSyncStatus, getSyncStatus);
}
