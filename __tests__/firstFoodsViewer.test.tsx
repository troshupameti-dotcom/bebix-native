import { act } from "react-test-renderer";
import { fakeSupabase, renderScreen, setParams, visibleText } from "./helpers/screen";
import FirstFoods from "@/app/(main)/baby/recipes/foods";
import FoodDetail from "@/app/(main)/baby/recipes/food/[key]";
import { __resetFoodTriesForTests } from "@/lib/recipes/foodTries";
import { __resetFoodsForTests } from "@/lib/recipes/foods";
import { clearHouseholdCache } from "@/lib/baby/household";

/**
 * Gjyshërit (viewer) te Ushqimet e para: shohin udhëzuesin; provat dhe reagimet vetëm kur prindërit ndezin
 * "Gjyshërit shohin edhe kujdesin"; s'shënojnë kurrë. Skedar më vete: llogaria e kyçur lexohet një herë për skedar.
 */
const text = (r: Awaited<ReturnType<typeof renderScreen>>) => visibleText(r.root).join(" | ");
const settle = () => act(async () => { for (let i = 0; i < 6; i++) await new Promise((ok) => setTimeout(ok, 5)); });

beforeEach(() => {
  __resetFoodTriesForTests();
  __resetFoodsForTests();
  clearHouseholdCache();
});

describe("gjyshërit", () => {
  const row = { id: "x1", food_key: "banana", tried_at: "2026-11-02T08:00:00.000Z", liking: "all", reaction: false, symptoms: [], note: "", recipe_slug: null, created_at: "2026-11-02T08:00:00.000Z", updated_at: "2026-11-02T08:00:00.000Z", deleted_at: null };
  const asGrandma = (share: boolean) => {
    const fake = fakeSupabase();
    fake.session = { user: { id: "granny" } };
    fake.rpc.my_household_role = () => "viewer";
    fake.tables.baby_household_members = { owner_id: "mom" };
    fake.tables.household_settings = { share_care_with_viewers: share };
    fake.tables.food_tries = [row];
  };

  it("pa lejen e prindërve shohin udhëzuesin, por jo provat, dhe s'shënojnë", async () => {
    asGrandma(false);
    const r = await renderScreen(<FirstFoods />);
    await settle();
    expect(text(r)).toMatch(/Provat dhe reagimet i shohin prindërit/);
    expect(text(r)).not.toMatch(/ushqime të provuara|ushqim i provuar/);
    expect(text(r)).not.toMatch(/1 herë/);
    setParams({ key: "banana" });
    const d = await renderScreen(<FoodDetail />);
    await settle();
    expect(text(d)).toMatch(/Si ta servirësh sipas moshës/);
    expect(text(d)).not.toMatch(/Shëno provën|E provoi/);
  });

  it("me “Gjyshërit shohin edhe kujdesin” shohin provat, por prapë s'shënojnë", async () => {
    asGrandma(true);
    const r = await renderScreen(<FirstFoods />);
    await settle();
    expect(text(r)).toMatch(/1 \| ushqim i provuar/);
    setParams({ key: "banana" });
    const d = await renderScreen(<FoodDetail />);
    await settle();
    expect(text(d)).toMatch(/E provoi 1 herë/);
    expect(text(d)).not.toMatch(/Shëno provën/);
    expect(text(d)).not.toMatch(/\| Hiq \|/);
  });
});
