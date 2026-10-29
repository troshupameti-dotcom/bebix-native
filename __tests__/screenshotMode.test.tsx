/**
 * Mënyra e fotografimit (fotot e app-it për rrjetet sociale): komuniteti me postime shembull nga profile të
 * trilluara, pa emra të vërtetë, pa shkruar asgjë në bazë, dhe kurrë në app-in e dyqaneve (vetëm __DEV__).
 * Bashkë me to: kohët e gjata te Bebi në ditë, jo "243 orë".
 */
import { fakeSupabase } from "./helpers/screen";
import { fetchComments, fetchFeed, fetchNewestPostAt, fetchPost, toggleLike } from "@/lib/communityData";
import { isScreenshotMode, setScreenshotMode } from "@/lib/demo/screenshotMode";
import { sinceLabel } from "@/lib/baby/dayStats";
import { translations, type TranslationKey } from "@/lib/i18n/translations";

const sq = translations.sq;
const t = (key: TranslationKey, vars?: Record<string, string | number>) =>
  Object.entries(vars ?? {}).reduce((s, [k, v]) => s.replace(`{${k}}`, String(v)), sq[key] as string);

afterEach(() => setScreenshotMode(false));

describe("mënyra e fotografimit", () => {
  it("e fikur: rrjedha vjen nga baza si gjithmonë", async () => {
    fakeSupabase().tables.community_feed = [];
    expect(await fetchFeed()).toEqual([]);
    expect(fakeSupabase().calls.some((c) => c.name === "community_feed")).toBe(true);
  });

  it("e ndezur: psikologe, nutricioniste me foto e recetë, pediatër dhe prindër; asnjë thirrje në bazë", async () => {
    setScreenshotMode(true);
    fakeSupabase().calls = [];
    const posts = await fetchFeed();
    expect(fakeSupabase().calls).toEqual([]);
    expect(posts.map((p) => p.authorSpecialty)).toEqual(expect.arrayContaining(["psychologist", "nutritionist", "pediatrician"]));
    expect(posts.some((p) => !p.authorIsExpert)).toBe(true);
    const nutrition = posts.find((p) => p.authorSpecialty === "nutritionist")!;
    expect(nutrition.media).toHaveLength(1);
    expect(nutrition.text).toMatch(/Për një porcion/);
    // Psikologia e para (fotoja e parë e rrjedhës), nga më i riu te më i vjetri.
    expect(posts[0].authorSpecialty).toBe("psychologist");
    const times = posts.map((p) => new Date(p.at).getTime());
    expect([...times].sort((a, b) => b - a)).toEqual(times);
  });

  it("filtrat punojnë si te rrjedha e vërtetë: ekspertët, tema, kërkimi; s'ka faqe të dytë", async () => {
    setScreenshotMode(true);
    expect((await fetchFeed({ tab: "experts" })).every((p) => p.authorIsExpert)).toBe(true);
    expect((await fetchFeed({ tab: "experts", specialty: "psychologist" })).map((p) => p.authorName)).toEqual(["Dr. Elira Kastrati"]);
    expect((await fetchFeed({ topic: "#gjumiibebit" })).every((p) => p.tag === "#gjumiibebit")).toBe(true);
    expect((await fetchFeed({ query: "jogurt" })).map((p) => p.authorSpecialty)).toEqual(["nutritionist"]);
    expect(await fetchFeed({ before: new Date().toISOString() })).toEqual([]);
  });

  it("postimi hapet me komente; pëlqimi s'shkon në bazë", async () => {
    setScreenshotMode(true);
    const [first] = await fetchFeed({ topic: "#ushqimingurte" });
    expect((await fetchPost(first.id))?.text).toBe(first.text);
    const comments = await fetchComments(first.id);
    expect(comments.some((c) => c.expert?.specialty === "nutritionist")).toBe(true);
    fakeSupabase().calls = [];
    await toggleLike(first.id, false);
    expect(fakeSupabase().calls).toEqual([]);
    expect(await fetchNewestPostAt()).toBe((await fetchFeed())[0].at);
  });

  it("në app-in e dyqaneve (pa __DEV__) s'ndizet kurrë", () => {
    const g = globalThis as unknown as { __DEV__: boolean };
    const dev = g.__DEV__;
    g.__DEV__ = false;
    try {
      setScreenshotMode(true);
      expect(isScreenshotMode()).toBe(false);
    } finally {
      g.__DEV__ = dev;
    }
  });
});

describe("kohët e gjata te Bebi", () => {
  const now = new Date("2026-10-30T12:00:00Z");
  const before = (minutes: number) => new Date(now.getTime() - minutes * 60_000).toISOString();

  it("deri në dy ditë në orë e minuta, pas tyre në ditë", () => {
    expect(sinceLabel(before(150), t, now)).toBe("2 orë 30 min");
    expect(sinceLabel(before(47 * 60), t, now)).toBe("47 orë");
    expect(sinceLabel(before(243 * 60 + 25), t, now)).toBe("10 ditë");
  });

  it("teksti i kujtesës në shqip standard", () => {
    expect(t("baby_since_feeding", { n: 5 })).toBe("Kanë kaluar 5 orë nga ushqyerja e fundit");
    expect(t("baby_since_feeding_days", { n: 10 })).toBe("Kanë kaluar 10 ditë nga ushqyerja e fundit");
  });
});
