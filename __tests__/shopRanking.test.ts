/**
 * Dyqani sipas moshës (faza 2): radha vjen nga serveri (`shop_product_order`), produktet vihen në atë radhë dhe
 * asgjë s'fshihet; kur serveri s'e ka ende funksionin, dyqani punon si më parë.
 */
type Call = { kind: "rpc" | "from"; name: string; args?: Record<string, unknown>; ops: [string, unknown[]][] };
const mockCalls: Call[] = [];
let mockRpc: { data: unknown; error: unknown } = { data: [], error: null };
let mockRows: unknown[] = [];

jest.mock("@/lib/supabase/client", () => {
  const builder = (call: Call, result: () => unknown): unknown =>
    new Proxy(
      {},
      {
        get: (_t, prop: string) => {
          if (prop === "then") return (ok: (v: unknown) => unknown) => Promise.resolve(result()).then(ok);
          return (...args: unknown[]) => {
            call.ops.push([prop, args]);
            return builder(call, result);
          };
        },
      }
    );
  return {
    supabase: {
      rpc: (name: string, args: Record<string, unknown>) => {
        const call: Call = { kind: "rpc", name, args, ops: [] };
        mockCalls.push(call);
        return builder(call, () => mockRpc);
      },
      from: (name: string) => {
        const call: Call = { kind: "from", name, ops: [] };
        mockCalls.push(call);
        return builder(call, () => ({ data: mockRows, error: null, count: mockRows.length }));
      },
    },
  };
});

const row = (id: string, name: string) => ({
  id, name, price: 10, compare_at_price: null, image_url: null, accent: null, rating: 0, review_count: 0, badge: null,
  stock: 5, free_delivery: false, merchant_name: null, min_age_months: null, max_age_months: null, brands: { name: "M" },
  categories: { key: "Ushqyerje", icon: "x" },
});

/** Modul i ri për çdo test (kujtesa "funksioni mungon" s'kalon nga një test te tjetri). */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const load = (): typeof import("@/lib/shopData") => require("@/lib/shopData");

beforeEach(() => {
  mockCalls.length = 0;
  jest.resetModules();
});

describe("dyqani sipas moshës", () => {
  it("produktet vihen në radhën e serverit; numri total dhe faqja tjetër nga serveri", async () => {
    mockRpc = { data: [{ product_id: "p2", pos: 1, total_count: 5 }, { product_id: "p1", pos: 2, total_count: 5 }], error: null };
    mockRows = [row("p1", "Një"), row("p2", "Dy")];
    const { fetchProductPage } = load();
    const page = await fetchProductPage({ ranking: { ageFrom: 8, ageTo: 8, pregnancy: false }, search: "bi(b)" });
    expect(page.items.map((p) => p.id)).toEqual(["p2", "p1"]);
    expect(page.total).toBe(5);
    expect(page.hasMore).toBe(true);
    const rpc = mockCalls.find((c) => c.kind === "rpc");
    expect(rpc?.args).toMatchObject({ p_age_from: 8, p_age_to: 8, p_pregnancy: false, p_search: "bi b", p_offset: 0 });
  });

  it("çipi i grupmoshës rendit (s'filtron): kalon si moshë renditjeje", async () => {
    mockRpc = { data: [], error: null };
    const { fetchProductPage } = load();
    await fetchProductPage({ age: { key: "6-12", from: 6, to: 12 } });
    expect(mockCalls.find((c) => c.kind === "rpc")?.args).toMatchObject({ p_age_from: 6, p_age_to: 12 });
    expect(mockCalls.some((c) => c.kind === "from" && c.ops.some(([op]) => op === "or"))).toBe(false);
  });

  it("serveri pa funksionin e renditjes: rruga e vjetër, dhe s'e pyet më", async () => {
    mockRpc = { data: null, error: { code: "PGRST202", message: "Could not find the function" } };
    mockRows = [row("p1", "Një")];
    const { fetchProductPage } = load();
    const page = await fetchProductPage({ ranking: { ageFrom: 8, ageTo: 8, pregnancy: false } });
    expect(page.items.map((p) => p.id)).toEqual(["p1"]);
    await fetchProductPage({});
    expect(mockCalls.filter((c) => c.kind === "rpc")).toHaveLength(1);
  });
});
