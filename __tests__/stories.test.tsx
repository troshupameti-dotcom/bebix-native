/**
 * Përrallat: përmbajtja e app-it është e plotë dhe e njëjtë me migrimin, kërkimi dhe filtrat punojnë, biblioteka
 * hapet edhe pa rrjet (me përrallat e app-it), libri ndan tekstin në faqe sipas ekranit (një faqe ose dy), faqet
 * kthehen dhe vendi i leximit ruhet, dhe madhësia e tekstit dhe pamja e librit ndryshojnë.
 */
import { fakeSupabase, renderScreen, router, setParams, visibleText } from "./helpers/screen";
import { StyleSheet, Text, TextInput } from "react-native";
import { act, type ReactTestInstance, type ReactTestRenderer } from "react-test-renderer";
import StoriesLibrary from "@/app/(main)/baby/stories/index";
import StoryDetail from "@/app/(main)/baby/stories/[slug]";
import StoryReader from "@/app/(main)/baby/stories/read/[slug]";
import { STORY_SCENES } from "@/components/stories/StoryCover";
import { BUNDLED_STORIES, bandForMonths, filterStories, storyOfTheDay } from "@/lib/stories/catalog";
import { __resetStoriesCacheForTests } from "@/lib/stories/api";
import { __resetStoryIndexForTests } from "@/lib/stories/useStoryIndex";
import { __resetStoryUserDataForTests } from "@/lib/stories/userData";
import { STORY_CATEGORIES } from "@/lib/stories/types";
import { hasFeature } from "@/lib/age/stageConfig";
import { DEFAULT_SIZE, anchorOfPosition, bookMetrics, buildBook, linesToSlices, packPages, paragraphPages, positionCount, positionOfAnchor } from "@/components/stories/book/layout";
import raw from "@/content/stories/sq.json";

/* eslint-disable @typescript-eslint/no-require-imports -- si te migrationGrants.test: pa tipet e Node në projekt */
const fs = require("fs") as { readFileSync(file: string, enc: "utf8"): string };
const path = require("path") as { join(...p: string[]): string };
/* eslint-enable @typescript-eslint/no-require-imports */
declare const __dirname: string;

const MIGRATION = fs.readFileSync(path.join(__dirname, "..", "supabase", "migrations", "20261024090000_stories.sql"), "utf8");

const settle = async () => {
  for (let i = 0; i < 5; i++) await act(async () => { await new Promise((r) => setTimeout(r, 10)); });
};
const pressLabel = async (r: ReactTestRenderer, label: string) => {
  await act(async () => {
    const hits = r.root.findAll((n) => n.props.accessibilityLabel === label && typeof n.props.onPress === "function");
    hits[hits.length - 1].props.onPress();
  });
  await settle();
};
const pressText = async (r: ReactTestRenderer, text: string) => {
  await act(async () => {
    const hits = r.root.findAll((n) => typeof n.props.onPress === "function" && visibleText(n).join(" ").includes(text));
    hits[hits.length - 1].props.onPress();
  });
  await settle();
};
const text = (r: ReactTestRenderer) => visibleText(r.root).join(" | ");
const paragraphNode = (root: ReactTestInstance, paragraph: string) =>
  root.findAll((n) => n.type === Text && n.props.children === paragraph)[0];

beforeEach(() => {
  __resetStoriesCacheForTests();
  __resetStoryIndexForTests();
  __resetStoryUserDataForTests();
  fakeSupabase().session = { user: { id: "me" } };
});

