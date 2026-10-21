import { supabase } from "@/lib/supabase/client";
import { mapOrder, type MyOrder } from "@/lib/shop/orders";
import { periodRange, type PeriodKey } from "@/lib/admin/labels";

/**
 * Të dhënat e panelit të adminit. Të njëjtat kërkesa si paneli i webit (bebix-web/app/admin): çdo gjë kalon me
 * sesionin e adminit, dhe baza (RLS + `is_admin()`) vendos çfarë lejohet. App-i s'ka asnjë çelës të veçantë.
 * Çdo funksion hedh gabim me mesazhin e bazës kur dështon; ekranet e tregojnë.
 */

function fail(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

const num = (v: unknown) => Number(v) || 0;

// ---- Pasqyra ----

export type Dashboard = {
  revenue30: number;
  revenuePrev30: number;
  orders30: number;
  ordersPrev30: number;
  avgOrder30: number;
  cancelled30: number;
  cancelledPct30: number;
  pendingOrders: number;
  pendingProducts: number;
  pendingPartners: number;
  pendingExperts: number;
  openReports: number;
  top: { id: string; name: string; units: number; revenue: number }[];
};

export async function fetchDashboard(): Promise<Dashboard> {
  const [summary, top, products, partners, experts, reports, aiReports] = await Promise.all([
    supabase.from("admin_sales_summary").select("*").maybeSingle(),
    supabase.from("admin_top_products").select("*").order("revenue", { ascending: false }).limit(8),
    supabase.from("products").select("id", { count: "exact", head: true }).eq("approval_status", "pending").not("created_by_partner", "is", null),
    supabase.from("partners").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("expert_applications").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("community_reports").select("id", { count: "exact", head: true }).eq("status", "open"),
    // Pa migrimin e AI-së tabela mungon: numri del 0.
    supabase.from("ai_reports").select("id", { count: "exact", head: true }).eq("status", "open"),
  ]);
  fail(summary.error);
  const s = (summary.data ?? {}) as Record<string, unknown>;
  return {
    revenue30: num(s.revenue_30d),
    revenuePrev30: num(s.revenue_prev_30d),
    orders30: num(s.orders_30d),
    ordersPrev30: num(s.orders_prev_30d),
    avgOrder30: num(s.avg_order_value_30d),
    cancelled30: num(s.cancelled_30d),
    cancelledPct30: num(s.cancelled_pct_30d),
    pendingOrders: num(s.pending_now),
    pendingProducts: products.count ?? 0,
    pendingPartners: partners.count ?? 0,
    pendingExperts: experts.count ?? 0,
    openReports: (reports.count ?? 0) + (aiReports.error ? 0 : aiReports.count ?? 0),
    top: ((top.data ?? []) as Record<string, unknown>[]).map((r) => ({
      id: String(r.product_id),
      name: String(r.product_name ?? "—"),
      units: num(r.units),
      revenue: num(r.revenue),
    })),
  };
}

// ---- Porositë ----

export const ORDERS_PAGE = 25;

export type AdminOrder = MyOrder & { country: string | null };
export type OrdersSummary = { live: number; cancelled: number; revenue: number; paidByCard: number };

function orderSearch(q: string): string {
  const term = q.trim().replace(/[%,()]/g, " ");
  return term ? `full_name.ilike.%${term}%,phone.ilike.%${term}%,city.ilike.%${term}%,address.ilike.%${term}%` : "";
}

/** `limit`: sa porosi të ngarkohen nga fillimi (25, 50, …): "Ngarko më shumë" e rrit. */
export async function fetchOrders(opts: { status: string; q: string; period: PeriodKey; limit: number }): Promise<{
  orders: AdminOrder[];
  total: number;
  summary: OrdersSummary | null;
}> {
  const range = periodRange(opts.period);
  const search = orderSearch(opts.q);
  // select("*"): kolonat e dërgesës ekzistojnë vetëm pas migrimit (si në web).
  let query = supabase.from("orders").select("*", { count: "exact" });
  if (opts.status) query = query.eq("status", opts.status);
  if (search) query = query.or(search);
  if (range) query = query.gte("created_at", range.from.toISOString()).lt("created_at", range.to.toISOString());
  const { data, count, error } = await query.order("created_at", { ascending: false }).range(0, opts.limit - 1);
  fail(error);

  // Përmbledhja e periudhës, pavarësisht nga statusi i zgjedhur.
  let summary: OrdersSummary | null = null;
  if (range) {
    let sq = supabase
      .from("orders")
      .select("total_price, status, payment_method, payment_status")
      .gte("created_at", range.from.toISOString())
      .lt("created_at", range.to.toISOString());
    if (search) sq = sq.or(search);
    const { data: all } = await sq.limit(5000);
    const rows = (all ?? []) as { total_price: number | string; status: string; payment_method?: string | null; payment_status?: string | null }[];
    const live = rows.filter((r) => r.status !== "cancelled");
    summary = {
      live: live.length,
      cancelled: rows.length - live.length,
      revenue: live.reduce((sum, r) => sum + num(r.total_price), 0),
      paidByCard: live.filter((r) => r.payment_method === "card" && r.payment_status === "paid").length,
    };
  }

  const orders = ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    ...mapOrder(row),
    country: typeof row.country === "string" ? row.country : null,
  }));
  return { orders, total: count ?? 0, summary };
}

