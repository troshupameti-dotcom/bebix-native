/**
 * Shtatzënia (faza 5): java dhe ditët deri në lindje, kreu pa trackers, "Bebi lindi" e kalon fëmijën te foshnja,
 * dhe onboarding-u me "Pres bebe".
 */
import { fakeSupabase, renderScreen, visibleText } from "./helpers/screen";
import { TextInput } from "react-native";
import { act, type ReactTestInstance } from "react-test-renderer";
import AsyncStorage from "@react-native-async-storage/async-storage";
import BabyHome from "@/app/(main)/baby/index";
import CreateProfile from "@/app/(auth)/create-profile";
import { NowCard } from "@/components/baby/NowCard";
import { PregnancyHome } from "@/components/home/PregnancyHome";
import { pregnancyProgress } from "@/lib/age/engine";
import { getPendingProfile, parseDueInput } from "@/lib/babyProfile";
import { __resetChildrenStoreForTests } from "@/lib/children/store";

const NOW = new Date(2026, 9, 14, 12, 0);
const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const inDays = (n: number) => new Date(2026, 9, 14 + n);
const press = (root: ReactTestInstance, label: string) =>
  act(async () => {
    const hits = root.findAll((n) => typeof n.props.onPress === "function" && visibleText(n).includes(label));
    hits[hits.length - 1].props.onPress();
  });
const settle = async () => {
  for (let i = 0; i < 5; i++) await act(async () => { await new Promise((r) => setTimeout(r, 15)); });
};

describe("java e shtatzënisë", () => {
  it("280 ditë: 140 ditë para = java 20; data e pritur = java 40, 0 ditë", () => {
    expect(pregnancyProgress(ymd(inDays(140)), NOW)).toEqual({ week: 20, daysLeft: 140 });
    expect(pregnancyProgress(ymd(inDays(279)), NOW)).toEqual({ week: 1, daysLeft: 279 });
    expect(pregnancyProgress(ymd(inDays(0)), NOW)).toEqual({ week: 40, daysLeft: 0 });
    expect(pregnancyProgress(ymd(inDays(-30)), NOW)).toEqual({ week: 42, daysLeft: 0 });
    expect(pregnancyProgress(null, NOW)).toBeNull();
  });

  it("data e pritur: nga 2 javë më parë deri 10 muaj përpara", () => {
    expect(parseDueInput("01.03.2027", NOW)).toBe("2027-03-01");
    expect(parseDueInput("01.10.2026", NOW)).toBe("2026-10-01");
    expect(parseDueInput("01.09.2026", NOW)).toBeNull();
    expect(parseDueInput("01.12.2027", NOW)).toBeNull();
    expect(parseDueInput("31.02.2027", NOW)).toBeNull();
  });
});

describe("kreu gjatë shtatzënisë", () => {
  beforeEach(async () => {
    jest.useFakeTimers({
      now: NOW,
      doNotFake: ["hrtime", "nextTick", "performance", "queueMicrotask", "requestAnimationFrame", "cancelAnimationFrame",
        "requestIdleCallback", "cancelIdleCallback", "setImmediate", "clearImmediate", "setInterval", "clearInterval", "setTimeout", "clearTimeout"],
    });
    __resetChildrenStoreForTests();
    await AsyncStorage.setItem("bebix_children_v1", JSON.stringify({
      activeChildId: "p",
      children: [{ id: "p", ownerId: "o", name: "Bebi", birthDate: null, dueDate: ymd(inDays(140)), photoPath: null, isFree: true, isLocked: false, isActive: true, createdAt: "" }],
      isPremium: false,
    }));
    await AsyncStorage.setItem("bebix_app_state_v3", JSON.stringify({ profile: { babyName: "Bebi" } }));
    fakeSupabase().tables.children = [];
  });
  afterEach(() => jest.useRealTimers());

  it("java dhe ditët, pa trackers; përmbajtja mungon pa zhurmë", async () => {
    const r = await renderScreen(<BabyHome />);
    await settle();
    const text = visibleText(r.root);
    expect(text).toContain("Java 20 e shtatzënisë");
    expect(text).toContain("140 ditë deri në lindje");
    expect(r.root.findAll((n) => n.type === NowCard)).toHaveLength(0);
    expect(text).not.toContain("Ditari");
  });

  it("“Bebi lindi”: me datëlindjen kreu kalon te foshnja", async () => {
    const r = await renderScreen(<BabyHome />);
    await settle();
    await press(r.root, "Bebi lindi");
    const inputs = r.root.findByType(PregnancyHome).findAllByType(TextInput);
    await act(async () => {
      inputs[0].props.onChangeText("Ana");
      inputs[1].props.onChangeText("10102026");
    });
    await press(r.root, "Ruaj");
    await settle();
    expect(r.root.findAll((n) => n.type === PregnancyHome)).toHaveLength(0);
    expect(r.root.findAll((n) => n.type === NowCard).length).toBeGreaterThan(0);
    expect(visibleText(r.root)).toContain("Ana");
  });
});

describe("onboarding-u", () => {
  it("“Pres bebe”: pyet datën e pritur dhe e ruan për krijimin e fëmijës", async () => {
    const r = await renderScreen(<CreateProfile />);
    const type = async (v: string) => act(async () => { r.root.findByType(TextInput).props.onChangeText(v); });
    await type("Bebi");
    await press(r.root, "Vazhdo");
    await type("Mami");
    await press(r.root, "Vazhdo");
    await press(r.root, "Pres bebe");
    expect(visibleText(r.root)).toEqual(expect.arrayContaining(["Kur pritet bebi?", "Data e pritur e lindjes"]));
    const due = new Date();
    due.setMonth(due.getMonth() + 3);
    await type(`${pad(due.getDate())}${pad(due.getMonth() + 1)}${due.getFullYear()}`);
    await press(r.root, "Vazhdo");
    await press(r.root, "Krijo llogarinë");
    const pending = await getPendingProfile();
    expect(pending).toMatchObject({ babyName: "Bebi", babyDob: null, babyDueDate: ymd(due) });
  });
});