describe("përmbajtja", () => {
  it("çdo përrallë e app-it është e plotë: slug i vlefshëm, kategori të njohura, mosha, tekst", () => {
    expect(BUNDLED_STORIES.length).toBeGreaterThanOrEqual(12);
    expect(new Set(BUNDLED_STORIES.map((s) => s.slug)).size).toBe(BUNDLED_STORIES.length);
    for (const [i, s] of BUNDLED_STORIES.entries()) {
      expect(s.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(s.categories.length).toBe(raw[i].categories.length);
      expect(s.categories.length).toBeGreaterThan(0);
      expect(s.ageMaxMonths).toBeGreaterThan(s.ageMinMonths);
      expect(s.title.length).toBeLessThanOrEqual(120);
      expect(s.summary.length).toBeLessThanOrEqual(400);
      expect(s.paragraphs.length).toBeGreaterThanOrEqual(5);
      for (const p of s.paragraphs) expect(p.trim().length).toBeGreaterThan(0);
    }
    // Çdo kategori ka të paktën një përrallë, që asnjë filtër të mos jetë bosh.
    for (const c of STORY_CATEGORIES) expect(BUNDLED_STORIES.some((s) => s.categories.includes(c))).toBe(true);
  });

  it("çdo përrallë ka ilustrimin e vet, pa përsëritje", () => {
    const covers = BUNDLED_STORIES.map((s) => s.cover);
    for (const c of covers) expect(STORY_SCENES).toContain(c);
    expect(new Set(covers).size).toBe(covers.length);
  });

  it("migrimi shton të njëjtat përralla si app-i (titulli dhe çdo paragraf)", () => {
    for (const s of BUNDLED_STORIES) {
      expect(MIGRATION).toContain(`$s$${s.slug}$s$`);
      expect(MIGRATION).toContain(`$s$${s.title}$s$`);
      for (const p of s.paragraphs) expect(MIGRATION).toContain(`$s$${p}$s$`);
    }
  });
});

describe("kërkimi dhe filtrat", () => {
  it("kërkimi pa “ë” gjen “Hëna”; kategoria dhe mosha bashkohen", () => {
    expect(filterStories(BUNDLED_STORIES, { query: "hena" }).map((s) => s.slug)).toContain("hena-qe-nuk-donte-te-flinte");
    expect(filterStories(BUNDLED_STORIES, { query: "breshka lepuri" }).map((s) => s.slug)).toEqual(["breshka-dhe-lepuri"]);
    const classic = filterStories(BUNDLED_STORIES, { category: "classic" });
    expect(classic.length).toBe(2);
    const babies = filterStories(BUNDLED_STORIES, { band: "0-1" }).map((s) => s.slug);
    expect(babies).toEqual(expect.arrayContaining(["ariu-i-vogel-dhe-batanija", "mirembrema-shtepi"]));
    expect(babies).not.toContain("varka-e-letres");
    expect(filterStories(BUNDLED_STORIES, { category: "classic", band: "0-1" })).toEqual([]);
  });

  it("mosha e fëmijës zgjedh grupin; përralla e ditës i përshtatet moshës dhe s'ndryshon brenda ditës", () => {
    expect([bandForMonths(5), bandForMonths(20), bandForMonths(40), bandForMonths(100), bandForMonths(null)]).toEqual(["0-1", "1-3", "3-6", null, null]);
    const morning = storyOfTheDay(BUNDLED_STORIES, 6, new Date(2026, 9, 22, 8));
    const evening = storyOfTheDay(BUNDLED_STORIES, 6, new Date(2026, 9, 22, 21));
    expect(morning?.slug).toBe(evening?.slug);
    expect(morning!.ageMinMonths).toBeLessThan(12);
    expect(morning!.categories).toContain("sleep");
  });

  it("karta e kreut: për foshnjën dhe fëmijën, jo për shtatzëninë", () => {
    expect([hasFeature("infant", "stories"), hasFeature("toddler", "stories"), hasFeature("child", "stories"), hasFeature("pregnancy", "stories")]).toEqual([true, true, true, false]);
  });
});

describe("biblioteka", () => {
  it("pa rrjet hap përrallat e app-it: të veçuarat, lista, kategoritë", async () => {
    const r = await renderScreen(<StoriesLibrary />);
    await settle();
    const all = text(r);
    expect(all).toContain("Përralla");
    expect(all).toContain("Të veçuara");
    expect(all).toContain("Të gjitha përrallat");
    expect(all).toContain(`${BUNDLED_STORIES.length} përralla`);
    expect(all).toContain("Për gjumë");
    expect(all).toContain("Mirëmbrëma, shtëpi");
  });

  it("kërkimi, filtri i kategorisë, gjendja bosh dhe “Hiq filtrat”", async () => {
    const r = await renderScreen(<StoriesLibrary />);
    await settle();
    await act(async () => r.root.findByType(TextInput).props.onChangeText("kermilli"));
    expect(text(r)).toContain("Kërmilli që nuk nxitonte");
    expect(text(r)).toContain("1 përrallë");
    expect(text(r)).not.toContain("Të veçuara");

    await act(async () => r.root.findByType(TextInput).props.onChangeText("dinosaur"));
    expect(text(r)).toContain("Asnjë përrallë nuk u gjet");
    await pressText(r, "Hiq filtrat");
    expect(r.root.findByType(TextInput).props.value).toBe("");

    await pressText(r, "Përralla klasike");
    expect(text(r)).toContain("Breshka dhe lepuri");
    expect(text(r)).toContain("2 përralla");
    expect(text(r)).not.toContain("Varka e letrës");
  });

  it("“Të preferuarat” bosh tregon si ruhet një përrallë", async () => {
    const r = await renderScreen(<StoriesLibrary />);
    await settle();
    await pressText(r, "Të preferuarat");
    expect(text(r)).toContain("Ende pa përralla të preferuara");
  });

  it("përrallat e reja nga baza dalin pa përditësim të app-it", async () => {
    fakeSupabase().tables.stories = [
      { slug: "pema-e-dimrit", title: "Pema e dimrit", summary: "Një pemë pret pranverën.", categories: ["nature"], age_min_months: 12, age_max_months: 72, reading_minutes: 4, cover_key: null, cover_url: null, featured: false, sort_order: 1, updated_at: "2026-10-22T10:00:00Z" },
    ];
    const r = await renderScreen(<StoriesLibrary />);
    await settle();
    expect(text(r)).toContain("Pema e dimrit");
    expect(text(r)).toContain("1 përrallë");
    expect(text(r)).not.toContain("Varka e letrës");
  });

  it("hapja e një përralle shkon te faqja e saj", async () => {
    const r = await renderScreen(<StoriesLibrary />);
    await settle();
    await act(async () => r.root.findByType(TextInput).props.onChangeText("varka"));
    await pressText(r, "Varka e letrës");
    expect(router().push).toHaveBeenCalledWith({ pathname: "/(main)/baby/stories/[slug]", params: { slug: "varka-e-letres" } });
  });
});

describe("faqja e përrallës", () => {
  it("tregon kohën, moshën, kategoritë; “Lexo” hap librin nga kopertina; zemra e ruan dhe e dërgon te baza", async () => {
    setParams({ slug: "varka-e-letres" });
    const r = await renderScreen(<StoryDetail />);
    await settle();
    const all = text(r);
    expect(all).toContain("Varka e letrës");
    expect(all).toContain("3 min lexim");
    expect(all).toContain("3–6 vjeç");
    expect(all).toContain("Aventurë");
    await pressLabel(r, "Shto te të preferuarat");
    expect(r.root.findAll((n) => n.props.accessibilityLabel === "Hiq nga të preferuarat").length).toBeGreaterThan(0);
    expect(fakeSupabase().calls.some((c) => c.name === "story_favorites")).toBe(true);
    await pressText(r, "Lexo");
    expect(router().push).toHaveBeenCalledWith({ pathname: "/(main)/baby/stories/read/[slug]", params: { slug: "varka-e-letres", from: "0" } });
  });

  it("përralla që s'është më në bazë, dhe gabimi pa rrjet për përrallë që s'e ka telefoni", async () => {
    fakeSupabase().tables.stories = null;
    setParams({ slug: "e-fshire" });
    const gone = await renderScreen(<StoryDetail />);
    await settle();
    expect(text(gone)).toContain("Kjo përrallë nuk është më në bibliotekë.");

    delete fakeSupabase().tables.stories;
    setParams({ slug: "vetem-ne-baze" });
    const offline = await renderScreen(<StoryDetail />);
    await settle();
    expect(text(offline)).toContain("Përralla nuk u hap. Kontrolloni lidhjen me internetin dhe provoni përsëri.");
    expect(text(offline)).toContain("Provo përsëri");
  });
});

describe("faqosja e librit", () => {
  const m = { innerH: 100, lineHeight: 20, paragraphGap: 10 };

  it("rreshtat ndahen në faqe pa humbur asnjë shkronjë, dhe s'lihet një rresht i vetëm në krye të faqes", () => {
    const para = "Një dy tre katër pesë gjashtë shtatë tetë nëntë dhjetë njëmbëdhjetë.";
    const lines = ["Një dy ", "tre katër ", "pesë gjashtë ", "shtatë tetë ", "nëntë ", "dhjetë njëmbëdhjetë."];
    const slices = linesToSlices(para, lines)!;
    expect(slices.join("")).toBe(para);
    const pages = packPages([slices], m);
    // 5 rreshta zënë faqen; i gjashti do mbetej vetëm, ndaj faqja e parë merr 4 dhe e dyta 2.
    expect(pages.map((p) => p.length)).toEqual([1, 1]);
    expect(pages[0][0].text + " " + pages[1][0].text).toBe(para);
    expect(pages[1][0].start).toBe(slices.slice(0, 4).join("").length);
  });

  it("rreshtat e telefonit pa hapësirën në fund merren nga teksti origjinal; vizë ndarëse → pa matje", () => {
    expect(linesToSlices("Ana ka një mace.", ["Ana ka", "një mace."])).toEqual(["Ana ka ", "një mace."]);
    expect(linesToSlices("Ana ka një mace.", ["Ana ka një ma-", "ce."])).toBeNull();
  });

  it("telefon: një faqe; tablet ose ekran i gjerë: libër i hapur me dy faqe", () => {
    expect(bookMetrics(390, 700, DEFAULT_SIZE).mode).toBe("single");
    expect(bookMetrics(320, 480, DEFAULT_SIZE).mode).toBe("single");
    expect(bookMetrics(1180, 760, DEFAULT_SIZE).mode).toBe("spread");
    expect(bookMetrics(1024, 1300, DEFAULT_SIZE).mode).toBe("spread");
    const small = bookMetrics(320, 480, DEFAULT_SIZE);
    expect(small.innerW).toBeGreaterThan(200);
    expect(small.pageW).toBeLessThanOrEqual(320);
  });

  it("vendi i leximit mbetet i njëjtë kur ndryshon faqosja (shkronja ose ekrani)", () => {
    const paragraphs = BUNDLED_STORIES[0].paragraphs;
    const single = buildBook(paragraphPages(paragraphs), "single");
    const anchor = anchorOfPosition(single, "single", 4);
    expect(anchor).toEqual({ kind: "text", paragraph: 3, offset: 0 });
    const spread = buildBook(paragraphPages(paragraphs), "spread");
    expect(spread.length % 2).toBe(0);
    const pos = positionOfAnchor(spread, "spread", anchor);
    const shown = [spread[pos * 2], spread[pos * 2 + 1]];
    expect(shown.some((p) => p.kind === "text" && p.blocks[0].paragraph === 3)).toBe(true);
    expect(positionOfAnchor(spread, "spread", { kind: "end" })).toBe(positionCount(spread, "spread") - 1);
  });
});

describe("lexuesi (libri)", () => {
  const story = BUNDLED_STORIES.find((s) => s.slug === "varka-e-letres")!;
  const total = story.paragraphs.length + 2;
  /** Pa matje rreshtash (si në teste), libri kalon te "një paragraf në faqe" pas pak. */
  const openBook = async (params: Record<string, string>) => {
    setParams({ slug: story.slug, ...params });
    const r = await renderScreen(<StoryReader />);
    await act(async () => { await new Promise((res) => setTimeout(res, 950)); });
    await settle();
    return r;
  };

  it("hapet te kopertina; faqet kthehen përpara dhe mbrapa; vendi ruhet dhe “Vazhdo leximin” e hap aty", async () => {
    const r = await openBook({ from: "0" });
    expect(text(r)).toContain("Përrallat e Bebix-it");
    expect(text(r)).toContain(`Faqja 1 nga ${total}`);
    await pressLabel(r, "Faqja tjetër");
    expect(text(r)).toContain(story.paragraphs[0]);
    expect(text(r)).toContain(`Faqja 2 nga ${total}`);
    await pressLabel(r, "Faqja tjetër");
    await pressLabel(r, "Faqja tjetër");
    expect(text(r)).toContain(story.paragraphs[2]);
    await pressLabel(r, "Faqja e mëparshme");
    expect(text(r)).toContain(story.paragraphs[1]);
    expect(fakeSupabase().calls.some((c) => c.name === "story_progress")).toBe(true);

    setParams({ slug: story.slug });
    const detail = await renderScreen(<StoryDetail />);
    await settle();
    expect(text(detail)).toContain("Vazhdo leximin");
    expect(text(detail)).toContain("14% e lexuar");
  });

  it("“Vazhdo” hap librin te paragrafi ku mbeti prindi", async () => {
    const r = await openBook({ from: "3" });
    expect(text(r)).toContain(story.paragraphs[3]);
    expect(text(r)).toContain(`Faqja 5 nga ${total}`);
  });

  it("madhësia e tekstit ndryshon nga “Pamja e leximit” dhe ruhet; pamja “Natë”", async () => {
    const r = await openBook({ from: "1" });
    const size = (root: ReactTestInstance) => StyleSheet.flatten(paragraphNode(root, story.paragraphs[1]).props.style).fontSize as number;
    const start = size(r.root);
    await pressLabel(r, "Pamja e leximit");
    await pressLabel(r, "Tekst më i madh");
    await act(async () => { await new Promise((res) => setTimeout(res, 950)); });
    expect(size(r.root)).toBeGreaterThan(start);
    await pressLabel(r, "Natë");
    const night = StyleSheet.flatten(paragraphNode(r.root, story.paragraphs[1]).props.style).color;

    const again = await openBook({ from: "1" });
    expect(size(again.root)).toBeGreaterThan(start);
    expect(StyleSheet.flatten(paragraphNode(again.root, story.paragraphs[1]).props.style).color).toBe(night);
  });

  it("në fund: “Fund”, përralla tjetër dhe “Lexo përsëri”; përralla shënohet e lexuar", async () => {
    const r = await openBook({ from: String(story.paragraphs.length - 1) });
    await pressLabel(r, "Faqja tjetër");
    expect(text(r)).toContain("Fund");
    expect(text(r)).toContain("Përralla tjetër");
    await pressText(r, "Lexo përsëri");
    expect(text(r)).toContain(`Faqja 1 nga ${total}`);

    setParams({ slug: story.slug });
    const detail = await renderScreen(<StoryDetail />);
    await settle();
    expect(text(detail)).toContain("E lexuar");
  });
});
