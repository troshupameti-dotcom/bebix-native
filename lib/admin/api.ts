import { FunctionsFetchError, FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";
import { mapOrder, type MyOrder } from "@/lib/shop/orders";
import { periodRange, type PeriodKey } from "@/lib/admin/labels";
import { readingMinutes } from "@/lib/stories/catalog";
import { toRecipe } from "@/lib/recipes/api";
import type { Recipe } from "@/lib/recipes/types";

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
  pendingExperts: number;
  openReports: number;
  /** Përralla nga Claude që presin aprovimin. */
  storyDrafts: number;
  top: { id: string; name: string; units: number; revenue: number }[];
};

export async function fetchDashboard(): Promise<Dashboard> {
  const [summary, top, experts, reports, aiReports, drafts] = await Promise.all([
    supabase.from("admin_sales_summary").select("*").maybeSingle(),
    supabase.from("admin_top_products").select("*").order("revenue", { ascending: false }).limit(8),
    supabase.from("expert_applications").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("community_reports").select("id", { count: "exact", head: true }).eq("status", "open"),
    // Pa migrimin e AI-së tabela mungon: numri del 0.
    supabase.from("ai_reports").select("id", { count: "exact", head: true }).eq("status", "open"),
    // Pa migrimin e përrallave tabela mungon: numri del 0.
    supabase.from("stories").select("id", { count: "exact", head: true }).eq("status", "draft"),
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
    pendingExperts: experts.count ?? 0,
    openReports: (reports.count ?? 0) + (aiReports.error ? 0 : aiReports.count ?? 0),
    storyDrafts: drafts.error ? 0 : drafts.count ?? 0,
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

// ---- Produktet ----

export const PRODUCTS_PAGE = 25;
export type ProductFilter = "" | "active" | "hidden" | "low";

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
  /** Bosh = pa nënkategori. */
  subcategoryId: string;
  active: boolean;
  freeDelivery: boolean;
  minAge: string;
  maxAge: string;
  partnerManaged: boolean;
};

export type Choice = { id: string; label: string };
/** Nënkategoria me kategorinë e saj, që formulari të tregojë vetëm ato të kategorisë së zgjedhur. */
export type SubChoice = Choice & { categoryId: string };

const PRODUCT_EDIT_COLUMNS =
  "id, name, description, price, compare_at_price, stock, badge, brand_id, category_id, is_active, free_delivery, min_age_months, max_age_months, created_by_partner";

export async function fetchProductForEdit(
  id: string,
): Promise<{ product: EditableProduct | null; brands: Choice[]; categories: Choice[]; subcategories: SubChoice[] }> {
  const [subcategoriesRes, brandsRes, categoriesRes] = await Promise.all([
    supabase.from("subcategories").select("id, category_id, label").order("sort_order"),
    supabase.from("brands").select("id, name").order("name"),
    supabase.from("categories").select("id, label").order("sort_order"),
  ]);
  // Para migrimit 20261105090000 s'ka as tabelë, as kolonë: formulari punon si më parë, pa nënkategori.
  const subcategoriesReady = !subcategoriesRes.error;
  const productRes = await supabase
    .from("products")
    .select(subcategoriesReady ? `${PRODUCT_EDIT_COLUMNS}, subcategory_id` : PRODUCT_EDIT_COLUMNS)
    .eq("id", id)
    .maybeSingle();
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
          subcategoryId: p.subcategory_id ?? "",
          active: !!p.is_active,
          freeDelivery: !!p.free_delivery,
          minAge: str(p.min_age_months),
          maxAge: str(p.max_age_months),
          partnerManaged: !!p.created_by_partner,
        }
      : null,
    brands: ((brandsRes.data ?? []) as { id: string; name: string }[]).map((b) => ({ id: b.id, label: b.name })),
    categories: ((categoriesRes.data ?? []) as { id: string; label: string }[]).map((c) => ({ id: c.id, label: c.label })),
    subcategories: ((subcategoriesRes.data ?? []) as { id: string; category_id: string; label: string }[]).map((s) => ({
      id: s.id,
      categoryId: s.category_id,
      label: s.label,
    })),
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

/**
 * Ruajtja. `subcategories` bosh = migrimi i nënkategorive s'është ekzekutuar ende, prandaj kolona s'dërgohet.
 * Nënkategoria ruhet vetëm nëse i përket kategorisë së zgjedhur.
 */
export async function saveProduct(v: EditableProduct, subcategories: SubChoice[] = []): Promise<void> {
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
  if (subcategories.length > 0) {
    const ok = subcategories.some((s) => s.id === v.subcategoryId && s.categoryId === v.categoryId);
    body.subcategory_id = ok ? v.subcategoryId : null;
  }
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

// ---- Përrallat ----

export type StoryTab = "draft" | "published" | "archived";

export type AdminStory = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  paragraphs: string[];
  categories: string[];
  ageMin: number;
  ageMax: number;
  readingMinutes: number;
  cover: string | null;
  coverUrl: string | null;
  coverSvg: string | null;
  status: StoryTab;
  source: "editor" | "ai";
  featured: boolean;
  idea: string | null;
  createdAt: string;
  publishedAt: string | null;
};

const STORY_COLUMNS =
  "id, slug, title, summary, paragraphs, categories, age_min_months, age_max_months, reading_minutes, cover_key, cover_url, cover_svg, status, source, featured, ai_idea, created_at, published_at";

function mapStory(r: Record<string, unknown>): AdminStory {
  return {
    id: String(r.id),
    slug: String(r.slug),
    title: String(r.title ?? ""),
    summary: String(r.summary ?? ""),
    paragraphs: Array.isArray(r.paragraphs) ? (r.paragraphs as string[]) : [],
    categories: Array.isArray(r.categories) ? (r.categories as string[]) : [],
    ageMin: num(r.age_min_months),
    ageMax: num(r.age_max_months),
    readingMinutes: num(r.reading_minutes),
    cover: (r.cover_key as string | null) ?? null,
    coverUrl: (r.cover_url as string | null) ?? null,
    coverSvg: (r.cover_svg as string | null) ?? null,
    status: r.status as StoryTab,
    source: r.source === "ai" ? "ai" : "editor",
    featured: !!r.featured,
    idea: (r.ai_idea as string | null) ?? null,
    createdAt: String(r.created_at),
    publishedAt: (r.published_at as string | null) ?? null,
  };
}

/** Përrallat sipas gjendjes: draftet e reja të parat; të publikuarat sipas datës së publikimit. */
export async function fetchAdminStories(tab: StoryTab): Promise<AdminStory[]> {
  const { data, error } = await supabase
    .from("stories")
    .select(STORY_COLUMNS)
    .eq("status", tab)
    .order(tab === "published" ? "published_at" : "created_at", { ascending: false, nullsFirst: false })
    .limit(80);
  fail(error);
  return ((data ?? []) as Record<string, unknown>[]).map(mapStory);
}

export async function fetchAdminStory(id: string): Promise<AdminStory | null> {
  const { data, error } = await supabase.from("stories").select(STORY_COLUMNS).eq("id", id).maybeSingle();
  fail(error);
  return data ? mapStory(data as Record<string, unknown>) : null;
}

/** Publikimi e nxjerr menjëherë te prindërit (data e publikimit vendoset vetë); arkivimi e heq pa e fshirë. */
export async function setStoryStatus(id: string, status: StoryTab): Promise<void> {
  const { error } = await supabase.from("stories").update({ status }).eq("id", id);
  fail(error);
}

export async function setStoryFeatured(id: string, featured: boolean): Promise<void> {
  const { error } = await supabase.from("stories").update({ featured }).eq("id", id);
  fail(error);
}

/** Paragrafët ndahen me një rresht bosh; koha e leximit llogaritet sërish. */
export function splitParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s*\n\s*/g, " ").trim())
    .filter(Boolean);
}