/** Foto dhe kodi i produktit nga katalogu: porositë e vjetra s'e ruajnë foton te artikulli. */
export async function fetchOrderItemMeta(ids: string[]): Promise<Map<string, { img: string | null; code: string }>> {
  const meta = new Map<string, { img: string | null; code: string }>();
  if (!ids.length) return meta;
  const [prods, pps] = await Promise.all([
    supabase.from("products").select("id, image_url").in("id", ids),
    supabase.from("partner_products").select("product_id, sku").in("product_id", ids),
  ]);
  const sku = new Map(((pps.data ?? []) as { product_id: string; sku: string | null }[]).map((p) => [p.product_id, p.sku]));
  const img = new Map(((prods.data ?? []) as { id: string; image_url: string | null }[]).map((p) => [p.id, p.image_url]));
  for (const id of ids) meta.set(id, { img: img.get(id) ?? null, code: sku.get(id) || id.slice(0, 8).toUpperCase() });
  return meta;
}

/** Klienti e sheh ndryshimin në app dhe merr email (si nga paneli i webit). */
export async function setOrderStatus(id: string, status: string): Promise<void> {
  const { error } = await supabase.from("orders").update({ status }).eq("id", id);
  fail(error);
}

/** "Paguar" ruan edhe datën (p.sh. transferta bankare arriti). */
export async function setPaymentStatus(id: string, status: string): Promise<void> {
  const { error } = await supabase
    .from("orders")
    .update({ payment_status: status, paid_at: status === "paid" ? new Date().toISOString() : null })
    .eq("id", id);
  fail(error);
}

// ---- Produktet për aprovim ----

export type ProductRequest = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  compareAt: number | null;
  images: string[];
  createdAt: string;
  freeDelivery: boolean;
  brand: string | null;
  category: string | null;
  partner: string | null;
  stock: number | null;
  sku: string | null;
};

export async function fetchProductRequests(): Promise<ProductRequest[]> {
  const { data, error } = await supabase
    .from("products")
    .select(
      "id, name, description, price, compare_at_price, image_url, gallery_urls, created_at, free_delivery, brands(name), categories(label), partners:created_by_partner(company_name), partner_products(stock, sku)"
    )
    .eq("approval_status", "pending")
    .not("created_by_partner", "is", null)
    .order("created_at", { ascending: true });
  fail(error);
  return ((data ?? []) as Record<string, any>[]).map((p) => {
    const pp = Array.isArray(p.partner_products) ? p.partner_products[0] : null;
    return {
      id: p.id,
      name: p.name,
      description: p.description ?? null,
      price: num(p.price),
      compareAt: p.compare_at_price == null ? null : num(p.compare_at_price),
      images: [p.image_url, ...(p.gallery_urls ?? [])].filter((u): u is string => !!u).slice(0, 4),
      createdAt: p.created_at,
      freeDelivery: !!p.free_delivery,
      brand: p.brands?.name ?? null,
      category: p.categories?.label ?? null,
      partner: p.partners?.company_name ?? null,
      stock: pp?.stock ?? null,
      sku: pp?.sku ?? null,
    };
  });
}

/** Aprovon (shfaqet menjëherë në dyqan) ose refuzon me arsye që e sheh partneri. */
export async function reviewProduct(id: string, approve: boolean, reason: string | null): Promise<void> {
  const { error } = await supabase.rpc("admin_review_product", { p_product_id: id, p_approve: approve, p_reason: approve ? null : reason });
  fail(error);
}

