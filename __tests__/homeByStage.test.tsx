/**
 * Kreu sipas fazës së fëmijës aktiv (faza 4): trackers vetëm 0–35 muaj, kreu i ri për 3–12 vjeç, arkivi për 13+,
 * dhe kujtesat e kujdesit vetëm kur kanë kuptim.
 */
import { fakeSupabase, renderScreen, visibleText } from "./helpers/screen";
import AsyncStorage from "@react-native-async-storage/async-storage";
import BabyHome from "@/app/(main)/baby/index";
import { NowCard } from "@/components/baby/NowCard";
import { WeeklyRecapCard } from "@/components/baby/WeeklyRecapCard";
import { TeamCard } from "@/components/baby/TeamCard";
import { DayClock } from "@/components/baby/DayClock";
import { ChildHome, expertOfDay } from "@/components/home/ChildHome";
import { buildInbox } from "@/lib/notifications/inbox";
import { initialBabyState } from "@/lib/state/babyTypes";
import { initialNotificationPrefs } from "@/lib/notifications/catalog";
import { translations } from "@/lib/i18n/translations";

const NOW = new Date(2026, 9, 14, 12, 0);
const born = (months: number) => new Date(2026, 9 - months, 10).toISOString();
const seed = (months: number) => AsyncStorage.setItem("bebix_app_state_v3", JSON.stringify({ profile: { babyName: "Ana", babyDob: born(months) } }));
const has = (root: Parameters<typeof visibleText>[0], type: unknown) => root.findAll((n) => n.type === type).length > 0;

beforeEach(() => {
  jest.useFakeTimers({
    now: NOW,
    doNotFake: ["hrtime", "nextTick", "performance", "queueMicrotask", "requestAnimationFrame", "cancelAnimationFrame",
      "requestIdleCallback", "cancelIdleCallback", "setImmediate", "clearImmediate", "setInterval", "clearInterval", "setTimeout", "clearTimeout"],
  });
  fakeSupabase().tables.community_experts = [];
});
afterEach(() => jest.useRealTimers());

describe("kreu sipas fazës", () => {
  it("foshnja (8 muaj): trackers dhe Ditari si më parë", async () => {
    await seed(8);
    const r = await renderScreen(<BabyHome />);
    expect(has(r.root, NowCard) && has(r.root, DayClock)).toBe(true);
    expect(visibleText(r.root)).toContain("Ditari");
    expect(has(r.root, ChildHome)).toBe(false);
  });

  it("fëmija (5 vjeç): pa trackers dhe pa Ditar; kartat e reja dhe rritja", async () => {
    await seed(60);
    const r = await renderScreen(<BabyHome />);
    for (const card of [NowCard, WeeklyRecapCard, TeamCard, DayClock]) expect(has(r.root, card)).toBe(false);
    const text = visibleText(r.root);
    expect(text).not.toContain("Ditari");
    expect(has(r.root, ChildHome)).toBe(true);
    expect(text).toContain("Vaksinat dhe kontrollet");
    expect(text).toContain("Rritja");
  });

  it("arkivi (14 vjeç): vetëm rritja, vaksinat dhe fotot, pa kartat e fëmijës", async () => {
    await seed(170);
    const r = await renderScreen(<BabyHome />);
    const text = visibleText(r.root);
    expect(text).toContain("Arkivi i Ana: rritja, vaksinat dhe fotot mbeten këtu.");
    expect(has(r.root, ChildHome) || has(r.root, NowCard)).toBe(false);
    expect(text).toContain("Rritja");
  });

  it("pa datëlindje: kreu i plotë si më parë", async () => {
    const r = await renderScreen(<BabyHome />);
    expect(has(r.root, NowCard)).toBe(true);
    expect(visibleText(r.root)).toContain("Ditari");
  });
});

describe("kujtesat sipas fazës", () => {
  const t = (key: string, p?: Record<string, string | number>) =>
    Object.entries(p ?? {}).reduce((s, [k, v]) => s.replace(`{${k}}`, String(v)), (translations.sq as Record<string, string>)[key] ?? key);
  const life = { createdAt: "", updatedAt: "", editCount: 0, deletedAt: null, archivedAt: null };
  const elevenHoursAgo = new Date(NOW.getTime() - 11 * 3_600_000).toISOString();
  const baby = {
    ...initialBabyState,
    // 11 orë para "tani" të testit (ora lokale), që të mos varet nga zona orare (CI e provon edhe në UTC+12).
    feedingLog: [{ ...life, id: "f", type: "bottle", amountMl: null, durationMin: null, side: null, foodCategory: null, at: elevenHoursAgo, note: "" }],
    diaperLog: [{ ...life, id: "d", type: "wet", color: null, consistency: null, at: elevenHoursAgo, note: "" }],
  } as never;

  it("me trackers: ushqyerja dhe pelena; pa trackers (3–12 vjeç): asnjëra", () => {
    const withCare = buildInbox({ baby, prefs: initialNotificationPrefs, t: t as never, lang: "sq", now: NOW });
    expect(withCare.map((i) => i.id.split(":")[0]).sort()).toEqual(["diaper", "feeding"]);
    expect(buildInbox({ baby, prefs: initialNotificationPrefs, t: t as never, lang: "sq", now: NOW, trackers: false })).toEqual([]);
  });
});

describe("eksperti i ditës", () => {
  const experts = [
    { id: "p", specialty: "pediatrician" },
    { id: "s1", specialty: "psychologist" },
    { id: "s2", specialty: "psychologist" },
  ] as never[];
  it("nga specialiteti i parë i fazës, një tjetër çdo ditë", () => {
    const a = expertOfDay(experts, "child", new Date(2026, 9, 14));
    const b = expertOfDay(experts, "child", new Date(2026, 9, 15));
    expect([a, b].map((e) => (e as { id: string }).id).sort()).toEqual(["s1", "s2"]);
    expect(expertOfDay([], "child")).toBeNull();
  });
});
