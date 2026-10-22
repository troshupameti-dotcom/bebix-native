/**
 * Paneli i adminit në app: shfaqet vetëm për llogaritë te tabela `admins`, ekranet mbrohen, porositë dhe produktet
 * për aprovim punojnë me të njëjtat veprime si paneli i webit.
 */
import { fakeSupabase, renderScreen, visibleText } from "./helpers/screen";
import { act, type ReactTestInstance } from "react-test-renderer";
import More from "@/app/(main)/more/index";
import AdminOrders from "@/app/(main)/more/admin/orders";
import AdminRequests from "@/app/(main)/more/admin/requests";
import AdminHome from "@/app/(main)/more/admin/index";
import AdminProducts from "@/app/(main)/more/admin/products";
import AdminProductEdit from "@/app/(main)/more/admin/product/[id]";
import AdminExperts from "@/app/(main)/more/admin/experts";
import AdminReports from "@/app/(main)/more/admin/reports";
import AdminPartners from "@/app/(main)/more/admin/partners";
import AdminPayouts from "@/app/(main)/more/admin/payouts";
import { setParams } from "./helpers/screen";
import { __resetAdminCacheForTests } from "@/lib/admin/access";
import { dayLabel, periodRange } from "@/lib/admin/labels";

const settle = async () => {
  for (let i = 0; i < 6; i++) await act(async () => { await new Promise((r) => setTimeout(r, 15)); });
};
const press = (root: ReactTestInstance, label: string) =>
  act(async () => {
    const hits = root.findAll((n) => typeof n.props.onPress === "function" && visibleText(n).join(" ").includes(label));
    hits[hits.length - 1].props.onPress();
  });

const ORDER = {
  id: "a1b2c3d4-0000-4000-8000-000000000001",
  created_at: new Date().toISOString(),
  full_name: "Arta Krasniqi",
  phone: "044123456",
  address: "Rr. Nënë Tereza 1",
  city: "Prishtinë",
  total_price: 22.5,
  status: "pending",
  items: [{ id: "p1", name: "Pelena", price: 10, qty: 2 }],
  shipping_fee: 2.5,
  country: "XK",
  payment_method: "cod",
  payment_status: "unpaid",
};

beforeEach(() => {
  __resetAdminCacheForTests();
  fakeSupabase().session = { user: { id: "me", email: "admin@bebix.store" } };
});

describe("hyrja te paneli", () => {
  it("del te Cilësimet vetëm për adminin", async () => {
    fakeSupabase().tables.admins = { user_id: "me" };
    const r = await renderScreen(<More />);
    await settle();
    expect(visibleText(r.root)).toContain("Paneli i adminit");
  });

  it("prindi i zakonshëm s'e sheh, dhe ekrani i panelit s'i hapet", async () => {
    fakeSupabase().tables.admins = null;
    const more = await renderScreen(<More />);
    await settle();
    expect(visibleText(more.root)).not.toContain("Paneli i adminit");
    const orders = await renderScreen(<AdminOrders />);
    await settle();
    expect(visibleText(orders.root)).toContain("Kjo pjesë është vetëm për adminët e Bebix.");
  });
});

describe("porositë", () => {
  it("tregon porosinë me klientin, artikujt dhe totalin; statusi ndryshohet nga lista", async () => {
    const fake = fakeSupabase();
    fake.tables.admins = { user_id: "me" };
    fake.tables.orders = [ORDER];
    fake.tables.products = [{ id: "p1", image_url: null }];
    fake.tables.partner_products = [{ product_id: "p1", sku: "PEL-01" }];
    const r = await renderScreen(<AdminOrders />);
    await settle();
    const text = visibleText(r.root).join(" ");
    expect(text).toContain("#A1B2C3D4");
    expect(text).toContain("Arta Krasniqi");
    expect(text).toContain("Pelena × 2");
    expect(text).toContain("Kodi: PEL-01");
    expect(text).toContain("€22.50");

    const before = fake.calls.filter((c) => c.name === "orders").length;
    await act(async () => r.root.findAll((n) => n.props.accessibilityLabel === "Në pritje, ndrysho" && typeof n.props.onPress === "function")[0].props.onPress());
    expect(visibleText(r.root)).toContain("Statusi i porosisë");
    await press(r.root, "Dërguar");
    await settle();
    expect(fake.calls.filter((c) => c.name === "orders").length).toBeGreaterThan(before);
  });
});

describe("fotoja e produktit te porosia", () => {
  it("prekja e fotos e hap të zmadhuar me emrin e produktit; ✕ e mbyll", async () => {
    const fake = fakeSupabase();
    fake.tables.admins = { user_id: "me" };
    fake.tables.orders = [ORDER];
    fake.tables.products = [{ id: "p1", image_url: "https://bebix.store/p1.png" }];
    fake.tables.partner_products = [];
    const r = await renderScreen(<AdminOrders />);
    await settle();
    const label = (l: string) => r.root.findAll((n) => n.props.accessibilityLabel === l && typeof n.props.onPress === "function");
    expect(label("Mbyll foton")).toHaveLength(0);
    await act(async () => label("Zmadho foton: Pelena")[0].props.onPress());
    expect(label("Mbyll foton").length).toBeGreaterThan(0);
    expect(r.root.findAll((n) => n.props.source?.uri === "https://bebix.store/p1.png" && n.props.resizeMode === "contain").length).toBeGreaterThan(1);
    await act(async () => label("Mbyll foton")[0].props.onPress());
    expect(label("Mbyll foton")).toHaveLength(0);
  });
});

