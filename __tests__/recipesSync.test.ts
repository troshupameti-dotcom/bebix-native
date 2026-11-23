import AsyncStorage from "@react-native-async-storage/async-storage";
import { __resetRecipesForTests, loadRecipes, mergeRecipes, parseCache } from "@/lib/recipes/api";
import type { Recipe } from "@/lib/recipes/types";

type Op = [string, unknown[]];
type ServerRow = { slug: string; title: string; status: string; updated_at: string; steps: string[]; ingredients: unknown[]; sort_order: number };

const mockServer: { rows: ServerRow[]; calls: Op[][] } = { rows: [], calls: [] };

// eslint-disable-next-line @typescript-eslint/no-require-imports
jest.mock("@react-native-async-storage/async-storage", () => require("@react-native-async-storage/async-storage/jest/async-storage-mock"));

/** Supabase i rremë: përgjigjet sipas zinxhirit (select, gte, head, limit), si PostgREST. */
jest.mock("@/lib/supabase/client", () => {
  const respond = (ops: Op[]) => {
    const select = ops.find(([n]) => n === "select");
    const cols = String(select?.[1][0] ?? "");
    const head = (select?.[1][1] as { head?: boolean } | undefined)?.head;
    const gte = ops.find(([n]) => n === "gte");
    const range = ops.find(([n]) => n === "range");
    let rows = mockServer.rows.filter((r) => r.status === "published");
    if (head) return { data: null, error: null, count: rows.length };
    if (cols === "updated_at") {
      const top = [...rows].sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1))[0];
      return { data: top ? [{ updated_at: top.updated_at }] : [], error: null };
    }
    if (gte) rows = rows.filter((r) => r.updated_at >= String(gte[1][1]));
    if (range) rows = rows.slice(Number(range[1][0]), Number(range[1][1]) + 1);
    if (cols === "slug") return { data: rows.map((r) => ({ slug: r.slug })), error: null };
    return { data: rows, error: null };
  };
  const builder = (ops: Op[]): unknown =>
    new Proxy(
      {},
      {
        get: (_t, prop: string) => {
          if (prop === "then") return (ok: (v: unknown) => unknown) => Promise.resolve(respond(ops)).then(ok);
          return (...args: unknown[]) => {
            ops.push([prop, args]);
            return builder(ops);
          };
        },
      },
    );
  return {
    supabase: {
      from: () => {
        const ops: Op[] = [];
        mockServer.calls.push(ops);
        return builder(ops);
      },
    },
  };
});

const row = (slug: string, updated: string, title = slug): ServerRow => ({
  slug,
  title,
  status: "published",
  updated_at: updated,
  steps: ["Përziej."],
  ingredients: [{ name: "kungull", amount: 100, unit: "g", food_key: "pumpkin" }],
  sort_order: 10,
});

/** Sa kërkesa morën receta të plota (me përbërës), jo vetëm numrin ose slug-et. */
const fullFetches = () => mockServer.calls.filter((ops) => ops.some(([n, a]) => n === "select" && String(a[0]).includes("ingredients"))).length;

beforeEach(async () => {
  await AsyncStorage.clear();
  __resetRecipesForTests();
  mockServer.rows = [row("a", "2026-11-01T10:00:00Z"), row("b", "2026-11-02T10:00:00Z"), row("c", "2026-11-03T10:00:00Z")];
  mockServer.calls = [];
});

describe("recetat: shkarkohen vetëm ndryshimet", () => {
  it("hapja e parë merr gjithçka; e dyta, pa ndryshime, s'shkarkon asnjë recetë", async () => {
    const first = await loadRecipes();
    expect(first.recipes.map((r) => r.slug).sort()).toEqual(["a", "b", "c"]);
    expect(fullFetches()).toBe(1);

    mockServer.calls = [];
    const second = await loadRecipes();
    expect(second.recipes).toHaveLength(3);
    expect(fullFetches()).toBe(0);
  });

  it("një recetë e ndryshuar dhe një e re: merren vetëm ato", async () => {
    await loadRecipes();
    mockServer.rows[1] = row("b", "2026-11-05T10:00:00Z", "B e re");
    mockServer.rows.push(row("d", "2026-11-06T10:00:00Z"));
    mockServer.calls = [];
    const next = await loadRecipes();
    expect(next.recipes.find((r) => r.slug === "b")?.title).toBe("B e re");
    expect(next.recipes.map((r) => r.slug).sort()).toEqual(["a", "b", "c", "d"]);
    // Kërkesa e plotë ishte vetëm për të ndryshuarat (me gte), jo për gjithë listën.
    const withRecipes = mockServer.calls.filter((ops) => ops.some(([n, a]) => n === "select" && String(a[0]).includes("ingredients")));
    expect(withRecipes.every((ops) => ops.some(([n]) => n === "gte"))).toBe(true);
  });

  it("një recetë e hequr nga publikimi zhduket edhe nga telefoni", async () => {
    await loadRecipes();
    mockServer.rows[0] = { ...mockServer.rows[0], status: "draft", updated_at: "2026-11-07T10:00:00Z" };
    const next = await loadRecipes();
    expect(next.recipes.map((r) => r.slug).sort()).toEqual(["b", "c"]);
  });

  it("pa rrjet: kopja e ruajtur", async () => {
    await loadRecipes();
    mockServer.rows = [];
    // Serveri bosh do të thotë 0 receta, por kopja s'zëvendësohet me listë bosh.
    const next = await loadRecipes();
    expect(next.recipes.length).toBeGreaterThan(0);
  });

  it("bashkimi dhe kopja e formatit të vjetër", () => {
    const r = (slug: string) => ({ slug, ingredients: [{}], steps: ["x"] }) as unknown as Recipe;
    expect(mergeRecipes([r("a"), r("b")], [r("c")], null).map((x) => x.slug)).toEqual(["a", "b", "c"]);
    expect(mergeRecipes([r("a"), r("b")], [], new Set(["b"])).map((x) => x.slug)).toEqual(["b"]);
    expect(parseCache([r("a")])).toMatchObject({ count: null, maxUpdatedAt: null, slugs: [] });
    expect(parseCache(null)).toBeNull();
  });
});
