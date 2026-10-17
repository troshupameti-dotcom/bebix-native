/**
 * Disa fëmijë (faza 1): cili fëmijë është aktiv në telefon, gabimet e serverit, dhe ruajtja e fëmijëve joaktivë.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ChildError, toChildError, type Child } from "@/lib/children/api";
import { resolveChildren } from "@/lib/children/resolve";
import { __resetChildrenStoreForTests, CHILDREN_KEY, getActiveChildId, getChildrenState, setChildrenState } from "@/lib/children/store";
import { childProfileOf, clearChildSnapshots, loadChildSnapshot, saveChildSnapshot } from "@/lib/children/stash";
import { emptyProfile } from "@/lib/state/types";

jest.mock("@react-native-async-storage/async-storage", () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);
jest.mock("@/lib/supabase/client", () => ({ supabase: {} }));
jest.mock("@/lib/log", () => ({ log: jest.fn() }));
const mockFetch = jest.fn();
const mockSetActive = jest.fn(async (_id: string) => {});
jest.mock("@/lib/children/api", () => {
  const actual = jest.requireActual("@/lib/children/api");
  return { ...actual, fetchMyChildren: () => mockFetch(), setActiveChildRemote: (id: string) => mockSetActive(id) };
});

const kid = (id: string, over: Partial<Child> = {}): Child => ({
  id, ownerId: "o", name: id.toUpperCase(), birthDate: "2025-01-01", dueDate: null, photoPath: null,
  isFree: false, isLocked: false, isActive: false, createdAt: "2026-01-01", ...over,
});

beforeEach(async () => {
  __resetChildrenStoreForTests();
  mockFetch.mockReset();
  mockSetActive.mockClear();
  await AsyncStorage.clear();
});

describe("fëmija aktiv", () => {
  it("hera e parë: telefoni merr fëmijën falas (të dhënat e vjetra lokale janë të tij) dhe e njofton serverin", async () => {
    mockFetch.mockResolvedValue({ children: [kid("b", { isActive: true }), kid("a", { isFree: true })], isPremium: true });
    expect(await resolveChildren()).toEqual({ mode: "ready", activeChildId: "a" });
    expect(getActiveChildId()).toBe("a");
    expect(mockSetActive).toHaveBeenCalledWith("a");
    expect(JSON.parse((await AsyncStorage.getItem(CHILDREN_KEY)) as string).activeChildId).toBe("a");
  });

  it("serveri pa migrimin e fëmijëve: si më parë (legacy), pa e ruajtur", async () => {
    mockFetch.mockRejectedValue(new ChildError("UNAVAILABLE"));
    expect(await resolveChildren()).toEqual({ mode: "legacy" });
    expect(getActiveChildId()).toBeNull();
    expect(await AsyncStorage.getItem(CHILDREN_KEY)).toBeNull();
  });

  it("familja pa asnjë fëmijë ende: legacy (serveri e krijon fëmijën falas me profilin)", async () => {
    mockFetch.mockResolvedValue({ children: [], isPremium: false });
    expect(await resolveChildren()).toEqual({ mode: "legacy" });
  });

  it("pa rrjet: fëmija i ruajtur në telefon", async () => {
    await AsyncStorage.setItem(CHILDREN_KEY, JSON.stringify({ activeChildId: "b", children: [kid("b")], isPremium: true }));
    mockFetch.mockRejectedValue(new ChildError("UNKNOWN", "Network request failed"));
    expect(await resolveChildren()).toEqual({ mode: "ready", activeChildId: "b" });
  });

  it("pa rrjet dhe pa asgjë të ruajtur: gabim (sync-u pret, s'shkruan pa ditur fëmijën)", async () => {
    mockFetch.mockRejectedValue(new ChildError("UNKNOWN", "Network request failed"));
    await expect(resolveChildren()).rejects.toThrow();
  });

  it("Premium skadoi dhe fëmija aktiv u kyç: kërkohet kalimi te fëmija falas", async () => {
    setChildrenState({ mode: "ready", activeChildId: "b", children: [], loadedAt: 0 });
    mockFetch.mockResolvedValue({ children: [kid("a", { isFree: true, isActive: true }), kid("b", { isLocked: true })], isPremium: false });
    expect(await resolveChildren({ force: true })).toEqual({ mode: "ready", activeChildId: "b", switchTo: "a" });
    expect(mockSetActive).not.toHaveBeenCalled();
  });

  it("fëmija s'është më i familjes: ai që thotë serveri", async () => {
    setChildrenState({ mode: "ready", activeChildId: "zhdukur", children: [], loadedAt: 0 });
    mockFetch.mockResolvedValue({ children: [kid("a", { isFree: true }), kid("c", { isActive: true })], isPremium: true });
    expect(await resolveChildren({ force: true })).toEqual({ mode: "ready", activeChildId: "c" });
  });

  it("lista vlen një minutë; `force` e rilexon", async () => {
    mockFetch.mockResolvedValue({ children: [kid("a", { isFree: true, isActive: true })], isPremium: false });
    await resolveChildren({ now: 1_000 });
    await resolveChildren({ now: 30_000 });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    await resolveChildren({ now: 30_000, force: true });
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(getChildrenState().isPremium).toBe(false);
  });
});

describe("gabimet e serverit", () => {
  it("njihen sipas mesazhit; funksioni që mungon = UNAVAILABLE", () => {
    expect(toChildError({ message: "PREMIUM_REQUIRED" }).code).toBe("PREMIUM_REQUIRED");
    expect(toChildError({ message: "FREE_CHANGE_COOLDOWN" }).code).toBe("FREE_CHANGE_COOLDOWN");
    expect(toChildError({ code: "PGRST202", message: "Could not find the function public.my_children" }).code).toBe("UNAVAILABLE");
    expect(toChildError({ message: "boom" }).code).toBe("UNKNOWN");
  });
});

describe("fëmijët joaktivë në telefon", () => {
  it("ruhen dhe rikthehen të plotë, me profilin dhe kujtesën e sync-ut", async () => {
    const profile = childProfileOf({ ...emptyProfile, babyName: "Ana", parentName: "Mami" });
    expect(profile).not.toHaveProperty("parentName");
    await saveChildSnapshot("a", {
      baby: { feedingLog: [{ id: "f1" } as never] },
      profile,
      sync: { lastSync: "2026-10-01", migrated: "true", cursor: "c" },
    });
    const back = await loadChildSnapshot("a");
    expect(back?.baby.feedingLog).toEqual([{ id: "f1" }]);
    expect(back?.profile.babyName).toBe("Ana");
    expect(back?.sync).toEqual({ lastSync: "2026-10-01", migrated: "true", cursor: "c" });
    expect(await loadChildSnapshot("b")).toBeNull();
    await clearChildSnapshots();
    expect(await loadChildSnapshot("a")).toBeNull();
  });
});
