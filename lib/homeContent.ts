import { IconName } from "@/components/ui/Icon";

/**
 * Shared commerce/content data model — seeded here for Home, and meant
 * to be the same shape the Shop module builds on next (so Home doesn't
 * need to be reworked when Shop lands). No backend yet: this is fixture
 * data standing in for what will eventually come from Supabase.
 */

export type ProductCategory = "feeding" | "diapering" | "sleep" | "bath" | "toys" | "health";

export type Product = {
  id: string;
  name: string;
  brand: string;
  price: number;
  compareAtPrice: number | null;
  category: ProductCategory;
  icon: IconName;
  accent: "olive" | "orange";
  rating: number; // 0-5
  badge: "new" | "sale" | "bestseller" | null;
  reviewCount?: number;
  imageUrl?: string | null; // foto reale nga Supabase Storage (produktet e admin panelit)
  // Opsionale: nëse s'jepen, ekrani i detajeve i llogarit vetë (produkte
  // të kategorisë së njëjtë) si rezervë.
  relatedIds?: string[];
  boughtWithIds?: string[];
  freeDelivery?: boolean;
  merchant?: string | null;
  stock?: number;
};

export type Review = {
  id: string;
  productId: string;
  author: string;
  rating: number; // 1-5
  date: string;
  comment: string;
};

export type Question = {
  id: string;
  productId: string;
  author: string;
  question: string;
  answer: string | null;
  date: string;
};

export type Brand = {
  id: string;
  name: string;
  tagline: string;
  icon: IconName;
  accent: "olive" | "orange";
  logoUrl?: string | null;
};

export type Article = {
  id: string;
  title: string;
  excerpt: string;
  body: string;
  readMins: number;
  kind: "article" | "tip";
  icon: IconName;
};

export type NotificationItem = {
  id: string;
  title: string;
  body: string;
  at: string;
  read: boolean;
  icon: IconName;
};

export const CATEGORY_META: Record<ProductCategory, { icon: IconName; labelKey: string }> = {
  feeding: { icon: "spoon", labelKey: "tile_feeding" },
  diapering: { icon: "baby", labelKey: "diaper_title" },
  sleep: { icon: "moon", labelKey: "tile_sleep" },
  bath: { icon: "bath", labelKey: "qa_bath" },
  toys: { icon: "play", labelKey: "cat_toys" },
  health: { icon: "shield", labelKey: "medical_screen_title" },
};

