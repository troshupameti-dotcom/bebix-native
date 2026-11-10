import { useEffect } from "react";
import { Linking } from "react-native";
import { act, type ReactTestInstance } from "react-test-renderer";
import { button, fakeSupabase, renderScreen, router, setParams, visibleText } from "./helpers/screen";
import MealPlanScreen from "@/app/(main)/baby/recipes/plan";
import ShoppingListScreen from "@/app/(main)/baby/recipes/shopping";
import FreezerDayScreen from "@/app/(main)/baby/recipes/freezer";
import RecipeDetail from "@/app/(main)/baby/recipes/[slug]";
import { useAppState } from "@/lib/state/AppStateContext";
import { __resetMealPlanForTests, setPlanSlots, useMealPlan } from "@/lib/recipes/mealPlan";
import { __resetFoodTriesForTests } from "@/lib/recipes/foodTries";
import { __resetFoodsForTests } from "@/lib/recipes/foods";
import { __resetRecipeToolsForTests } from "@/lib/recipes/tools";
import { BUNDLED_RECIPES } from "@/lib/recipes/api";
import { clearHouseholdCache } from "@/lib/baby/household";
import { weekDays, type PlanMap } from "@/lib/recipes/planner";
import { MEAL_TYPES } from "@/lib/recipes/types";

/** Sot është e hënë, 16 nëntor 2026, ora 9 (vetëm data; kohëmatësit mbeten të vërtetë). */
const NOW = new Date(2026, 10, 16, 9, 0);
const WEEK = weekDays("2026-11-16");
const bySlug = new Map(BUNDLED_RECIPES.map((r) => [r.slug, r]));

const seen: { plan: PlanMap; update: ((v: Record<string, unknown>) => void) | null } = { plan: {}, update: null };
function Probe() {
  const app = useAppState();
  const { plan } = useMealPlan();
  useEffect(() => {
    seen.plan = plan;
    seen.update = app.updateProfile as unknown as (v: Record<string, unknown>) => void;
  });
  return null;
}

const text = (r: Awaited<ReturnType<typeof renderScreen>>) => visibleText(r.root).join(" | ");
const byLabel = (root: ReactTestInstance, label: string) => {
  const hits = root.findAll((n) => n.props.accessibilityLabel === label && typeof n.props.onLongPress === "function");
  if (!hits.length) throw new Error(`S'u gjet vakti "${label}"`);
  return hits[0];
};
const pressStarting = async (root: ReactTestInstance, start: string) => {
  const hits = root.findAll((n) => typeof n.props.onPress === "function" && visibleText(n).some((x) => x.startsWith(start)), { deep: false });
  if (!hits.length) throw new Error(`S'u gjet butoni "${start}…"`);
  await act(async () => hits[hits.length - 1].props.onPress());
};
const monthsAgo = (m: number) => {
  const d = new Date(NOW);
  d.setMonth(d.getMonth() - m);
  d.setDate(d.getDate() - 3);
  return d.toISOString();
};
const countUses = (plan: PlanMap) => {
  const m = new Map<string, number>();
  Object.values(plan).forEach((s) => s && m.set(s, (m.get(s) ?? 0) + 1));
  return m;
};

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
  __resetFoodsForTests();
  __resetRecipeToolsForTests();
  clearHouseholdCache();
  seen.plan = {};
});

