import { act, type ReactTestInstance } from "react-test-renderer";
import { fakeSupabase, renderScreen, visibleText } from "./helpers/screen";
import MealPlanScreen from "@/app/(main)/baby/recipes/plan";
import { __resetMealPlanForTests } from "@/lib/recipes/mealPlan";
import { __resetFoodTriesForTests } from "@/lib/recipes/foodTries";
import { clearHouseholdCache } from "@/lib/baby/household";

/**
 * Gjyshërit (viewer) te "Plani i javës": e shohin planin e familjes, por s'e plotësojnë, s'e ndërrojnë dhe s'shtojnë.
 * Skedar më vete: llogaria e kyçur lexohet një herë për skedar.
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

it("gjyshja e sheh planin, por pa “Plotëso”, pa “Shto” dhe pa ndërrim me prekje të gjatë", async () => {
  const fake = fakeSupabase();
  fake.session = { user: { id: "granny" } };
  fake.rpc.my_household_role = () => "viewer";
  fake.tables.baby_household_members = { owner_id: "mom" };
  fake.tables.household_settings = { share_care_with_viewers: false };
  fake.tables.meal_plan_slots = [{ plan_date: "2026-11-17", meal: "lunch", recipe_slug: "supe-perimesh-e-bluar", updated_at: "2026-11-15T10:00:00.000Z" }];
  const r = await renderScreen(<MealPlanScreen />);
  await settle();
  expect(text(r)).toMatch(/Ky është plani i familjes\. E ndryshojnë prindërit/);
  expect(text(r)).toMatch(/E martë, 17 nëntor \| Mëngjes \| — \| Drekë \| Supë perimesh e bluar/);
  expect(text(r)).not.toMatch(/Plotëso javën për mua|Provo diçka të re|\| Shto \|/);
  const slot = r.root.findAll((n: ReactTestInstance) => n.props.accessibilityLabel === "Drekë: Supë perimesh e bluar" && typeof n.props.onLongPress === "function")[0];
  await act(async () => slot.props.onLongPress());
  expect(text(r)).not.toMatch(/Hiqe nga plani/);
});
