/**
 * Sync-u i shënimeve me disa fëmijë: çdo shënim shkon me fëmijën aktiv, dhe tërhiqen vetëm shënimet e tij.
 * Pa fëmijë (serveri pa migrimin), si më parë.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { exportRecordsSyncState, importRecordsSyncState, syncBabyRecords } from "@/lib/baby/babyRecordsSync";
import { initialBabyState } from "@/lib/state/babyTypes";

jest.mock("@react-native-async-storage/async-storage", () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

type Call = { table: string; ops: [string, unknown[]][] };
const mockCalls: Call[] = [];
const mockUpserts: Record<string, unknown>[][] = [];
jest.mock("@/lib/supabase/client", () => {
  const builder = (call: Call): unknown =>
    new Proxy(
      {},
      {
        get: (_t, prop: string) => {
          if (prop === "then") return (ok: (v: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(ok);
          return (...args: unknown[]) => {
            call.ops.push([prop, args]);
            if (prop === "upsert") mockUpserts.push(args[0] as Record<string, unknown>[]);
            return builder(call);
          };
        },
      }
    );
  return {
    supabase: {
      from: (table: string) => {
        const call: Call = { table, ops: [] };
        mockCalls.push(call);
        return builder(call);
      },
    },
  };
});
jest.mock("@/lib/baby/household", () => ({
  resolveDataOwnerIdStrict: jest.fn(async () => "owner-1"),
  resolveMyRole: jest.fn(async () => "parent"),
}));
jest.mock("@/lib/baby/momentPhotos", () => ({ isLocalFileUri: () => false, signedUrlForMoment: jest.fn(), uploadMomentFile: jest.fn() }));

const feed = { id: "f1", type: "bottle", amountMl: 90, at: "2026-10-17T08:00:00Z", createdAt: "2026-10-17T08:00:00Z",
  updatedAt: "2026-10-17T08:00:00Z", editCount: 0, deletedAt: null, archivedAt: null };
const baby = { ...initialBabyState, feedingLog: [feed] } as never;

const reads = () => mockCalls.filter((c) => c.ops.some(([op]) => op === "select"));
const filters = (c: Call) => c.ops.filter(([op]) => op === "eq").map(([, a]) => a);

beforeEach(async () => {
  mockCalls.length = 0;
  mockUpserts.length = 0;
  await AsyncStorage.clear();
});

describe("sync-u sipas fëmijës aktiv", () => {
  it("dërgon me baby_id të fëmijës aktiv dhe lexon vetëm shënimet e tij", async () => {
    await syncBabyRecords(baby, "child-b");
    expect(mockUpserts.flat().map((r) => r.baby_id)).toEqual(["child-b"]);
    expect(reads().length).toBeGreaterThan(0);
    for (const r of reads()) expect(filters(r)).toContainEqual(["baby_id", "child-b"]);
  });

  it("pa fëmijë (serveri pa migrimin): baby_id bosh dhe pa filtër, si më parë", async () => {
    await syncBabyRecords(baby, null);
    expect(mockUpserts.flat().map((r) => r.baby_id)).toEqual([null]);
    for (const r of reads()) expect(filters(r).some(([k]) => k === "baby_id")).toBe(false);
  });

  it("kujtesa e sync-ut ruhet dhe rikthehet për çdo fëmijë; fëmija i ri nis me tërheqje të plotë", async () => {
    await syncBabyRecords(baby, "child-a");
    const a = await exportRecordsSyncState();
    expect(a.migrated).toBe("true");
    expect(a.lastSync).not.toBeNull();
    await importRecordsSyncState(null);
    expect(await exportRecordsSyncState()).toEqual({ lastSync: null, migrated: "true", cursor: null });
    await importRecordsSyncState(a);
    expect(await exportRecordsSyncState()).toEqual(a);
  });
});