// ---- Produktet ----

export const PRODUCTS_PAGE = 25;
export type ProductFilter = "" | "active" | "hidden" | "partner" | "low";

export type AdminProduct = {
  id: string;
  name: string;
  price: number;
  stock: number;
  active: boolean;
  image: string | null;
  approval: string | null;
  partnerManaged: boolean;
  brand: string | null;
  category: string | null;
};

export async function fetchProducts(opts: { filter: ProductFilter; q: string; limit: number }): Promise<{ rows: AdminProduct[]; total: number }> {
  let query = supabase
    .from("products")
    .select("id, name, price, stock, is_active, image_url, approval_status, created_by_partner, brands(name), categories(label)", { count: "exact" });
  if (opts.filter === "active") query = query.eq("is_active", true);
  if (opts.filter === "hidden") query = query.eq("is_active", false);
  if (opts.filter === "partner") query = query.not("created_by_partner", "is", null);
  if (opts.filter === "low") query = query.lte("stock", 5).eq("is_active", true);
  const term = opts.q.trim().replace(/[%,()]/g, " ");
  if (term) query = query.ilike("name", `%${term}%`);
  const { data, count, error } = await query.order("created_at", { ascending: false }).range(0, opts.limit - 1);
  fail(error);
  const rows = ((data ?? []) as Record<string, any>[]).map((p) => ({
    id: p.id,
    name: p.name,
    price: num(p.price),
    stock: num(p.stock),
    active: !!p.is_active,
    image: p.image_url ?? null,
    approval: p.approval_status ?? null,
    partnerManaged: !!p.created_by_partner,
    brand: p.brands?.name ?? null,
    category: p.categories?.label ?? null,
  }));
  return { rows, total: count ?? 0 };
}

export async function setProductActive(id: string, active: boolean): Promise<void> {
  const { error } = await supabase.from("products").update({ is_active: active }).eq("id", id);
  fail(error);
}

export type EditableProduct = {
  id: string;
  name: string;
  description: string;
  price: string;
  compare: string;
  stock: string;
  badge: string;
  brandId: string;
  categoryId: string;
  active: boolean;
  freeDelivery: boolean;
  minAge: string;
  maxAge: string;
  partnerManaged: boolean;
};

export type Choice = { id: string; label: string };

export async function fetchProductForEdit(id: string): Promise<{ product: EditableProduct | null; brands: Choice[]; categories: Choice[] }> {
  const [productRes, brandsRes, categoriesRes] = await Promise.all([
    supabase
      .from("products")
      .select("id, name, description, price, compare_at_price, stock, badge, brand_id, category_id, is_active, free_delivery, min_age_months, max_age_months, created_by_partner")
      .eq("id", id)
      .maybeSingle(),
    supabase.from("brands").select("id, name").order("name"),
    supabase.from("categories").select("id, label").order("sort_order"),
  ]);
  fail(productRes.error);
  const p = productRes.data as Record<string, any> | null;
  const str = (v: unknown) => (v == null ? "" : String(v));
  return {
    product: p
      ? {
          id: p.id,
          name: p.name ?? "",
          description: p.description ?? "",
          price: str(p.price),
          compare: str(p.compare_at_price),
          stock: str(num(p.stock)),
          badge: ["new", "sale", "bestseller"].includes(p.badge) ? p.badge : "",
          brandId: p.brand_id ?? "",
          categoryId: p.category_id ?? "",
          active: !!p.is_active,
          freeDelivery: !!p.free_delivery,
          minAge: str(p.min_age_months),
          maxAge: str(p.max_age_months),
          partnerManaged: !!p.created_by_partner,
        }
      : null,
    brands: ((brandsRes.data ?? []) as { id: string; name: string }[]).map((b) => ({ id: b.id, label: b.name })),
    categories: ((categoriesRes.data ?? []) as { id: string; label: string }[]).map((c) => ({ id: c.id, label: c.label })),
  };
}

/** Kontrollet e formularit; kthen mesazhin e gabimit ose null. */
export function validateProduct(v: EditableProduct): string | null {
  const price = Number(v.price.replace(",", "."));
  const compare = v.compare.trim() ? Number(v.compare.replace(",", ".")) : null;
  if (v.name.trim().length < 2 || !Number.isFinite(price) || price < 0) return "Shkruaj emrin dhe një çmim të vlefshëm.";
  if (compare !== null && (!Number.isFinite(compare) || compare < price)) return "Çmimi i vjetër nuk mund të jetë më i vogël se çmimi aktual.";
  return null;
}