export function validateStoryText(v: { title: string; summary: string; paragraphs: string[] }): string | null {
  if (v.title.trim().length < 3 || v.title.trim().length > 80) return "Titulli duhet të ketë 3 deri në 80 shkronja.";
  if (!v.summary.trim() || v.summary.trim().length > 400) return "Përshkrimi duhet të ketë deri në 400 shkronja.";
  if (v.paragraphs.length < 1 || v.paragraphs.length > 200) return "Teksti duhet të ketë të paktën një paragraf.";
  return null;
}

export async function saveStoryText(id: string, v: { title: string; summary: string; paragraphs: string[] }): Promise<void> {
  const problem = validateStoryText(v);
  if (problem) throw new Error(problem);
  const { error } = await supabase
    .from("stories")
    .update({ title: v.title.trim(), summary: v.summary.trim(), paragraphs: v.paragraphs, reading_minutes: readingMinutes(v.paragraphs) })
    .eq("id", id);
  fail(error);
}

/**
 * "Shkruaj një tani": Claude nis përrallën në server (zgjat 1–2 minuta) dhe ajo del te draftet. Mesazhi i gabimit
 * thotë çfarë mungon, p.sh. çelësi i Anthropic te Supabase.
 */
export async function requestStoryDraft(idea: string): Promise<void> {
  const { error } = await supabase.functions.invoke("story-draft", { body: { idea: idea.trim().slice(0, 300) } });
  if (!error) return;
  if (error instanceof FunctionsHttpError) {
    const status = error.context?.status as number | undefined;
    const payload = (await error.context?.json?.().catch(() => null)) as { error?: string; limit?: number } | null;
    if (status === 404) throw new Error("Funksioni story-draft s'është publikuar ende te Supabase.");
    if (payload?.error === "not_configured") throw new Error("Mungon çelësi ANTHROPIC_API_KEY te Supabase → Edge Functions → Secrets.");
    if (payload?.error === "limit") throw new Error(`Sot u shkruan tashmë ${payload.limit ?? 5} përralla. Provoni nesër.`);
  }
  if (error instanceof FunctionsFetchError) throw new Error("S'ka lidhje me internetin.");
  throw new Error("Përralla s'u nis. Provoni përsëri pas pak.");
}

