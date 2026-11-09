import { act } from "react-test-renderer";
import { button, renderScreen, setParams, visibleText } from "./helpers/screen";
import RecipeDetail from "@/app/(main)/baby/recipes/[slug]";
import RecipesLibrary from "@/app/(main)/baby/recipes/index";
import { useAppState } from "@/lib/state/AppStateContext";
import type { FeedingEntry } from "@/lib/state/types";

/** 7 muaj e disa ditë më parë; dita kufizohet te 28, që "minus 7 muaj" të mos kalojë në muajin tjetër. */
function sevenMonthsAgo(): string {
  const d = new Date();
  d.setDate(Math.min(d.getDate(), 28));
  d.setMonth(d.getMonth() - 7);
  d.setDate(d.getDate() - 3);
  return d.toISOString();
}

let update: ((v: Record<string, unknown>) => void) | null = null;
let feedings: FeedingEntry[] = [];
function Probe() {
  const app = useAppState();
  update = app.updateProfile as unknown as (v: Record<string, unknown>) => void;
  feedings = app.state.baby.feedingLog;
  return null;
}

const text = (r: Awaited<ReturnType<typeof renderScreen>>) => visibleText(r.root).join(" | ");

describe("faqja e recetës", () => {
  beforeEach(() => setParams({ slug: "kos-me-fruta-te-stines" }));

  it("paralajmëron kur fëmija ka alergji ndaj një përbërësi", async () => {
    const r = await renderScreen(<><RecipeDetail /><Probe /></>);
    expect(text(r)).not.toMatch(/Kujdes: përmban/);
    await act(async () => update!({ babyName: "Ana", allergies: "Alergji nga qumështi i lopës" }));
    expect(text(r)).toMatch(/Kujdes: përmban qumësht\. Te profili ke shënuar këtë alergji\./);
  });

  it("“Me gjithë familjen” shumëzon sasitë", async () => {
    const r = await renderScreen(<RecipeDetail />);
    expect(text(r)).toMatch(/120 g kos i plotë pa sheqer/);
    await act(async () => button(r.root, "Me gjithë familjen").props.onPress());
    expect(text(r)).toMatch(/360 g kos i plotë pa sheqer/);
    await act(async () => button(r.root, "Porcion bebe").props.onPress());
    expect(text(r)).toMatch(/120 g kos i plotë pa sheqer/);
  });

  it("“Shëno si ushqim” e shënon si ushqim të ngurtë dhe ruan si i pëlqeu", async () => {
    const r = await renderScreen(<><RecipeDetail /><Probe /></>);
    const before = feedings.length;
    await act(async () => button(r.root, "Shëno si ushqim").props.onPress());
    expect(feedings.length).toBe(before + 1);
    const entry = feedings.find((f) => f.foodCategory === "Kos me fruta të stinës")!;
    expect(entry.type).toBe("solid");
    expect(text(r)).toMatch(/Si i pëlqeu\?/);
    await act(async () => button(r.root, "E hëngri të gjithë").props.onPress());
    expect(feedings.find((f) => f.id === entry.id)?.note).toBe("😋 E hëngri të gjithë");
  });

  it("kur e refuzon, del butë që të provohet sërish", async () => {
    const r = await renderScreen(<><RecipeDetail /><Probe /></>);
    await act(async () => button(r.root, "Shëno si ushqim").props.onPress());
    await act(async () => button(r.root, "E refuzoi").props.onPress());
    expect(text(r)).toMatch(/S'ka gjë, është normale/);
    expect(text(r)).toMatch(/Provoje sërish pas disa ditësh/);
  });

  it("udhëzimi “jo këshillë mjekësore” del një herë", async () => {
    const r = await renderScreen(<RecipeDetail />);
    expect(visibleText(r.root).filter((t) => /jo këshillë mjekësore/.test(t))).toHaveLength(1);
  });
});

describe("lista e recetave", () => {
  it("mosha vendoset vetë nga fëmija aktiv dhe receta për 12 muaj s'del te 7 muajshi", async () => {
    const r = await renderScreen(<><RecipesLibrary /><Probe /></>);
    await act(async () => update!({ babyName: "Ana", babyDob: sevenMonthsAgo() }));
    expect(text(r)).toMatch(/Për Ana, 6–8 muaj/);
    expect(text(r)).toMatch(/Receta e ditës/);
    expect(text(r)).not.toMatch(/Tavë kosi për bebe/);
    await act(async () => button(r.root, "Të gjitha moshat").props.onPress());
    expect(text(r)).toMatch(/Tavë kosi për bebe/);
  });

  it("kërkimi gjen sipas përbërësit, edhe pa ë", async () => {
    const r = await renderScreen(<RecipesLibrary />);
    const input = r.root.findAll((n) => n.props.placeholder === "Kërko recetë ose përbërës (kungull, pulë…)" && typeof n.props.onChangeText === "function")[0];
    await act(async () => input.props.onChangeText("pule"));
    expect(text(r)).toMatch(/Pulë me oriz dhe karotë/);
    expect(text(r)).not.toMatch(/Avokado e shtypur me banane/);
  });
});