export async function saveProduct(v: EditableProduct): Promise<void> {
  const ageOrNull = (s: string) => (s.trim() && Number.isFinite(Number(s)) ? Math.max(0, Math.floor(Number(s))) : null);
  const body: Record<string, unknown> = {
    name: v.name.trim(),
    description: v.description.trim() || null,
    price: Number(v.price.replace(",", ".")),
    compare_at_price: v.compare.trim() ? Number(v.compare.replace(",", ".")) : null,
    badge: ["new", "sale", "bestseller"].includes(v.badge) ? v.badge : null,
    brand_id: v.brandId || null,
    category_id: v.categoryId || null,
    is_active: v.active,
    free_delivery: v.freeDelivery,
    min_age_months: ageOrNull(v.minAge),
    max_age_months: ageOrNull(v.maxAge),
  };
  // Për produktet e partnerëve stoku mbahet te inventari i tyre.
  if (!v.partnerManaged) body.stock = Math.max(0, Math.floor(Number(v.stock) || 0));
  const { error } = await supabase.from("products").update(body).eq("id", v.id);
  fail(error);
}

// ---- Ekspertët ----

export type ExpertApplication = {
  id: string;
  userId: string;
  fullName: string;
  specialization: string;
  specialtyKey: string | null;
  licenseNumber: string | null;
  licenseUrl: string | null;
  experienceYears: number;
  phone: string | null;
  bio: string | null;
  status: string;
  adminNote: string | null;
  createdAt: string;
};

export type VerifiedExpert = { id: string; name: string; kind: string; hasAccount: boolean; specialtyKey: string | null };
export type Department = { key: string; label: string; emoji: string };

export async function fetchExperts(status: string): Promise<{ applications: ExpertApplication[]; experts: VerifiedExpert[]; departments: Department[] }> {
  let query = supabase.from("expert_applications").select("*").order("created_at", { ascending: false });
  if (status) query = query.eq("status", status);
  const [apps, expertsRes, deptsRes] = await Promise.all([
    query,
    supabase.from("community_experts").select("*").order("name"),
    supabase.from("community_specialties").select("key, label, emoji").order("sort_order").order("label"),
  ]);
  fail(apps.error);
  const rows = (apps.data ?? []) as Record<string, any>[];
  // Licenca rri te bucket-i privat: lidhje e përkohshme (1 orë), si në web.
  const applications = await Promise.all(
    rows.map(async (a) => {
      let licenseUrl: string | null = null;
      if (a.license_photo_path) {
        const { data } = await supabase.storage.from("expert-licenses").createSignedUrl(a.license_photo_path, 3600);
        licenseUrl = data?.signedUrl ?? null;
      }
      return {
        id: a.id,
        userId: a.user_id,
        fullName: a.full_name ?? "—",
        specialization: a.specialization ?? "",
        specialtyKey: a.specialty_key ?? null,
        licenseNumber: a.license_number ?? null,
        licenseUrl,
        experienceYears: num(a.experience_years),
        phone: a.phone ?? null,
        bio: a.bio ?? null,
        status: a.status ?? "pending",
        adminNote: a.admin_note ?? null,
        createdAt: a.created_at,
      };
    })
  );
  const experts = ((expertsRes.data ?? []) as Record<string, any>[]).map((e) => ({
    id: e.id,
    name: e.name ?? "—",
    kind: e.kind ?? "",
    hasAccount: !!e.user_id,
    specialtyKey: e.specialty_key ?? null,
  }));
  // Repartet vetëm pasi tabela e tyre ekziston (migrimi i repartave).
  const departments = deptsRes.error ? [] : ((deptsRes.data ?? []) as Department[]).map((d) => ({ key: String(d.key), label: String(d.label), emoji: String(d.emoji ?? "") }));
  return { applications, experts, departments };
}