export const productCatalog: Product[] = [
  { id: "p1", name: "Shishe Anti-Kolik 260ml", brand: "PureBaby", price: 9.9, compareAtPrice: 12.9, category: "feeding", icon: "bath", accent: "orange", rating: 4.7, badge: "bestseller", reviewCount: 128, relatedIds: ["p2", "p11"], boughtWithIds: ["p2"] },
  { id: "p2", name: "Lugë Silikoni (Set 4)", brand: "TinyCare", price: 6.5, compareAtPrice: null, category: "feeding", icon: "spoon", accent: "orange", rating: 4.5, badge: null, reviewCount: 64 },
  { id: "p3", name: "Pelena Madhësia 3 (60cop)", brand: "SoftNest", price: 14.9, compareAtPrice: 17.9, category: "diapering", icon: "baby", accent: "orange", rating: 4.8, badge: "sale", reviewCount: 342, relatedIds: ["p4"], boughtWithIds: ["p4"] },
  { id: "p4", name: "Peceta të Lagura Sensitive", brand: "SoftNest", price: 3.9, compareAtPrice: null, category: "diapering", icon: "baby", accent: "orange", rating: 4.6, badge: null, reviewCount: 201 },
  { id: "p5", name: "Këllëf Gjumi Muslin", brand: "CloudSleep", price: 19.9, compareAtPrice: null, category: "sleep", icon: "moon", accent: "olive", rating: 4.9, badge: "new", reviewCount: 47, relatedIds: ["p6"], boughtWithIds: ["p6"] },
  { id: "p6", name: "Zhurmë e Bardhë Portative", brand: "CloudSleep", price: 24.9, compareAtPrice: 29.9, category: "sleep", icon: "moon", accent: "olive", rating: 4.4, badge: "sale", reviewCount: 89 },
  { id: "p7", name: "Shampo & Sapun 2-në-1", brand: "PureBaby", price: 7.9, compareAtPrice: null, category: "bath", icon: "bath", accent: "olive", rating: 4.6, badge: null, reviewCount: 112, boughtWithIds: ["p8"] },
  { id: "p8", name: "Peshqir Kapuç Bambu", brand: "PureBaby", price: 12.5, compareAtPrice: null, category: "bath", icon: "bath", accent: "olive", rating: 4.7, badge: "bestseller", reviewCount: 156 },
  { id: "p9", name: "Lodër Edukative Ngjyrash", brand: "TinyCare", price: 11.9, compareAtPrice: null, category: "toys", icon: "play", accent: "orange", rating: 4.3, badge: "new", reviewCount: 38, boughtWithIds: ["p10"] },
  { id: "p10", name: "Libër Kartoni \"Ngjyrat e Para\"", brand: "TinyCare", price: 5.9, compareAtPrice: null, category: "toys", icon: "play", accent: "orange", rating: 4.5, badge: null, reviewCount: 51 },
  { id: "p11", name: "Pika Vitaminë D 400IU", brand: "MedNest", price: 6.9, compareAtPrice: null, category: "health", icon: "droplet", accent: "olive", rating: 4.8, badge: "bestseller", reviewCount: 203, relatedIds: ["p12"] },
  { id: "p12", name: "Termometër Ballor Dixhital", brand: "MedNest", price: 16.9, compareAtPrice: 21.9, category: "health", icon: "shield", accent: "olive", rating: 4.6, badge: "sale", reviewCount: 97, relatedIds: ["p11"] },
];

export const brandCatalog: Brand[] = [
  { id: "b1", name: "PureBaby", tagline: "Kujdes i butë natyral", icon: "droplet", accent: "olive" },
  { id: "b2", name: "SoftNest", tagline: "Rehati për çdo ditë", icon: "baby", accent: "orange" },
  { id: "b3", name: "CloudSleep", tagline: "Gjumë i qetë", icon: "moon", accent: "olive" },
  { id: "b4", name: "TinyCare", tagline: "Zbulim e lojë", icon: "play", accent: "orange" },
  { id: "b5", name: "MedNest", tagline: "Shëndet i besueshëm", icon: "shield", accent: "olive" },
];

export const articleCatalog: Article[] = [
  {
    id: "a1", kind: "article", icon: "spoon", readMins: 4,
    title: "Kur të fillojmë ushqimin e ngurtë?",
    excerpt: "Shenjat që tregojnë se bebi juaj është gati për ushqimet e para të ngurta.",
    body: "Shumica e bebeve janë gati për ushqim të ngurtë rreth muajit të 6-të. Shenjat kryesore: mban kokën vetë, ulet me pak mbështetje, tregon interes për ushqimin, dhe reflexi i shtytjes së gjuhës është zvogëluar. Filloni me pure të holla një herë në ditë dhe rrisni gradualisht.",
  },
  {
    id: "a2", kind: "article", icon: "moon", readMins: 6,
    title: "Rutina e gjumit për 0-6 muaj",
    excerpt: "Si të krijoni një orar gjumi që funksionon për të gjithë familjen.",
    body: "Një rutinë e qëndrueshme para gjumit (banjë, histori, ninullë) ndihmon bebin të njohë kohën e gjumit. Mbani dhomën të errët dhe të freskët, dhe përpiquni të vendosni bebin në shtrat kur është i përgjumur por zgjuar.",
  },
  {
    id: "a3", kind: "tip", icon: "sparkle", readMins: 2,
    title: "Truk i shpejtë: gazrat pas ushqyerjes",
    excerpt: "Mbani bebin vertikalisht 15-20 minuta pas çdo ushqyerjeje.",
    body: "Kjo ndihmon në lëshimin e ajrit të gëlltitur gjatë ushqyerjes dhe redukton shqetësimin. Një prekje e lehtë në shpinë mund të përshpejtojë procesin.",
  },
  {
    id: "a4", kind: "tip", icon: "droplet", readMins: 2,
    title: "Lëkura e thatë në dimër",
    excerpt: "Përdorni krem pa parfum menjëherë pas banjës për ta mbyllur lagështinë.",
    body: "Lëkura e bebeve humb lagështinë shpejt. Banjë të shkurtra me ujë të vakët (jo të nxehtë) dhe krem menjëherë pas thahen ndihmojnë shumë gjatë muajve të ftohtë.",
  },
  {
    id: "a5", kind: "article", icon: "shield", readMins: 5,
    title: "Çfarë të bëni kur bebi ka temperaturë",
    excerpt: "Udhëzime praktike dhe kur duhet të telefononi mjekun.",
    body: "Për bebe nën 3 muaj, çdo temperaturë mbi 38°C kërkon vëmendje mjekësore të menjëhershme. Për bebet më të mëdha, monitoroni sjelljen përgjithshme — ushqyerja, hidratimi dhe niveli i energjisë janë tregues po aq të rëndësishëm sa vetë numri.",
  },
];

