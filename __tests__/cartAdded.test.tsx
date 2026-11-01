/**
 * Animacioni i shtimit në shportë: çdo `addToCart` (produkti, "Porosit përsëri", kartat te Bebi) e lajmëron
 * dhe `CartAddedHost` tregon karrocën me "U shtua në shportë ✅". Disa produkte njëherësh = një animacion.
 */
import { useEffect } from "react";
import { act } from "react-test-renderer";
import { renderScreen, visibleText } from "./helpers/screen";
import { CartAddedHost } from "@/components/shop/CartAddedHost";
import { announceCartAdded, onCartAdded } from "@/lib/shop/cartAdded";
import { useAppState } from "@/lib/state/AppStateContext";

const LABEL = "U shtua në shportë ✅";
const count = (texts: string[]) => texts.filter((x) => x === LABEL).length;

describe("shtimi në shportë", () => {
  it("addToCart e lajmëron animacionin, një herë për çdo shtim", async () => {
    const heard = jest.fn();
    const off = onCartAdded(heard);
    let add!: ReturnType<typeof useAppState>["addToCart"];
    function Grab() {
      const { addToCart } = useAppState();
      useEffect(() => {
        add = addToCart;
      });
      return null;
    }
    await renderScreen(<Grab />);
    await act(async () => add({ id: "p1", name: "Pelena", price: 10, imageUrl: null, icon: "cube" }, 2));
    expect(heard).toHaveBeenCalledTimes(1);
    off();
  });

  it("karroca del me tekstin dhe tikun; disa shtime njëherësh luajnë një animacion", async () => {
    const r = await renderScreen(<CartAddedHost />);
    expect(count(visibleText(r.root))).toBe(0);
    await act(async () => {
      announceCartAdded();
      announceCartAdded();
      announceCartAdded();
    });
    expect(count(visibleText(r.root))).toBe(1);
  });

  it("pas animacionit zhduket", async () => {
    const r = await renderScreen(<CartAddedHost />);
    await act(async () => announceCartAdded());
    expect(count(visibleText(r.root))).toBe(1);
    await act(async () => {
      await new Promise((ok) => setTimeout(ok, 2800));
    });
    expect(count(visibleText(r.root))).toBe(0);
  });
});