/** Aprovimi: një transaksion te baza; para migrimit të repartave, rruga e vjetër (si në web). */
export async function approveExpert(app: ExpertApplication, specialty: string | null): Promise<void> {
  const { error } = await supabase.rpc("approve_expert_application", { p_application: app.id, p_specialty: specialty });
  if (!error) return;
  const missing = error.code === "PGRST202" || (/approve_expert_application/i.test(error.message) && /could not find|does not exist/i.test(error.message));
  if (!missing) throw new Error(error.message);
  const { data: auth } = await supabase.auth.getUser();
  const { error: updateError } = await supabase
    .from("expert_applications")
    .update({ status: "approved", reviewed_at: new Date().toISOString(), reviewed_by: auth.user?.id ?? null })
    .eq("id", app.id);
  fail(updateError);
  const { error: insertError } = await supabase.from("community_experts").insert({
    user_id: app.userId,
    name: app.fullName,
    kind: app.specialization,
    bio: app.bio ?? "",
    experience_years: app.experienceYears,
    languages: ["Shqip"],
    rating: 0,
    review_count: 0,
    icon: "shield",
    accent: "olive",
  });
  if (insertError) throw new Error(`Aplikimi u aprovua, por s'u krijua te drejtoria e komunitetit: ${insertError.message}`);
}

export async function rejectExpert(id: string, note: string): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("expert_applications")
    .update({ status: "rejected", admin_note: note.trim() || null, reviewed_at: new Date().toISOString(), reviewed_by: auth.user?.id ?? null })
    .eq("id", id);
  fail(error);
}

export async function setExpertDepartment(id: string, dept: Department): Promise<void> {
  const { error } = await supabase.from("community_experts").update({ specialty_key: dept.key, kind: dept.label }).eq("id", id);
  fail(error);
}

export async function removeExpert(id: string): Promise<void> {
  const { error } = await supabase.from("community_experts").delete().eq("id", id);
  fail(error);
}

// ---- Raportimet ----

export type ReportTab = "open" | "all" | "reviewed" | "dismissed";
type Target = { id: string; text: string | null; author_name: string | null; created_at: string };
export type ReportGroup = {
  kind: "post" | "comment";
  targetId: string;
  target: Target | null;
  count: number;
  reasons: string[];
  notes: string[];
  status: string;
};

/** Disa raportime për të njëjtin postim janë një rast, jo disa. */
export async function fetchReports(tab: ReportTab): Promise<ReportGroup[]> {
  let query = supabase
    .from("community_reports")
    .select("id, post_id, comment_id, reason, note, status, community_posts(id, text, author_name, created_at), community_comments(id, text, author_name, created_at)")
    .order("created_at", { ascending: false })
    .limit(300);
  if (tab !== "all") query = query.eq("status", tab);
  const { data, error } = await query;
  fail(error);
  const groups = new Map<string, ReportGroup>();
  for (const r of (data ?? []) as Record<string, any>[]) {
    const kind: "post" | "comment" = r.post_id ? "post" : "comment";
    const targetId = String(r.post_id ?? r.comment_id);
    const key = `${kind}:${targetId}`;
    let g = groups.get(key);
    if (!g) {
      g = { kind, targetId, target: (kind === "post" ? r.community_posts : r.community_comments) ?? null, count: 0, reasons: [], notes: [], status: r.status };
      groups.set(key, g);
    }
    g.count += 1;
    if (!g.reasons.includes(r.reason)) g.reasons.push(r.reason);
    if (r.note) g.notes.push(r.note);
  }
  return [...groups.values()];
}

export async function removeReported(kind: "post" | "comment", id: string): Promise<void> {
  const { error } = await supabase.from(kind === "post" ? "community_posts" : "community_comments").delete().eq("id", id);
  fail(error);
}

export async function markReports(kind: "post" | "comment", id: string, status: "dismissed" | "reviewed"): Promise<void> {
  const { error } = await supabase.from("community_reports").update({ status }).eq(kind === "post" ? "post_id" : "comment_id", id);
  fail(error);
}

// ---- Raportimet e asistentit AI ----

export type AiReport = { id: string; question: string; answer: string; reason: string; note: string | null; status: string; createdAt: string };

/** Përgjigjet e AI-së që raportuan prindërit; null kur tabela s'ekziston ende (para migrimit të AI-së). */
export async function fetchAiReports(tab: ReportTab): Promise<AiReport[] | null> {
  if (tab === "dismissed") return [];
  let query = supabase.from("ai_reports").select("id, question, answer, reason, note, status, created_at").order("created_at", { ascending: false }).limit(100);
  if (tab !== "all") query = query.eq("status", tab);
  const { data, error } = await query;
  if (error) return null;
  return ((data ?? []) as Record<string, any>[]).map((r) => ({
    id: r.id,
    question: r.question ?? "",
    answer: r.answer ?? "",
    reason: r.reason ?? "other",
    note: r.note ?? null,
    status: r.status ?? "open",
    createdAt: r.created_at,
  }));
}

