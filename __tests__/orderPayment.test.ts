import { canPayByCard, mapOrder, orderHintKeyFor, orderPaymentLabelKey } from "@/lib/shop/orders";

// Funksionet e testuara s'përdorin rrjetin; klienti i bazës zëvendësohet që importi të mos kërkojë çelësa.
jest.mock("@/lib/supabase/client", () => ({ supabase: {} }));

const base = { id: "abcdef12-0000-4000-8000-000000000000", created_at: "2026-10-05T10:00:00Z", total_price: 20, items: [] };

describe("pagesa te porositë e mia", () => {
  it("porositë e vjetra dhe ato pa fushat e pagesës lexohen si 'paguan në dorëzim'", () => {
    const o = mapOrder({ ...base, status: "pending" });
    expect(o.paymentMethod).toBe("cod");
    expect(o.paymentStatus).toBe("unpaid");
    expect(o.shippingFee).toBe(0);
    expect(o.clientRef).toBeNull();
    expect(orderPaymentLabelKey(o)).toBe("myorders_cod");
  });

  it("vlerat e panjohura bien te parazgjedhja, jo te një etiketë e gabuar", () => {
    const o = mapOrder({ ...base, status: "pending", payment_method: "paypal", payment_status: "ndoshta" });
    expect(o.paymentMethod).toBe("cod");
    expect(o.paymentStatus).toBe("unpaid");
  });

  it("karta: pritje, e paguar, dështuar, e rimbursuar", () => {
    const row = { ...base, status: "pending", payment_method: "card", shipping_fee: "0", client_ref: "11111111-1111-4111-8111-111111111111" };
    expect(orderPaymentLabelKey(mapOrder({ ...row, payment_status: "pending" }))).toBe("myorders_awaiting_card");
    expect(orderPaymentLabelKey(mapOrder({ ...row, payment_status: "paid" }))).toBe("myorders_paid_card");
    expect(orderPaymentLabelKey(mapOrder({ ...row, payment_status: "failed" }))).toBe("myorders_card_failed");
    expect(orderPaymentLabelKey(mapOrder({ ...row, payment_status: "refunded" }))).toBe("myorders_refunded");
  });

  it("transferta bankare: në pritje dhe e paguar", () => {
    const row = { ...base, status: "pending", payment_method: "bank_transfer" };
    expect(orderPaymentLabelKey(mapOrder({ ...row, payment_status: "pending" }))).toBe("myorders_awaiting_bank");
    expect(orderPaymentLabelKey(mapOrder({ ...row, payment_status: "paid" }))).toBe("myorders_paid_bank");
  });

  it("riprovimi i pagesës vetëm për kartë në pritje, e pa anuluar, me referencë", () => {
    const row = { ...base, payment_method: "card", payment_status: "pending", client_ref: "11111111-1111-4111-8111-111111111111" };
    expect(canPayByCard(mapOrder({ ...row, status: "pending" }))).toBe(true);
    expect(canPayByCard(mapOrder({ ...row, status: "cancelled" }))).toBe(false);
    expect(canPayByCard(mapOrder({ ...row, status: "pending", payment_status: "paid" }))).toBe(false);
    expect(canPayByCard(mapOrder({ ...row, status: "pending", client_ref: null }))).toBe(false);
    expect(canPayByCard(mapOrder({ ...row, status: "pending", payment_method: "cod" }))).toBe(false);
  });

  it("shpjegimi: me kartë s'thotë 'paguan kur ta marrësh'", () => {
    const card = { ...base, payment_method: "card" };
    expect(orderHintKeyFor(mapOrder({ ...card, status: "pending", payment_status: "pending" }))).toBe("order_hint_card_pending");
    expect(orderHintKeyFor(mapOrder({ ...card, status: "pending", payment_status: "paid" }))).toBe("order_hint_card_paid");
    expect(orderHintKeyFor(mapOrder({ ...card, status: "shipped", payment_status: "paid" }))).toBe("order_hint_shipped_prepaid");
    // në dorëzim: teksti i zakonshëm "paguan kur ta marrësh"
    expect(orderHintKeyFor(mapOrder({ ...base, status: "shipped" }))).toBe("order_hint_shipped");
    expect(orderHintKeyFor(mapOrder({ ...base, status: "delivered" }))).toBe("order_hint_delivered");
  });
});
