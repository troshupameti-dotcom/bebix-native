import { isValidPhone, reconcileCart, type ProductNow } from "@/lib/shop/cartCheck";
import type { CartItem } from "@/lib/state/types";

const item = (id: string, price: number, qty: number): CartItem => ({ id, name: `P${id}`, price, qty, imageUrl: null, icon: "cube" });
const product = (id: string, price: number, stock: number | null, is_active = true): ProductNow => ({
  id,
  name: `P${id}`,
  price,
  stock,
  is_active,
  image_url: null,
});

describe("kontrolli i shportës para porosisë", () => {
  it("s'ndryshon asgjë kur çmimi dhe stoku janë si në shportë", () => {
    const { changes } = reconcileCart([item("1", 9.99, 2)], [product("1", 9.99, 10)]);
    expect(changes).toEqual([]);
  });

  it("çmimi i ri i tregohet klientit dhe shporta merr çmimin e sotëm", () => {
    const { items, changes } = reconcileCart([item("1", 9.99, 1)], [product("1", 12.5, 10)]);
    expect(items[0].price).toBe(12.5);
    expect(changes).toEqual([{ kind: "price", name: "P1", from: 9.99, to: 12.5 }]);
  });

  it("produkti i çaktivizuar, i zhdukur ose pa stok hiqet", () => {
    const { items, changes } = reconcileCart(
      [item("1", 1, 1), item("2", 1, 1), item("3", 1, 1)],
      [product("1", 1, 5, false), product("3", 1, 0)]
    );
    expect(items).toEqual([]);
    expect(changes.map((c) => c.kind)).toEqual(["removed", "removed", "removed"]);
  });

  it("sasia kufizohet te stoku i disponueshëm", () => {
    const { items, changes } = reconcileCart([item("1", 1, 8)], [product("1", 1, 3)]);
    expect(items[0].qty).toBe(3);
    expect(changes).toEqual([{ kind: "qty", name: "P1", to: 3 }]);
  });
});

describe("telefoni", () => {
  it("pranon numrat e zakonshëm", () => {
    expect(isValidPhone("+383 44 123 456")).toBe(true);
    expect(isValidPhone("044/123-456")).toBe(true);
  });

  it("refuzon tekstin dhe numrat shumë të shkurtër", () => {
    expect(isValidPhone("abc")).toBe(false);
    expect(isValidPhone("123")).toBe(false);
  });
});
