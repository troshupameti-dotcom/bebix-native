/**
 * Ndërrimi i fëmijës aktiv nga kreu (faza 1): të dhënat e secilit fëmijë mbeten veç, i kyçuri hap Premium-in,
 * dhe një refuzim nga serveri s'e prish asgjë.
 */
import { fakeSupabase, renderScreen, visibleText } from "./helpers/screen";
import { Text, TextInput } from "react-native";
import { act, type ReactTestInstance } from "react-test-renderer";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ChildSwitcher } from "@/components/children/ChildSwitcher";
import ChildrenScreen from "@/app/(main)/more/children";
import { useBabyRecordsSync } from "@/lib/hooks/useBabyRecordsSync";
import { useAppState } from "@/lib/state/AppStateContext";
import { ChildError, type Child } from "@/lib/children/api";
import { __resetChildrenStoreForTests } from "@/lib/children/store";

const mockFetch = jest.fn();
const mockSetActive = jest.fn();
const mockAdd = jest.fn();
jest.mock("@/lib/children/api", () => {
  const actual = jest.requireActual("@/lib/children/api");
  return {
    ...actual,
    fetchMyChildren: () => mockFetch(),
    setActiveChildRemote: (id: string) => mockSetActive(id),
    addChildRemote: (input: unknown) => mockAdd(input),
  };
});
const mockSync = jest.fn(async (..._args: unknown[]) => null);
jest.mock("@/lib/baby/babyRecordsSync", () => {
  const actual = jest.requireActual("@/lib/baby/babyRecordsSync");
  return { ...actual, syncBabyRecords: (...args: unknown[]) => mockSync(...args) };
});
jest.mock("@/lib/auth/localDataOwner", () => ({ claimLocalData: async () => "same", claimDataOwner: async () => "same" }));
jest.mock("@/lib/baby/household", () => {
  const actual = jest.requireActual("@/lib/baby/household");
  return { ...actual, resolveDataOwnerIdStrict: async () => "owner", resolveDataOwnerId: async () => "owner", resolveMyRole: async () => "parent" };
});

const kid = (id: string, name: string, over: Partial<Child> = {}): Child => ({
  id, ownerId: "owner", name, birthDate: "2025-01-01", dueDate: null, photoPath: null,
  isFree: false, isLocked: false, isActive: false, createdAt: "2026-01-01", ...over,
});
const KIDS = [kid("a", "Ana", { isFree: true, isActive: true }), kid("b", "Ben"), kid("c", "Cen", { isLocked: true })];

function Harness() {
  useBabyRecordsSync(true);
  const { state } = useAppState();
  return (
    <>
      <ChildSwitcher />
      <Text>{`probe:${state.profile.babyName}|${state.baby.feedingLog.length}|${state.profile.parentName}`}</Text>
    </>
  );
}

const probe = (root: ReactTestInstance) => visibleText(root).find((x) => x.startsWith("probe:"));
const chip = (root: ReactTestInstance, label: string) =>
  root.findAll((n) => typeof n.props.onPress === "function" && n.props.accessibilityRole === "button" && visibleText(n).includes(label))[0];
const settle = async () => {
  for (let i = 0; i < 6; i++) await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
};

beforeEach(async () => {
  __resetChildrenStoreForTests();
  mockFetch.mockReset().mockResolvedValue({ children: KIDS, isPremium: true });
  mockSetActive.mockReset().mockResolvedValue(undefined);
  mockAdd.mockReset();
  mockSync.mockClear();
  fakeSupabase().session = { user: { id: "owner" } };
  // Serveri përgjigjet për profilin e fëmijës (ruajtja e detajeve s'mbetet "në pritje").
  fakeSupabase().tables.children = [];
  // Telefoni ka bebin e vjetër (një shënim) dhe emrin e prindit.
  await AsyncStorage.setItem("bebix_app_state_v3", JSON.stringify({ profile: { babyName: "Ana", parentName: "Mami" } }));
  await AsyncStorage.setItem("bebix_baby_v1:feedingLog", JSON.stringify([{ id: "f1", type: "bottle", at: "2026-10-17T08:00:00Z",
    createdAt: "2026-10-17T08:00:00Z", updatedAt: "2026-10-17T08:00:00Z", editCount: 0, deletedAt: null, archivedAt: null }]));
});

