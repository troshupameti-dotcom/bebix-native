import { act } from "react-test-renderer";
import { fakeSupabase, renderScreen, visibleText } from "./helpers/screen";
import MealPlanScreen from "@/app/(main)/baby/recipes/plan";
import { __resetMealPlanForTests, setPlanSlots } from "@/lib/recipes/mealPlan";
import { __resetFoodTriesForTests } from "@/lib/recipes/foodTries";
import { clearHouseholdCache } from "@/lib/baby/household";

/**
 * Plani i javës te familja, me prindin e kyçur: në një telefon të ri plani vjen nga Supabase (s'humbet kur ndërrohet
 * telefoni) dhe çdo ndryshim dërgohet te `meal_plan_slots`. Skedar më vete: llogaria e kyçur lexohet një herë për skedar.
 */
const NOW = new Date(2026, 10, 16, 9, 0);
const text = (r: Awaited<ReturnType<typeof renderScreen>>) => visibleText(r.root).join(" | ");
const settle = () => act(async () => { for (let i = 0; i < 6; i++) await new Promise((ok) => setTimeout(ok, 5)); });

beforeAll(() => {
  jest.useFakeTimers({
    now: NOW,
    doNotFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "setImmediate", "clearImmediate", "nextTick", "queueMicrotask", "requestAnimationFrame", "cancelAnimationFrame", "requestIdleCallback", "cancelIdleCallback", "performance", "hrtime"],
  });
});
afterAll(() => jest.useRealTimers());
beforeEach(() => {
  __resetMealPlanForTests();
  __resetFoodTriesForTests();
  clearHouseholdCache();
});

describe("plani i familjes", () => {
  it("telefoni i ri merr planin e familjes, dhe ndryshimi i prindit dërgohet te Supabase", async () => {
    const fake = fakeSupabase();
    fake.session = { user: { id: "dad" } };
    fake.rpc.my_household_role = () => "parent";
    fake.tables.baby_household_members = { owner_id: "mom" };
    fake.tables.meal_plan_slots = [{ plan_date: "2026-11-18", meal: "dinner", recipe_slug: "supe-perimesh-e-bluar", updated_at: "2026-11-15T10:00:00.000Z" }];
    const r = await renderScreen(<MealPlanScreen />);
    await settle();
    expect(text(r)).toMatch(/E mërkurë, 18 nëntor \| Mëngjes \| Shto \| Drekë \| Shto \| Darkë \| Supë perimesh e bluar/);
    expect(text(r)).toMatch(/Plotëso javën për mua/);

    const before = fake.calls.filter((c) => c.name === "meal_plan_slots").length;
    await act(async () => setPlanSlots([{ day: "2026-11-19", meal: "lunch", recipeSlug: "karote-dhe-patate-ne-avull" }]));
    await settle();
    // Një "upsert" dhe një lexim i ri.
    expect(fake.calls.filter((c) => c.name === "meal_plan_slots").length).toBeGreaterThanOrEqual(before + 2);
    expect(text(r)).toMatch(/E enjte, 19 nëntor \| Mëngjes \| Shto \| Drekë \| Karotë dhe patate në avull/);
  });
});
