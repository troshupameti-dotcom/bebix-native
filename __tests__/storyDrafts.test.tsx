/**
 * Përralla e javës nga Claude: ilustrimi kalon vetëm i pastër, përgjigjja e Claude-it kontrollohet para ruajtjes,
 * tema e javës mbush kategoritë që kanë më pak, dhe admini e sheh draftin, e lexon dhe e publikon nga paneli.
 */
import { fakeSupabase, renderScreen, router, setParams, visibleText } from "./helpers/screen";
import { Alert } from "react-native";
import { SvgXml } from "react-native-svg";
import { act } from "react-test-renderer";
import AdminStories from "@/app/(main)/more/admin/stories";
import AdminStoryScreen from "@/app/(main)/more/admin/story/[id]";
import { StoryCover } from "@/components/stories/StoryCover";
import { __resetAdminCacheForTests } from "@/lib/admin/access";
import { splitParagraphs } from "@/lib/admin/api";
import { sanitizeSvg } from "@/supabase/functions/story-draft/svg";
import { OUTPUT_SCHEMA, pickTheme, slugify, validateDraft } from "@/supabase/functions/story-draft/story";

const settle = async () => {
  for (let i = 0; i < 6; i++) await act(async () => { await new Promise((r) => setTimeout(r, 15)); });
};

const SVG = '<svg viewBox="0 0 160 120"><rect x="0" y="0" width="160" height="120" fill="#21403F"/><circle cx="80" cy="60" r="20" fill="#F3EBD9"/><path d="M70 60 q4 3 8 0" stroke="#5E5346" stroke-width="1.8" fill="none"/><g transform="translate(10,10)"><ellipse cx="20" cy="90" rx="12" ry="5" fill="url(#g1)"/></g><defs><linearGradient id="g1"><stop offset="0" stop-color="#C1DDD8"/></linearGradient></defs></svg>';

describe("ilustrimi i Claude-it", () => {
  it("figura e thjeshtë kalon dhe merr gjithmonë kornizën 160×120", () => {
    const clean = sanitizeSvg(SVG.replace('viewBox="0 0 160 120"', 'width="999" viewBox="0 0 10 10"'))!;
    expect(clean).toContain('viewBox="0 0 160 120"');
    expect(clean).not.toContain("999");
    expect(clean).toContain('fill="url(#g1)"');
  });

  it.each([
    ["skript", SVG.replace("</svg>", "<script>alert(1)</script></svg>")],
    ["atribut on…", SVG.replace("<rect ", '<rect onload="x()" ')],
    ["lidhje", SVG.replace("<rect ", '<rect href="https://x.com" ')],
    ["stil", SVG.replace("<rect ", '<rect style="fill:red" ')],
    ["tekst", SVG.replace("</svg>", "<text>Hi</text></svg>")],
    ["url e jashtme", SVG.replace("url(#g1)", "url(https://x.com/a)")],
    ["imazh", SVG.replace("</svg>", '<image href="a.png"/></svg>')],
    ["etiketë e pambyllur", SVG.replace("</g>", "")],
    ["jo SVG", "<div></div>"],
  ])("refuzohet: %s", (_name, svg) => {
    expect(sanitizeSvg(svg)).toBeNull();
  });

  it("app-i vizaton figurën e pastër; figura e rrezikshme kalon te skena e gatshme", async () => {
    const good = await renderScreen(<StoryCover story={{ cover: "moon", coverUrl: null, coverSvg: SVG }} />);
    expect(good.root.findAllByType(SvgXml)).toHaveLength(1);
    const bad = await renderScreen(<StoryCover story={{ cover: "moon", coverUrl: null, coverSvg: SVG.replace("<rect ", '<rect onload="x()" ') }} />);
    expect(bad.root.findAllByType(SvgXml)).toHaveLength(0);
  });
});