describe("Plani i javës", () => {
  it("“Plotëso javën për mua”: 7 ditë × 4 vakte, asnjë recetë më shumë se 2 herë, hekur çdo ditë, vetëm të moshës", async () => {
    const r = await renderScreen(<><MealPlanScreen /><Probe /></>);
    await act(async () => seen.update!({ babyName: "Ana", babyDob: monthsAgo(20) }));
    await act(async () => button(r.root, "Plotëso javën për mua").props.onPress());
    expect(text(r)).toMatch(/U plotësuan 28 vakte\./);
    expect(Object.keys(seen.plan)).toHaveLength(28);
    expect(Math.max(...countUses(seen.plan).values())).toBeLessThanOrEqual(2);
    for (const day of WEEK) {
      const recipes = MEAL_TYPES.map((m) => bySlug.get(seen.plan[`${day}:${m}`]!)!);
      expect(recipes.some((x) => x.nutrients.includes("iron"))).toBe(true);
      expect(recipes.every((x) => x.ageMinMonths <= 20 && x.ageMaxMonths >= 20)).toBe(true);
    }
    // Plotësimi i dytë s'prek asgjë: s'ka më vakte bosh.
    const before = { ...seen.plan };
    await act(async () => button(r.root, "Plotëso javën për mua").props.onPress());
    expect(seen.plan).toEqual(before);
    expect(text(r)).toMatch(/S'kishte vakte bosh për t'u plotësuar\./);
  });

  it("prekja e gjatë e ndërron vaktin dhe “Hiqe nga plani” e heq; prekja e shkurtër hap recetën", async () => {
    const first = bySlug.get("karote-dhe-patate-ne-avull")!;
    const other = bySlug.get("supe-perimesh-e-bluar")!;
    const r = await renderScreen(<><MealPlanScreen /><Probe /></>);
    await act(async () => setPlanSlots([{ day: "2026-11-17", meal: "lunch", recipeSlug: first.slug }]));
    const nav = router();
    await act(async () => byLabel(r.root, `Drekë: ${first.title}`).props.onPress());
    expect(nav.push).toHaveBeenCalledWith({ pathname: "/(main)/baby/recipes/[slug]", params: { slug: first.slug } });

    await act(async () => byLabel(r.root, `Drekë: ${first.title}`).props.onLongPress());
    expect(text(r)).toMatch(/Drekë · E martë, 17 nëntor/);
    // Rreshti i recetës te dritarja (butoni i vërtetë brenda `RecipeRow`).
    const row = r.root.findAll((n) => n.props.accessibilityLabel === other.title && n.props.accessibilityRole === "button" && typeof n.props.onPress === "function");
    await act(async () => row[row.length - 1].props.onPress());
    expect(seen.plan["2026-11-17:lunch"]).toBe(other.slug);

    await act(async () => byLabel(r.root, `Drekë: ${other.title}`).props.onLongPress());
    await act(async () => button(r.root, "Hiqe nga plani").props.onPress());
    expect(seen.plan["2026-11-17:lunch"]).toBeUndefined();
  });

  it("“Provo diçka të re ✨”: një recetë me një ushqim të paprovuar, e vendosur te vakti i parë bosh i sotëm", async () => {
    const r = await renderScreen(<><MealPlanScreen /><Probe /></>);
    await act(async () => seen.update!({ babyName: "Ana", babyDob: monthsAgo(10) }));
    await act(async () => button(r.root, "Provo diçka të re ✨").props.onPress());
    expect(text(r)).toMatch(/Ushqim i ri: /);
    await pressStarting(r.root, "Shtoje në plan: Sot · ");
    const entries = Object.entries(seen.plan);
    expect(entries).toHaveLength(1);
    const [key, slug] = entries[0];
    expect(key.startsWith("2026-11-16:")).toBe(true);
    const recipe = bySlug.get(slug!)!;
    expect(recipe.ageMinMonths).toBeLessThanOrEqual(10);
    expect(recipe.allergens).toEqual([]);
  });
});

