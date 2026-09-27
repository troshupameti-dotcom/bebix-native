import { mergeRecordsPatch } from "@/lib/baby/babyRecordsSync";
import type { BabyModuleState } from "@/lib/state/babyTypes";

// jest i ngre këto mbi import-et; moduli testohet pa rrjet dhe pa AsyncStorage të vërtetë.
jest.mock("@react-native-async-storage/async-storage", () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);
jest.mock("@/lib/supabase/client", () => ({ supabase: {} }));
jest.mock("@/lib/baby/household", () => ({ resolveDataOwnerId: jest.fn() }));
jest.mock("@/lib/baby/momentPhotos", () => ({
  isLocalFileUri: () => false,
  signedUrlForMoment: jest.fn(),
  uploadMomentFile: jest.fn(),
}));

const rec = (id: string, updatedAt: string, extra: Record<string, unknown> = {}) => ({
  id,
  createdAt: updatedAt,
  updatedAt,
  editCount: 0,
  deletedAt: null,
  archivedAt: null,
  ...extra,
});
const state = (s: Record<string, unknown>) => s as unknown as BabyModuleState;
const patch = (p: Record<string, unknown>) => p as unknown as Partial<BabyModuleState>;
const ids = (list: unknown) => (list as { id: string }[]).map((x) => x.id).sort();

describe("mergeRecordsPatch", () => {
  const current = state({
    feedingLog: [rec("B", "2026-09-26T10:05:00Z"), rec("A", "2026-09-26T09:00:00Z")],
    moments: [rec("M", "2026-09-26T08:00:00Z", { storagePath: null })],
  });

  it("shënimi i shtuar gjatë sync-ut nuk humbet, dhe ai nga webi shtohet", () => {
    const out = mergeRecordsPatch(current, patch({ feedingLog: [rec("A", "2026-09-26T09:00:00Z"), rec("R", "2026-09-26T10:01:00Z")] }));
    expect(ids(out.feedingLog)).toEqual(["A", "B", "R"]);
  });

  it("fshirja më e re nga webi fiton", () => {
    const out = mergeRecordsPatch(
      current,
      patch({ feedingLog: [rec("A", "2026-09-26T11:00:00Z", { deletedAt: "2026-09-26T11:00:00Z" })] })
    );
    expect((out.feedingLog as { id: string; deletedAt: string | null }[]).find((x) => x.id === "A")?.deletedAt).toBe(
      "2026-09-26T11:00:00Z"
    );
  });

  it("ndryshimi lokal më i ri nuk mbishkruhet nga një version më i vjetër", () => {
    const out = mergeRecordsPatch(
      state({ feedingLog: [rec("A", "2026-09-26T12:00:00Z", { amountMl: 150 })] }),
      patch({ feedingLog: [rec("A", "2026-09-26T11:00:00Z", { amountMl: 90 })] })
    );
    expect((out.feedingLog as { amountMl: number }[])[0].amountMl).toBe(150);
  });

  it("storagePath i momentit të sapongarkuar ruhet", () => {
    const out = mergeRecordsPatch(current, patch({ moments: [rec("M", "2026-09-26T08:00:00Z", { storagePath: "u/moments/M.jpg" })] }));
    expect((out.moments as { storagePath: string }[])[0].storagePath).toBe("u/moments/M.jpg");
  });

  it("fushat që s'janë lista regjistrimesh kalojnë siç janë", () => {
    expect(mergeRecordsPatch(current, patch({ growthActiveKeys: ["weight"] })).growthActiveKeys).toEqual(["weight"]);
  });
});