describe("produktet për aprovim", () => {
  it("“Aprovo” thërret admin_review_product si paneli i webit", async () => {
    const fake = fakeSupabase();
    fake.tables.admins = { user_id: "me" };
    fake.tables.products = [{ id: "x1", name: "Biberon", price: 9.9, image_url: null, gallery_urls: [], created_at: ORDER.created_at, partners: { company_name: "Baby Shop" }, partner_products: [{ stock: 4, sku: "B1" }] }];
    fake.rpc.admin_review_product = () => null;
    const r = await renderScreen(<AdminRequests />);
    await settle();
    expect(visibleText(r.root).join(" ")).toContain("nga Baby Shop");
    await press(r.root, "Aprovo");
    await settle();
    expect(fake.calls.find((c) => c.name === "admin_review_product")?.args).toEqual({ p_product_id: "x1", p_approve: true, p_reason: null });
  });
});

describe("periudhat", () => {
  it("Sot dhe Dje sipas ditës së telefonit", () => {
    const now = new Date(2026, 9, 19, 2, 0);
    const today = periodRange("today", now)!;
    expect([today.from.getDate(), today.to.getDate()]).toEqual([19, 20]);
    const yesterday = periodRange("yesterday", now)!;
    expect([yesterday.from.getDate(), yesterday.to.getDate()]).toEqual([18, 19]);
    expect(periodRange("all", now)).toBeNull();
    expect(dayLabel(new Date(2026, 9, 18, 23, 0).toISOString(), now)).toBe("Dje");
  });
});

describe("çdo ekran i panelit hapet me të dhëna", () => {
  it("pasqyra, produktet, ndryshimi, ekspertët, raportimet, partnerët dhe pagesat", async () => {
    const fake = fakeSupabase();
    fake.tables.admins = { user_id: "me" };
    fake.tables.admin_sales_summary = { revenue_30d: 1200, revenue_prev_30d: 1000, orders_30d: 40, orders_prev_30d: 32, avg_order_value_30d: 30, cancelled_30d: 2, cancelled_pct_30d: 5, pending_now: 3 };
    fake.tables.admin_top_products = [{ product_id: "p1", product_name: "Pelena", units: 12, revenue: 120 }];
    fake.tables.partners = [{ id: "pa1", company_name: "Baby Shop", status: "pending", applied_at: ORDER.created_at, can_publish_directly: false, partner_products: [] }];
    fake.tables.expert_applications = [{ id: "e1", user_id: "u1", full_name: "Dr. Arta", specialization: "Pediatër", experience_years: 8, status: "pending", created_at: ORDER.created_at }];
    fake.tables.community_experts = [{ id: "ce1", name: "Dr. Besa", kind: "Pediatër", user_id: "u2" }];
    fake.tables.community_specialties = [{ key: "pediatri", label: "Pediatri", emoji: "" }];
    fake.tables.community_reports = [{ id: "r1", post_id: "po1", reason: "spam", status: "open", community_posts: { id: "po1", text: "Shitje", author_name: "Ana", created_at: ORDER.created_at } }];
    fake.tables.products = [{ id: "p1", name: "Pelena", price: 10, stock: 3, is_active: true, image_url: null, created_by_partner: null }];
    fake.tables.brands = [{ id: "b1", name: "Pampers" }];
    fake.tables.categories = [{ id: "c1", label: "Kujdesi" }];
    fake.tables.partner_payouts = [{ id: "pp1", amount: 50, status: "pending", created_at: ORDER.created_at, partners: { company_name: "Baby Shop" } }];

    const home = await renderScreen(<AdminHome />);
    await settle();
    expect(visibleText(home.root)).toEqual(expect.arrayContaining(["€1200.00", "+20% kundrejt 30 ditëve para", "Porositë", "Pelena"]));

    const products = await renderScreen(<AdminProducts />);
    await settle();
    expect(visibleText(products.root).join(" ")).toContain("Pelena €10.00");

    // Produkt me .maybeSingle(): baza e rreme kthen të njëjtën vlerë, ndaj produkti jepet si objekt.
    fake.tables.products = { id: "p1", name: "Pelena", price: 10, stock: 3, is_active: true, brand_id: "b1", category_id: "c1", created_by_partner: null };
    setParams({ id: "p1" });
    const edit = await renderScreen(<AdminProductEdit />);
    await settle();
    expect(visibleText(edit.root)).toEqual(expect.arrayContaining(["Pampers", "Kujdesi", "Ruaj"]));

    const experts = await renderScreen(<AdminExperts />);
    await settle();
    expect(visibleText(experts.root).join(" ")).toContain("Dr. Arta");

    fake.tables.ai_reports = [{ id: "ai1", question: "Sa gjumë?", answer: "Rreth 14 orë.", reason: "unsafe", note: null, status: "open", created_at: ORDER.created_at }];
    const reports = await renderScreen(<AdminReports />);
    await settle();
    const reportsText = visibleText(reports.root).join(" ");
    expect(reportsText).toContain("Shitje Spam");
    // Raportimet e asistentit AI dalin në krye, me arsyen, pyetjen dhe përgjigjen.
    expect(reportsText).toContain("Asistenti AI");
    expect(reportsText).toContain("E rrezikshme për shëndetin");
    expect(reportsText).toContain("Rreth 14 orë.");

    const partners = await renderScreen(<AdminPartners />);
    await settle();
    expect(visibleText(partners.root).join(" ")).toContain("Baby Shop");

    fake.tables.partners = [{ id: "pa1", company_name: "Baby Shop" }];
    const payouts = await renderScreen(<AdminPayouts />);
    await settle();
    expect(visibleText(payouts.root).join(" ")).toContain("Mbetet për t'u paguar: €50.00");
  });
});
