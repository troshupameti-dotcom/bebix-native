/**
 * Kategoritë te Dyqani: prekja e një kategorie e mban listën dhe shiritin e kategorive në vend (më parë lista
 * rindërtohej, kategoritë ktheheshin në fillim dhe faqja lart), dhe "mbrapa" i Android-it me kategori aktive kthen
 * te "Të gjitha", jo te kreu (16 tetor).
 */
import { fakeSupabase, renderScreen, visibleText } from "./helpers/screen";
import { act, type ReactTestInstance, type ReactTestRenderer } from "react-test-renderer";
import { BackHandler, FlatList } from "react-native";
import Shop from "@/app/(main)/shop/index";
import AsyncStorage from "@react-native-async-storage/async-storage";

jest.mock("@/components/shop/BrandMarquee", () => ({ BrandMarquee: () => null }));

const product = (id: string, category: string) => ({
  id, name: `Produkti ${id}`, price: 9.99, compare_at_price: null, image_url: null, accent: null, rating: 0, review_count: 0,
  badge: null, stock: 10, free_delivery: false, merchant_name: null, min_age_months: null, max_age_months: null,
  brands: { name: "Marka" }, categories: { key: category, icon: "shop" },
});

let handlers: (() => boolean | null | undefined)[] = [];
beforeEach(() => {
  handlers = [];
  jest.spyOn(BackHandler, "addEventListener").mockImplementation((_e, h) => {
    handlers.push(h as () => boolean);
    return { remove: () => { handlers = handlers.filter((x) => x !== h); } };
  });
  const fake = fakeSupabase();
  fake.tables.categories = [
    { id: "c1", key: "nursery", label: "Dhoma e bebit", icon: "home" },
    { id: "c2", key: "feeding", label: "Ushqyerje", icon: "spoon" },
  ];
  fake.tables.products = [product("p1", "nursery"), product("p2", "feeding")];
  fake.tables.brands = [];
  // Radha nga serveri (renditja sipas moshës); produktet lexohen pastaj nga tabela.
  fake.rpc.shop_product_order = () => [
    { product_id: "p1", pos: 1, total_count: 2 },
    { product_id: "p2", pos: 2, total_count: 2 },
  ];
});
afterEach(() => jest.restoreAllMocks());

const chip = (root: ReactTestInstance, label: string) =>
  root.findAll((n) => typeof n.props.onPress === "function" && n.props.accessibilityRole === "button" && visibleText(n).includes(label))[0];
const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 30)); });
const list = (r: ReactTestRenderer) => r.root.findByType(FlatList).instance;

describe("kategoritë te Dyqani", () => {
  it("prekja e kategorisë s'e rindërton listën (kategoritë dhe faqja mbeten në vend)", async () => {
    const r = await renderScreen(<Shop />);
    await flush();
    const before = list(r);
    await act(async () => {
      chip(r.root, "Dhoma e bebit").props.onPress();
    });
    await flush();
    expect(list(r) === before).toBe(true);
  });

  it("“mbrapa” me kategori aktive kthen te “Të gjitha”, s'del nga Dyqani", async () => {
    const r = await renderScreen(<Shop />);
    await flush();
    await act(async () => {
      chip(r.root, "Dhoma e bebit").props.onPress();
    });
    await flush();
    expect(chip(r.root, "Dhoma e bebit").props.accessibilityState).toEqual({ selected: true });
    let handled: boolean | null | undefined = false;
    await act(async () => {
      handled = handlers[handlers.length - 1]?.();
    });
    expect(handled).toBe(true);
    await flush();
    expect(chip(r.root, "Dhoma e bebit").props.accessibilityState).toEqual({ selected: false });
  });

  it("renditja ndjek moshën e fëmijës aktiv (8 muaj)", async () => {
    const dob = new Date();
    dob.setMonth(dob.getMonth() - 8);
    dob.setDate(dob.getDate() - 1);
    await AsyncStorage.setItem("bebix_app_state_v3", JSON.stringify({ profile: { babyDob: dob.toISOString() } }));
    await renderScreen(<Shop />);
    await flush();
    const calls = fakeSupabase().calls.filter((c) => c.kind === "rpc" && c.name === "shop_product_order");
    expect(calls.at(-1)?.args).toMatchObject({ p_age_from: 8, p_age_to: 8, p_pregnancy: false });
  });
});