describe("Lista e blerjeve", () => {
  it("bashkon karotat e tri recetave (2 + 2 + 1 = 5 copë), ✓ kur blihet, dhe “Ndaje” i dërgon në WhatsApp vetëm ato që mbeten", async () => {
    setParams({ week: "2026-11-16" });
    const open = jest.spyOn(Linking, "openURL").mockResolvedValue(undefined);
    const r = await renderScreen(<ShoppingListScreen />);
    await act(async () =>
      setPlanSlots([
        { day: "2026-11-16", meal: "lunch", recipeSlug: "karote-dhe-patate-ne-avull" },
        { day: "2026-11-17", meal: "dinner", recipeSlug: "gulash-i-bute-me-vic-dhe-perime" },
        { day: "2026-11-18", meal: "lunch", recipeSlug: "thjerreza-te-kuqe-me-karote" },
      ])
    );
    expect(text(r)).toMatch(/Perime/);
    expect(text(r)).toMatch(/Karotë \| [^|]+ \| 5 copë/);
    expect(text(r)).not.toMatch(/\| Ujë/);
    const total = Number(/0?(\d+) nga (\d+) për t'u blerë/.exec(text(r))![2]);
    const carrot = r.root.findAll((n) => n.props.accessibilityRole === "checkbox" && /^Karotë, /.test(n.props.accessibilityLabel ?? ""))[0];
    await act(async () => carrot.props.onPress());
    expect(text(r)).toMatch(new RegExp(`${total - 1} nga ${total} për t'u blerë`));
    await act(async () => button(r.root, "Ndaje në WhatsApp").props.onPress());
    const url = String(open.mock.calls[0][0]);
    expect(url.startsWith("https://wa.me/?text=")).toBe(true);
    const shared = decodeURIComponent(url.slice("https://wa.me/?text=".length));
    expect(shared).toMatch(/^🛒 Lista e blerjeve · 16–22 nëntor/);
    expect(shared).toMatch(/\nPerime\n/);
    expect(shared).not.toMatch(/Karotë/);
    expect(shared).toMatch(/• Patate: /);
    open.mockRestore();
  });

  it("pa receta në plan: mesazh i qartë, pa listë", async () => {
    setParams({ week: "2026-11-16" });
    const r = await renderScreen(<ShoppingListScreen />);
    expect(text(r)).toMatch(/Lista është bosh/);
  });
});

describe("Ditë gatimi për ngrirje", () => {
  it("“Gatuaj të dielën, mjafton për 5 ditë”: 3 receta që ngrijnë, 5 drekat e javës tjetër, asnjë më shumë se 2 herë", async () => {
    setParams({ week: "2026-11-23" });
    const r = await renderScreen(<><FreezerDayScreen /><Probe /></>);
    await act(async () => seen.update!({ babyName: "Ana", babyDob: monthsAgo(14) }));
    expect(text(r)).toMatch(/Gatuaj të dielën, mjafton për 5 ditë\./);
    expect(text(r)).toMatch(/E diel, 22 nëntor · për 23–29 nëntor/);
    await act(async () => button(r.root, "Vendosi në plan").props.onPress());
    const keys = Object.keys(seen.plan);
    expect(keys).toHaveLength(5);
    expect(keys.every((k) => k >= "2026-11-23" && k < "2026-11-28")).toBe(true);
    const slugs = Object.values(seen.plan).map((s) => bySlug.get(s!)!);
    expect(slugs.every((x) => x.freezerFriendly)).toBe(true);
    expect(Math.max(...countUses(seen.plan).values())).toBeLessThanOrEqual(2);
  });
});

describe("Te receta", () => {
  const product = (id: string, name: string, extra: Record<string, unknown> = {}) => ({
    id, name, price: 12.5, compare_at_price: null, image_url: null, accent: "olive", rating: 5, review_count: 0, badge: null, stock: 4, free_delivery: false,
    merchant_name: null, min_age_months: 4, max_age_months: 36, brands: { name: "B" }, categories: { key: "ushqyerja", icon: "bowl" }, ...extra,
  });

  it("“Shto në plan”: zgjedh ditën dhe vaktin, dhe del te plani i familjes", async () => {
    setParams({ slug: "karote-dhe-patate-ne-avull" });
    const r = await renderScreen(<><RecipeDetail /><Probe /></>);
    await act(async () => button(r.root, "Shto në plan").props.onPress());
    await act(async () => button(r.root, "Darkë").props.onPress());
    await act(async () => button(r.root, "Shtoje").props.onPress());
    expect(seen.plan["2026-11-16:dinner"]).toBe("karote-dhe-patate-ne-avull");
    expect(text(r)).toMatch(/U shtua te plani: Sot, Darkë\./);
  });

  it("“Mjetet që të ndihmojnë”: deri në 2 produkte në stok, të moshës, sipas recetës (purè → blender, lugë)", async () => {
    fakeSupabase().tables.products = [
      product("p1", "Përparëse silikoni"),
      product("p2", "Blender me avull 4 në 1"),
      product("p3", "Lugë silikoni, 2 copë"),
      product("p4", "Biberon qetësues nate"),
      product("p5", "Tas me thithëse", { stock: 0 }),
    ];
    setParams({ slug: "karote-dhe-patate-ne-avull" });
    const r = await renderScreen(<RecipeDetail />);
    const shown = visibleText(r.root);
    const at = shown.indexOf("Mjetet që të ndihmojnë");
    expect(at).toBeGreaterThan(-1);
    expect(shown.indexOf("Blender me avull 4 në 1")).toBeGreaterThan(at);
    expect(shown.indexOf("Lugë silikoni, 2 copë")).toBeGreaterThan(shown.indexOf("Blender me avull 4 në 1"));
    expect(text(r)).not.toMatch(/Përparëse silikoni|Biberon|Tas me thithëse/);
    const nav = router();
    await act(async () => button(r.root, "Blender me avull 4 në 1").props.onPress());
    expect(nav.push).toHaveBeenCalledWith("/shop/p2", { withAnchor: true });
  });

  it("pa produkte që i përshtaten, pjesa s'del fare", async () => {
    fakeSupabase().tables.products = [product("p4", "Biberon qetësues nate"), product("p6", "Lugë për 3 vjeç", { min_age_months: 36, max_age_months: 60 })];
    setParams({ slug: "karote-dhe-patate-ne-avull" });
    const r = await renderScreen(<RecipeDetail />);
    expect(text(r)).not.toMatch(/Mjetet që të ndihmojnë/);
  });
});
