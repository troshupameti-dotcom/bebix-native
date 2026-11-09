import { useEffect } from "react";
import { act } from "react-test-renderer";
import { button, renderScreen, setParams, visibleText } from "./helpers/screen";
import FirstFoods from "@/app/(main)/baby/recipes/foods";
import FoodDetail from "@/app/(main)/baby/recipes/food/[key]";
import AllergenPlan from "@/app/(main)/baby/recipes/allergens";
import RecipeDetail from "@/app/(main)/baby/recipes/[slug]";
import { useAppState } from "@/lib/state/AppStateContext";
import { __resetFoodTriesForTests, addFoodTry, useFoodTries } from "@/lib/recipes/foodTries";
import { __resetFoodsForTests } from "@/lib/recipes/foods";
import { clearHouseholdCache } from "@/lib/baby/household";
import type { FoodTry } from "@/lib/recipes/types";

/** Çfarë sheh app-i pas çdo veprimi: alergjitë e profilit dhe provat e fëmijës. */
const seen: { allergies: string; tries: FoodTry[] } = { allergies: "", tries: [] };
function Probe() {
  const app = useAppState();
  const { tries } = useFoodTries();
  const allergies = app.state.profile.allergies;
  useEffect(() => {
    seen.allergies = allergies;
    seen.tries = tries;
  });
  return null;
}

const text = (r: Awaited<ReturnType<typeof renderScreen>>) => visibleText(r.root).join(" | ");

beforeEach(() => {
  __resetFoodTriesForTests();
  __resetFoodsForTests();
  clearHouseholdCache();
});

describe("Ushqimet e para", () => {
  it("numëruesi rritet me çdo ushqim të ri të provuar, jo me çdo provë", async () => {
    const r = await renderScreen(<FirstFoods />);
    expect(text(r)).toMatch(/0 \| ushqime të provuara/);
    await act(async () => {
      addFoodTry({ foodKey: "banana", liking: "all" });
      addFoodTry({ foodKey: "banana" });
    });
    expect(text(r)).toMatch(/1 \| ushqim i provuar/);
    expect(text(r)).toMatch(/Banane \| 2 herë 😋/);
    await act(async () => void addFoodTry({ foodKey: "egg" }));
    expect(text(r)).toMatch(/2 \| ushqime të provuara/);
  });

  it("kur e refuzon: “E provoi 1 herë”, mesazhi i butë dhe një recetë tjetër me të njëjtin ushqim", async () => {
    setParams({ key: "carrot" });
    const r = await renderScreen(<FoodDetail />);
    expect(text(r)).toMatch(/Ende pa provuar/);
    await act(async () => button(r.root, "Shëno provën").props.onPress());
    await act(async () => button(r.root, "E refuzoi").props.onPress());
    await act(async () => button(r.root, "Ruaj provën").props.onPress());
    expect(text(r)).toMatch(/E provoi 1 herë/);
    expect(text(r)).toMatch(/Provoje sërish pas disa ditësh, në formë tjetër/);
    expect(text(r)).toMatch(/Shumë fëmijë e pranojnë një ushqim pas 8–15 provash/);
    expect(text(r)).toMatch(/Një ide tjetër me këtë ushqim:/);
  });

  it("“Pati reagim”: shenjat dhe 112; te alergjitë e profilit shkruhet vetëm pas konfirmimit", async () => {
    setParams({ key: "egg" });
    const r = await renderScreen(<><FoodDetail /><Probe /></>);
    await act(async () => button(r.root, "Shëno provën").props.onPress());
    await act(async () => button(r.root, "Po, pati").props.onPress());
    await act(async () => button(r.root, "Skuqje ose puçrra").props.onPress());
    expect(text(r)).toMatch(/Thirr pediatrin; për vështirësi frymëmarrjeje thirr 112\./);
    await act(async () => button(r.root, "Shtoje te alergjitë e profilit").props.onPress());
    expect(text(r)).toMatch(/Ta shtoj “vezë” te alergjitë e profilit\?/);
    expect(seen.allergies).toBe("");
    await act(async () => button(r.root, "Jo tani").props.onPress());
    expect(seen.allergies).toBe("");
    await act(async () => button(r.root, "Shtoje te alergjitë e profilit").props.onPress());
    await act(async () => button(r.root, "Po, shtoje").props.onPress());
    expect(seen.allergies).toMatch(/^vezë \(reagim më /);
    await act(async () => button(r.root, "Ruaj provën").props.onPress());
    expect(seen.tries[0]).toMatchObject({ foodKey: "egg", reaction: true, symptoms: ["rash"] });
  });

  it("plani: pas 3 provave pa reagim “I prezantuar ✓”; një reagim e ndal; prova e radhës me sasinë e saj", async () => {
    const r = await renderScreen(<AllergenPlan />);
    expect(text(r)).toMatch(/Vezë \| Pa filluar/);
    await act(async () => void addFoodTry({ foodKey: "egg" }));
    expect(text(r)).toMatch(/Vezë \| Prova 1 nga 3/);
    expect(text(r)).toMatch(/Shëno provën 2/);
    await act(async () => {
      addFoodTry({ foodKey: "egg" });
      addFoodTry({ foodKey: "egg" });
      addFoodTry({ foodKey: "peanut_butter", reaction: true, symptoms: ["swelling"] });
    });
    expect(text(r)).toMatch(/Vezë \| I prezantuar ✓/);
    expect(text(r)).toMatch(/Mbaje në menu 1–2 herë në javë\./);
    expect(text(r)).toMatch(/Kikirik \| Pati reagim/);
    expect(text(r)).toMatch(/Para se ta provosh sërish, fol me pediatrin\./);
    await act(async () => button(r.root, "Shëno provën 1").props.onPress());
    expect(text(r)).toMatch(/Prova 1 nga 3: 1 lugë çaji/);
  });

  it("“Shëno si ushqim” te receta i shënon ushqimet e saj si të provuara, dhe pyet për reagim kur ka alergjen", async () => {
    setParams({ slug: "kos-me-fruta-te-stines" });
    const r = await renderScreen(<><RecipeDetail /><Probe /></>);
    await act(async () => button(r.root, "Shëno si ushqim").props.onPress());
    expect(seen.tries.some((x) => x.foodKey === "yogurt" && x.recipeSlug === "kos-me-fruta-te-stines")).toBe(true);
    await act(async () => button(r.root, "E hëngri të gjithë").props.onPress());
    expect(seen.tries.find((x) => x.foodKey === "yogurt")?.liking).toBe("all");
    expect(text(r)).toMatch(/Pati reagim\?/);
    await act(async () => button(r.root, "Po, pati").props.onPress());
    await act(async () => button(r.root, "Ruaje").props.onPress());
    expect(seen.tries.find((x) => x.foodKey === "yogurt")?.reaction).toBe(true);
    expect(text(r)).toMatch(/Thirr pediatrin/);
    expect(seen.allergies).toBe("");
  });
});
