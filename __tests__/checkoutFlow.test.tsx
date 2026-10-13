/**
 * Arkëtimi si e përdor klienti: totali me dërgesën nga baza, prekja e dyfishtë e "Konfirmo", çmimi që
 * ndryshon ndërkohë, gabimi i rrjetit dhe riprovimi. Baza (place_guest_order) e njeh referencën e porosisë
 * (supabase/tests/checkout.test.mjs, "idempotenca"); këtu provohet që app-i e dërgon të njëjtën.
 */
import { button, fakeSupabase, renderScreen, visibleText } from "./helpers/screen";
import { act, type ReactTestRenderer } from "react-test-renderer";
import { TextInput } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Checkout from "@/app/(main)/shop/checkout";
import { APP_STATE_KEY } from "@/lib/state/persistence";
import { translations } from "@/lib/i18n/translations";

const sq = translations.sq;
const CART = [{ id: "p1", name: "Pelena", price: 10, imageUrl: null, icon: "shop", qty: 2 }];
const PRODUCT_NOW = { id: "p1", name: "Pelena", price: 10, is_active: true, stock: 50, image_url: null };

async function openCheckout(): Promise<ReactTestRenderer> {
  await AsyncStorage.setItem(APP_STATE_KEY, JSON.stringify({ cartItems: CART }));
  const fake = fakeSupabase();
  fake.rpc.shipping_quote = () => 2.5;
  fake.rpc.shipping_quote_by_method = () => 0;
  fake.tables.products = [PRODUCT_NOW];
  return renderScreen(<Checkout />);
}

async function fill(r: ReactTestRenderer, phone = "044 123 456") {
  const field = (placeholder: string) => r.root.findAll((n) => n.type === TextInput && n.props.placeholder === placeholder)[0];
  await act(async () => {
    field(sq.co_ph_name).props.onChangeText("Arta Krasniqi");
    field(sq.co_ph_phone).props.onChangeText(phone);
    field(sq.co_ph_address).props.onChangeText("Rr. Nënë Tereza 1");
    field(sq.co_ph_city).props.onChangeText("Prishtinë");
  });
}

const orderCalls = () => fakeSupabase().calls.filter((c) => c.kind === "rpc" && c.name === "place_guest_order");

describe("arkëtimi", () => {
  it("totali = produktet (2 × 10 €) + dërgesa nga baza (2.50 €)", async () => {
    const r = await openCheckout();
    const text = visibleText(r.root);
    expect(text).toContain("€20.00");
    expect(text).toContain("€22.50");
  });

  it("prekja e dyfishtë e “Konfirmo” s'krijon dy porosi: çdo dërgim ka të njëjtën referencë", async () => {
    const r = await openCheckout();
    fakeSupabase().rpc.place_guest_order = () => "a1b2c3d4-0000-4000-8000-000000000001";
    await fill(r);
    const confirm = button(r.root, sq.co_confirm).props.onPress;
    await act(async () => {
      confirm();
      confirm();
    });
    const calls = orderCalls();
    expect(calls.length).toBeGreaterThanOrEqual(1);
    expect(new Set(calls.map((c) => c.args?.p_client_ref)).size).toBe(1);
    expect(calls[0].args).toMatchObject({ p_full_name: "Arta Krasniqi", p_items: CART });
    expect(visibleText(r.root)).toContain("#A1B2C3D4");
  });

  it("çmimi ndryshoi ndërkohë: s'porositet, klienti e sheh shportën e re", async () => {
    const r = await openCheckout();
    fakeSupabase().tables.products = [{ ...PRODUCT_NOW, price: 12 }];
    fakeSupabase().rpc.place_guest_order = () => "x";
    await fill(r);
    await act(async () => { button(r.root, sq.co_confirm).props.onPress(); });
    expect(orderCalls()).toHaveLength(0);
    expect(visibleText(r.root)).toContain("€24.00");
  });

  it("rrjeti ra te porosia: gabim i qartë, dhe riprovimi dërgon të njëjtën referencë", async () => {
    const r = await openCheckout();
    await fill(r);
    await act(async () => { button(r.root, sq.co_confirm).props.onPress(); });
    expect(orderCalls()).toHaveLength(1);
    expect(visibleText(r.root)).toContain(sq.co_err_network);

    fakeSupabase().rpc.place_guest_order = () => "a1b2c3d4-0000-4000-8000-000000000002";
    await act(async () => { button(r.root, sq.co_confirm).props.onPress(); });
    const calls = orderCalls();
    expect(calls).toHaveLength(2);
    expect(calls[1].args?.p_client_ref).toBe(calls[0].args?.p_client_ref);
    expect(visibleText(r.root)).toContain("#A1B2C3D4");
  });

  it("telefon i pavlefshëm: mesazh dhe asnjë porosi", async () => {
    const r = await openCheckout();
    fakeSupabase().rpc.place_guest_order = () => "x";
    await fill(r, "12");
    await act(async () => { button(r.root, sq.co_confirm).props.onPress(); });
    expect(visibleText(r.root)).toContain(sq.co_err_phone);
    expect(orderCalls()).toHaveLength(0);
  });
});