export const reviewCatalog: Review[] = [
  { id: "r1", productId: "p1", author: "Elira B.", rating: 5, date: "2026-06-02", comment: "Bebi ime s'ka pasur fare kolik që kur filluam ta përdorim. E rekomandoj shumë." },
  { id: "r2", productId: "p1", author: "Blerim K.", rating: 4, date: "2026-05-20", comment: "E mirë, por pak e ngadaltë për t'u pastruar." },
  { id: "r3", productId: "p3", author: "Vjosa R.", rating: 5, date: "2026-06-10", comment: "Absorbim shumë i mirë gjatë natës, pa rrjedhje." },
  { id: "r4", productId: "p3", author: "Driton M.", rating: 5, date: "2026-05-28", comment: "Cilësi e shkëlqyer për çmimin, do blejmë sërish." },
  { id: "r5", productId: "p5", author: "Arta S.", rating: 5, date: "2026-06-15", comment: "Tepër e butë, bebi fle shumë më mirë me këtë këllëf." },
  { id: "r6", productId: "p9", author: "Fitim H.", rating: 4, date: "2026-05-30", comment: "Ngjyra tërheqin vëmendjen e fëmijës menjëherë." },
];

export const questionCatalog: Question[] = [
  { id: "q1", productId: "p1", author: "Nita", question: "A është pa BPA?", answer: "Po, plotësisht pa BPA dhe pa ftalate.", date: "2026-06-01" },
  { id: "q2", productId: "p1", author: "Ergys", question: "Përshtatet me sterilizues me avull?", answer: "Po, të gjitha pjesët janë të sigurta për sterilizim me avull.", date: "2026-05-25" },
  { id: "q3", productId: "p3", author: "Leutrim", question: "Ka aromë?", answer: "Jo, janë plotësisht pa aromë.", date: "2026-06-08" },
  { id: "q4", productId: "p9", author: "Diana", question: "Për çfarë moshe rekomandohet?", answer: null, date: "2026-06-20" },
];

export const initialNotifications: NotificationItem[] = [
  {
    id: "n1", icon: "syringe", read: false, at: new Date(Date.now() - 3 * 3600000).toISOString(),
    title: "Vaksina po afron", body: "DTaP (doza 2) është planifikuar për javën e ardhshme.",
  },
  {
    id: "n2", icon: "spoon", read: false, at: new Date(Date.now() - 26 * 3600000).toISOString(),
    title: "Koha e ushqyerjes", body: "Ka kaluar 3 orë nga ushqyerja e fundit e regjistruar.",
  },
  {
    id: "n3", icon: "sparkle", read: true, at: new Date(Date.now() - 3 * 86400000).toISOString(),
    title: "Ofertë e re", body: "-15% te produktet e gjumit këtë javë.",
  },
];