export async function markAiReportReviewed(id: string): Promise<void> {
  const { error } = await supabase.from("ai_reports").update({ status: "reviewed" }).eq("id", id);
  fail(error);
}

// ---- Partnerët ----

export type Partner = {
  id: string;
  company: string;
  contact: string | null;
  email: string | null;
  phone: string | null;
  place: string;
  website: string | null;
  category: string | null;
  description: string | null;
  status: string;
  appliedAt: string;
  direct: boolean;
  productCount: number;
};

export async function fetchPartners(status: string): Promise<Partner[]> {
  let query = supabase
    .from("partners")
    .select("id, company_name, contact_person, email, phone, city, country, website, business_category, description, status, applied_at, can_publish_directly, partner_products(id)")
    .order("applied_at", { ascending: false });
  if (status) query = query.eq("status", status);
  const { data, error } = await query;
  fail(error);
  return ((data ?? []) as Record<string, any>[]).map((p) => ({
    id: p.id,
    company: p.company_name ?? "—",
    contact: p.contact_person ?? null,
    email: p.email ?? null,
    phone: p.phone ?? null,
    place: [p.city, p.country].filter(Boolean).join(", "),
    website: p.website ?? null,
    category: p.business_category ?? null,
    description: p.description ?? null,
    status: p.status ?? "pending",
    appliedAt: p.applied_at,
    direct: !!p.can_publish_directly,
    productCount: Array.isArray(p.partner_products) ? p.partner_products.length : 0,
  }));
}

export async function updatePartner(id: string, values: { status?: string; can_publish_directly?: boolean }): Promise<void> {
  const body: Record<string, unknown> = { ...values };
  if (values.status === "approved") {
    const { data: auth } = await supabase.auth.getUser();
    body.approved_at = new Date().toISOString();
    body.approved_by = auth.user?.id ?? null;
  }
  const { error } = await supabase.from("partners").update(body).eq("id", id);
  fail(error);
}

// ---- Pagesat për partnerët ----

export type Payout = {
  id: string;
  amount: number;
  status: string;
  periodStart: string | null;
  periodEnd: string | null;
  reference: string | null;
  paidAt: string | null;
  createdAt: string;
  partner: string | null;
};

export async function fetchPayouts(): Promise<{ payouts: Payout[]; partners: Choice[]; owed: number }> {
  const [payoutsRes, partnersRes] = await Promise.all([
    supabase
      .from("partner_payouts")
      .select("id, amount, status, period_start, period_end, reference, paid_at, created_at, partners(company_name)")
      .order("created_at", { ascending: false })
      .limit(200),
    supabase.from("partners").select("id, company_name").eq("status", "approved").order("company_name"),
  ]);
  fail(payoutsRes.error);
  const payouts = ((payoutsRes.data ?? []) as Record<string, any>[]).map((p) => ({
    id: p.id,
    amount: num(p.amount),
    status: p.status ?? "pending",
    periodStart: p.period_start ?? null,
    periodEnd: p.period_end ?? null,
    reference: p.reference ?? null,
    paidAt: p.paid_at ?? null,
    createdAt: p.created_at,
    partner: p.partners?.company_name ?? null,
  }));
  const owed = payouts.filter((p) => p.status !== "paid" && p.status !== "failed").reduce((s, p) => s + p.amount, 0);
  const partners = ((partnersRes.data ?? []) as { id: string; company_name: string }[]).map((p) => ({ id: p.id, label: p.company_name }));
  return { payouts, partners, owed };
}

export async function createPayout(input: { partnerId: string; amount: number; start: string | null; end: string | null; reference: string }): Promise<void> {
  const { error } = await supabase.from("partner_payouts").insert({
    partner_id: input.partnerId,
    amount: input.amount,
    period_start: input.start,
    period_end: input.end,
    reference: input.reference.trim() || null,
    status: "pending",
  });
  fail(error);
}

export async function setPayoutStatus(id: string, status: string): Promise<void> {
  const patch: Record<string, unknown> = { status };
  if (status === "paid") patch.paid_at = new Date().toISOString();
  const { error } = await supabase.from("partner_payouts").update(patch).eq("id", id);
  fail(error);
}