describe("përgjigjja e Claude-it", () => {
  const good = {
    title: "Pema e dimrit",
    summary: "Një pemë e vogël pret pranverën.",
    paragraphs: ["Një.", "Dy.", "Tre.", "Katër.", "Pesë."],
    categories: ["nature", "nature", "horror"],
    age_min_months: 12,
    age_max_months: 48,
    cover_svg: SVG,
    fallback_scene: "seed",
  };

  it("pranohet, pastrohet dhe merr kohën e leximit", () => {
    const r = validateDraft(good);
    expect("draft" in r).toBe(true);
    if (!("draft" in r)) return;
    expect(r.draft.categories).toEqual(["nature"]);
    expect(r.draft.cover_svg).toContain('viewBox="0 0 160 120"');
    expect(r.draft.cover_key).toBe("seed");
    expect(r.draft.reading_minutes).toBe(1);
  });

  it("ilustrimi i dobët s'e rrëzon përrallën; teksti i mangët po", () => {
    const r = validateDraft({ ...good, cover_svg: "<svg><script/></svg>" });
    expect("draft" in r && r.draft.cover_svg).toBeNull();
    expect(validateDraft({ ...good, paragraphs: ["Vetëm një."] })).toEqual({ error: "paragraphs" });
    expect(validateDraft({ ...good, age_min_months: 48, age_max_months: 24 })).toEqual({ error: "ages" });
    expect(validateDraft({ ...good, categories: ["horror"] })).toEqual({ error: "categories" });
  });

  it("forma e përgjigjes kërkon çdo fushë", () => {
    expect([...OUTPUT_SCHEMA.required].sort()).toEqual(Object.keys(OUTPUT_SCHEMA.properties).sort());
  });

  it("emri në URL pa “ë”/“ç” dhe i lirë", () => {
    expect(slugify("Hëna që s'donte të flinte", new Set())).toBe("hena-qe-sdonte-te-flinte");
    expect(slugify("Çorapet e Arit", new Set(["corapet-e-arit"]))).toBe("corapet-e-arit-2");
  });

  it("tema e javës: kategoria dhe mosha me më pak përralla", () => {
    const rows = [
      { title: "a", categories: ["sleep", "nature", "adventure", "friendship", "emotions", "lessons"], age_min_months: 0, age_max_months: 72, status: "published" },
      { title: "b", categories: ["classic"], age_min_months: 36, age_max_months: 72, status: "archived" },
    ];
    expect(pickTheme(rows, 3)).toEqual(expect.objectContaining({ category: "classic" }));
    expect(pickTheme([{ title: "c", categories: ["sleep"], age_min_months: 0, age_max_months: 24, status: "draft" }], 0).band).toBe("3-6");
  });

  it("paragrafët e redaktuar ndahen me rresht bosh", () => {
    expect(splitParagraphs("Një\nrresht.\n\nDy.\n \n\nTre.")).toEqual(["Një rresht.", "Dy.", "Tre."]);
  });
});

describe("paneli: Përrallat", () => {
  const DRAFT = {
    id: "s1",
    slug: "pema-e-dimrit",
    title: "Pema e dimrit",
    summary: "Një pemë e vogël pret pranverën.",
    paragraphs: ["Ishte dimër në kopsht.", "Pema e vogël priste."],
    categories: ["nature"],
    age_min_months: 12,
    age_max_months: 48,
    reading_minutes: 2,
    cover_key: "seed",
    cover_url: null,
    cover_svg: SVG,
    status: "draft",
    source: "ai",
    featured: false,
    ai_idea: "Për dimrin",
    created_at: "2026-10-26T06:01:00Z",
    published_at: null,
  };

  beforeEach(() => {
    __resetAdminCacheForTests();
    fakeSupabase().session = { user: { id: "me", email: "admin@bebix.store" } };
    fakeSupabase().tables.admins = { user_id: "me" };
  });
  afterEach(() => jest.restoreAllMocks());

  it("drafti i Claude-it del te lista dhe hapet", async () => {
    fakeSupabase().tables.stories = [DRAFT];
    const r = await renderScreen(<AdminStories />);
    await settle();
    const text = visibleText(r.root).join(" | ");
    expect(text).toContain("Pema e dimrit");
    expect(text).toContain("nga Claude");
    expect(text).toContain("Shkruaj një tani");
    await act(async () => r.root.findAll((n) => n.props.accessibilityLabel === "Pema e dimrit" && typeof n.props.onPress === "function")[0].props.onPress());
    expect(router().push).toHaveBeenCalledWith({ pathname: "/more/admin/story/[id]", params: { id: "s1" } });
  });

  it("admini e lexon të gjithën dhe e publikon me një prekje", async () => {
    fakeSupabase().tables.stories = DRAFT;
    setParams({ id: "s1" });
    jest.spyOn(Alert, "alert").mockImplementation((_t, _m, buttons) => buttons?.[buttons.length - 1]?.onPress?.());
    const r = await renderScreen(<AdminStoryScreen />);
    await settle();
    const text = visibleText(r.root).join(" | ");
    expect(text).toContain("Ishte dimër në kopsht.");
    expect(text).toContain("Ideja: Për dimrin");
    const before = fakeSupabase().calls.filter((c) => c.name === "stories").length;
    await act(async () => r.root.findAll((n) => typeof n.props.onPress === "function" && visibleText(n).join(" ") === "Publiko")[0].props.onPress());
    await settle();
    expect(fakeSupabase().calls.filter((c) => c.name === "stories").length).toBeGreaterThan(before);
    expect(router().back).toHaveBeenCalled();
  });
});