describe("ndërrimi i fëmijës", () => {
  it("të dhënat e vjetra i mbeten fëmijës falas; kalimi te Beni e lë Anën të ruajtur dhe kthimi e rikthen", async () => {
    const r = await renderScreen(<Harness />);
    await settle();
    expect(probe(r.root)).toBe("probe:Ana|1|Mami");
    expect(mockSync).toHaveBeenCalledWith(expect.anything(), "a");

    await act(async () => { chip(r.root, "Ben").props.onPress(); });
    await settle();
    expect(mockSetActive).toHaveBeenCalledWith("b");
    // Beni s'është hapur kurrë këtu: emri nga serveri, pa shënimet e Anës; prindi mbetet.
    expect(probe(r.root)).toBe("probe:Ben|0|Mami");
    expect(mockSync).toHaveBeenLastCalledWith(expect.anything(), "b");

    await act(async () => { chip(r.root, "Ana").props.onPress(); });
    await settle();
    expect(probe(r.root)).toBe("probe:Ana|1|Mami");
  });

  it("fëmija i kyçur hap Premium-in dhe s'ndërron asgjë", async () => {
    const r = await renderScreen(<Harness />);
    await settle();
    await act(async () => { chip(r.root, "Cen").props.onPress(); });
    await settle();
    expect(visibleText(r.root)).toContain("Bebix Premium");
    expect(mockSetActive).not.toHaveBeenCalledWith("c");
    expect(probe(r.root)).toBe("probe:Ana|1|Mami");
  });

  it("serveri refuzon (Premium skadoi ndërkohë): Premium-i hapet, Ana mbetet aktive me të dhënat e saj", async () => {
    mockSetActive.mockImplementation(async (id: string) => {
      if (id === "b") throw new ChildError("PREMIUM_REQUIRED");
    });
    const r = await renderScreen(<Harness />);
    await settle();
    await act(async () => { chip(r.root, "Ben").props.onPress(); });
    await settle();
    expect(visibleText(r.root)).toContain("Bebix Premium");
    expect(probe(r.root)).toBe("probe:Ana|1|Mami");
  });

  it("pa rrjet, me ndryshime të padërguara të profilit: ndërrimi s'bëhet dhe prindi e di pse", async () => {
    delete fakeSupabase().tables.children;
    const r = await renderScreen(<Harness />);
    await settle();
    await act(async () => { chip(r.root, "Ben").props.onPress(); });
    await settle();
    expect(visibleText(r.root)).toContain("S'ka lidhje. Provo përsëri kur të kesh internet.");
    expect(mockSetActive).not.toHaveBeenCalledWith("b");
    expect(probe(r.root)).toBe("probe:Ana|1|Mami");
  });

  it("Premium skadoi kur Beni ishte aktiv: app-i kalon vetë te Ana; të dhënat e Benit ruhen", async () => {
    await AsyncStorage.setItem("bebix_children_v1", JSON.stringify({ activeChildId: "b", children: KIDS, isPremium: true }));
    await AsyncStorage.setItem("bebix_app_state_v3", JSON.stringify({ profile: { babyName: "Ben", parentName: "Mami" } }));
    mockFetch.mockResolvedValue({ children: [KIDS[0], kid("b", "Ben", { isLocked: true }), KIDS[2]], isPremium: false });
    const r = await renderScreen(<Harness />);
    await settle();
    expect(mockSetActive).toHaveBeenCalledWith("a");
    expect(probe(r.root)).toBe("probe:Ana|0|Mami");
    expect(await AsyncStorage.getItem("bebix_child_v1:b:baby:feedingLog")).toContain("f1");
  });

  it("fëmija i dytë pa Premium: shtimi hap Premium-in", async () => {
    mockFetch.mockResolvedValue({ children: [KIDS[0]], isPremium: false });
    mockAdd.mockRejectedValue(new ChildError("PREMIUM_REQUIRED"));
    // Shtimi i fëmijës është te Cilësimet → Fëmijët (jo më te kreu).
    const r = await renderScreen(<><Harness /><ChildrenScreen /></>);
    await settle();
    // Me një fëmijë zgjedhësi lart s'shfaqet.
    expect(r.root.findByType(ChildSwitcher).children).toHaveLength(0);
    await act(async () => { chip(r.root, "Shto fëmijë").props.onPress(); });
    const inputs = r.root.findAllByType(TextInput);
    await act(async () => {
      inputs[0].props.onChangeText("Ben");
      inputs[1].props.onChangeText("01052026");
    });
    await act(async () => { chip(r.root, "Shto").props.onPress(); });
    await settle();
    expect(mockAdd).toHaveBeenCalledWith({ name: "Ben", birthDate: "2026-05-01" });
    expect(visibleText(r.root)).toContain("Bebix Premium");
  });
});
