import { getSyncStatus, registerSyncRequest, resetSyncStatus, retrySync, setSyncPhase } from "@/lib/baby/syncStatus";

afterEach(() => resetSyncStatus());

it("ora e sinkronizimit të fundit mbetet edhe kur sync-u tjetër dështon", () => {
  setSyncPhase("synced");
  const at = getSyncStatus().lastSyncedAt;
  expect(at).not.toBeNull();
  setSyncPhase("error");
  expect(getSyncStatus()).toEqual({ phase: "error", lastSyncedAt: at });
});

it("\"Provo përsëri\" nis sync-un e regjistruar", () => {
  const run = jest.fn();
  registerSyncRequest(run);
  retrySync();
  expect(run).toHaveBeenCalledTimes(1);
});