// ---- Recetat ----

export type RecipeTab = "draft" | "published" | "archived";
export type AdminRecipe = Recipe & { id: string; status: RecipeTab; createdAt: string; publishedAt: string | null };

const RECIPE_COLUMNS =
  "id, status, created_at, published_at, slug, title, summary, age_min_months, age_max_months, stage, feeding_style, meal_types, " +
  "prep_minutes, cook_minutes, yield_note, family_factor, ingredients, steps, serve_by_age, allergens, diet_tags, nutrients, " +
  "freezer_friendly, storage_note, freezer_note, reheat_note, choking_note, family_tip, season, is_albanian, cover_key, cover_url, " +
  "cover_svg, featured, sort_order, updated_at";

function mapRecipe(r: Record<string, unknown>): AdminRecipe {
  return {
    ...toRecipe(r as unknown as Parameters<typeof toRecipe>[0]),
    id: String(r.id),
    status: r.status as RecipeTab,
    createdAt: String(r.created_at),
    publishedAt: (r.published_at as string | null) ?? null,
  };
}

/** Recetat sipas gjendjes: draftet e reja të parat; të publikuarat sipas radhës së bibliotekës. */
export async function fetchAdminRecipes(tab: RecipeTab): Promise<AdminRecipe[]> {
  const { data, error } = await supabase
    .from("recipes")
    .select(RECIPE_COLUMNS)
    .eq("status", tab)
    .order(tab === "published" ? "sort_order" : "created_at", { ascending: tab === "published", nullsFirst: false })
    .limit(200);
  fail(error);
  return ((data ?? []) as unknown as Record<string, unknown>[]).map(mapRecipe);
}

export async function fetchAdminRecipe(id: string): Promise<AdminRecipe | null> {
  const { data, error } = await supabase.from("recipes").select(RECIPE_COLUMNS).eq("id", id).maybeSingle();
  fail(error);
  return data ? mapRecipe(data as unknown as Record<string, unknown>) : null;
}

/** Publikimi e nxjerr menjëherë te prindërit; arkivimi e heq pa e fshirë. */
export async function setRecipeStatus(id: string, status: RecipeTab): Promise<void> {
  const { error } = await supabase.from("recipes").update({ status }).eq("id", id);
  fail(error);
}

export async function setRecipeFeatured(id: string, featured: boolean): Promise<void> {
  const { error } = await supabase.from("recipes").update({ featured }).eq("id", id);
  fail(error);
}

export type RecipeText = { title: string; summary: string; steps: string[]; chokingNote: string; familyTip: string };

export function validateRecipeText(v: RecipeText): string | null {
  if (v.title.trim().length < 3 || v.title.trim().length > 120) return "Titulli duhet të ketë 3 deri në 120 shkronja.";
  if (v.summary.trim().length > 400) return "Përshkrimi duhet të ketë deri në 400 shkronja.";
  if (v.steps.length < 1 || v.steps.length > 40) return "Receta duhet të ketë të paktën një hap.";
  if (!v.chokingNote.trim()) return "Kujdesi ndaj mbytjes s'mund të mbetet bosh.";
  if (v.chokingNote.length > 600 || v.familyTip.length > 600) return "Shënimet duhet të kenë deri në 600 shkronja.";
  return null;
}

/** Titulli, përshkrimi, hapat (një për paragraf), kujdesi ndaj mbytjes dhe këshilla për familjen. */
export async function saveRecipeText(id: string, v: RecipeText): Promise<void> {
  const problem = validateRecipeText(v);
  if (problem) throw new Error(problem);
  const { error } = await supabase
    .from("recipes")
    .update({ title: v.title.trim(), summary: v.summary.trim(), steps: v.steps, choking_note: v.chokingNote.trim(), family_tip: v.familyTip.trim() })
    .eq("id", id);
  fail(error);
}
