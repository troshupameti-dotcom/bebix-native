import { renderScreen, visibleText } from "./helpers/screen";
import { act } from "react-test-renderer";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ProductCard } from "@/components/ProductCard";
import { RECENT_MAX, loadRecentlyViewed, recordViewed, withViewed } from "@/lib/shop/recentlyViewed";
import type { Product } from "@/lib/homeContent";

const product = (id: string, extra: Partial<Product> = {}): Product => ({
  id,
  name: `Produkti ${id}`,
  brand: "NUK",
  price: 7.9,
  compareAtPrice: null,
  category: "feeding",
  icon: "bottle",
  accent: "olive",
  rating: 4.6,
  badge: null,
  reviewCount: 0,
  imageUrl: null,
  stock: 3,
  ...extra,
});

const button = (root: Parameters<typeof visibleText>[0], label: string) =>
  root.findAll((n) => typeof n.props.onPress === "function" && String(n.props.accessibilityLabel ?? "").startsWith(label))[0];
const stop = { stopPropagation: () => {} };

describe("parë së fundmi", () => {
  beforeEach(async () => {
    await AsyncStorage.removeItem("bebix_recent_products_v1");
  });

  it("i fundit del i pari, pa përsëritje, deri në 10", () => {
    let list: Product[] = [];
    for (let i = 1; i <= 12; i++) list = withViewed(list, product(`p${i}`));
    list = withViewed(list, product("p5"));
    expect(list).toHaveLength(RECENT_MAX);
    expect(list.slice(0, 3).map((p) => p.id)).toEqual(["p5", "p12", "p11"]);
    expect(list.filter((p) => p.id === "p5")).toHaveLength(1);
  });

  it("ruhet në telefon dhe lexohet sërish; të dhëna të prishura s'e rrëzojnë", async () => {
    await recordViewed(product("a"));
    await recordViewed(product("b", { description: "tekst i gjatë që s'duhet ruajtur" }));
    const list = await loadRecentlyViewed();
    expect(list.map((p) => p.id)).toEqual(["b", "a"]);
    expect(list[0].description).toBeUndefined();
    await AsyncStorage.setItem("bebix_recent_products_v1", "{jo json");
    expect(await loadRecentlyViewed()).toEqual([]);
  });
});

describe("karta e produktit", () => {
  it("“Shto në shportë” e shton pa hapur produktin; pastaj sasia ndryshohet në kartë deri te stoku", async () => {
    const open = jest.fn();
    const r = await renderScreen(<ProductCard product={product("q1")} onPress={open} cardWidth={168} />);
    expect(visibleText(r.root)).toContain("Shto në shportë");
    await act(async () => button(r.root, "Shto në Shportë").props.onPress(stop));
    expect(visibleText(r.root)).toContain("1 në shportë");
    expect(open).not.toHaveBeenCalled();

    await act(async () => button(r.root, "Shto një").props.onPress(stop));
    await act(async () => button(r.root, "Shto një").props.onPress(stop));
    expect(visibleText(r.root)).toContain("3 në shportë");
    // Stoku është 3: s'shtohet më.
    expect(button(r.root, "Shto një").props.disabled).toBe(true);

    for (let i = 0; i < 3; i++) await act(async () => button(r.root, "Hiq një").props.onPress(stop));
    expect(visibleText(r.root)).toContain("Shto në shportë");
  });

  it("pa stok: s'ka buton shtimi; yjet dalin vetëm kur ka vlerësime; zbritja në përqindje", async () => {
    const out = await renderScreen(<ProductCard product={product("q2", { stock: 0 })} onPress={() => {}} />);
    expect(visibleText(out.root)).toContain("Jashtë stokut");
    expect(button(out.root, "Shto në Shportë")).toBeUndefined();

    const rated = await renderScreen(<ProductCard product={product("q3", { reviewCount: 12, compareAtPrice: 10 })} onPress={() => {}} />);
    const text = visibleText(rated.root).join(" | ");
    expect(text).toMatch(/\(12\)/);
    expect(text).toMatch(/-21%/);
    expect(rated.root.findAll((n) => n.props.accessibilityLabel === "Vlerësimi 4.6 nga 5, 12 vlerësime").length).toBeGreaterThan(0);
  });
});
