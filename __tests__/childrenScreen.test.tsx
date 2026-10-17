/**
 * Ekrani "Fëmijët" te Cilësimet: fëmija falas/aktiv/i kyçur, dhe ndërrimi i fëmijës falas (vetëm pronari, me kufirin
 * e 30 ditëve).
 */
import { fakeSupabase, renderScreen, visibleText } from "./helpers/screen";
import { Alert } from "react-native";
import { act, type ReactTestInstance } from "react-test-renderer";
import ChildrenScreen from "@/app/(main)/more/children";
import { ChildError, type Child } from "@/lib/children/api";
import { __resetChildrenStoreForTests } from "@/lib/children/store";

const mockFetch = jest.fn();
const mockSetFree = jest.fn();
jest.mock("@/lib/children/api", () => {
  const actual = jest.requireActual("@/lib/children/api");
  return { ...actual, fetchMyChildren: () => mockFetch(), setFreeChildRemote: (id: string) => mockSetFree(id), setActiveChildRemote: async () => {} };
});

let mockMe = "owner";
jest.mock("@/lib/hooks/useCurrentUserId", () => ({ useCurrentUserId: () => mockMe }));

const kid = (id: string, name: string, over: Partial<Child> = {}): Child => ({
  id, ownerId: "owner", name, birthDate: "2025-01-01", dueDate: null, photoPath: null,
  isFree: false, isLocked: false, isActive: false, createdAt: "2026-01-01", ...over,
});

const press = (root: ReactTestInstance, label: string) =>
  act(async () => {
    root.findAll((n) => typeof n.props.onPress === "function" && visibleText(n).includes(label))[0].props.onPress();
  });
const settle = async () => {
  for (let i = 0; i < 4; i++) await act(async () => { await new Promise((r) => setTimeout(r, 10)); });
};

beforeEach(() => {
  __resetChildrenStoreForTests();
  mockMe = "owner";
  mockFetch.mockReset().mockResolvedValue({
    children: [kid("a", "Ana", { isFree: true, isActive: true }), kid("b", "Ben", { isLocked: true })],
    isPremium: false,
  });
  mockSetFree.mockReset();
  // Konfirmimi: shtyp butonin e dytë ("Bëje falas").
  jest.spyOn(Alert, "alert").mockImplementation((_t, _m, buttons) => void buttons?.[1]?.onPress?.());
});
afterEach(() => jest.restoreAllMocks());

describe("Fëmijët", () => {
  it("tregon cili është aktiv, cili falas dhe cili i kyçur", async () => {
    fakeSupabase().session = { user: { id: "owner" } };
    const r = await renderScreen(<ChildrenScreen />);
    await settle();
    const text = visibleText(r.root);
    expect(text).toEqual(expect.arrayContaining(["Ana", "Aktiv", "Falas", "Ben", "Shto fëmijë"]));
    const ben = r.root.findAll((n) => n.props.accessibilityRole === "button" && String(n.props.accessibilityLabel).startsWith("Ben"))[0];
    expect(ben.props.accessibilityLabel).toContain("I kyçur");
  });

  it("pronari e bën Benin falas; brenda 30 ditëve serveri refuzon dhe prindi e lexon arsyen", async () => {
    fakeSupabase().session = { user: { id: "owner" } };
    const r = await renderScreen(<ChildrenScreen />);
    await settle();
    mockSetFree.mockResolvedValueOnce(undefined);
    await press(r.root, "Bëje falas");
    await settle();
    expect(mockSetFree).toHaveBeenCalledWith("b");
    expect(visibleText(r.root)).toContain("Ben tani është fëmija falas");

    mockSetFree.mockRejectedValueOnce(new ChildError("FREE_CHANGE_COOLDOWN"));
    await press(r.root, "Bëje falas");
    await settle();
    expect(visibleText(r.root)).toContain("Fëmija falas ndërrohet një herë në 30 ditë");
  });

  it("anëtari i familjes (jo pronari) s'e sheh butonin", async () => {
    mockMe = "babi";
    const r = await renderScreen(<ChildrenScreen />);
    await settle();
    expect(visibleText(r.root)).not.toContain("Bëje falas");
  });
});
