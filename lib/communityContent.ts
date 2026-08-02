import { IconName } from "@/components/ui/Icon";

/**
 * Fixture data for the Community module — same pattern as homeContent.ts
 * for Shop. No backend yet: real posts/comments/messages from OTHER
 * users need Supabase tables + RLS before this can be a real network.
 * This file is what lets the UI be fully built and tested today.
 */

// ---------------------------------------------------------------------
// Stories
// ---------------------------------------------------------------------

export type Story = {
  id: string;
  authorName: string;
  authorInitial: string;
  accent: "olive" | "orange";
  seen: boolean;
  isOwn?: boolean;
};

export const storyCatalog: Story[] = [
  { id: "s0", authorName: "Ti", authorInitial: "T", accent: "olive", seen: false, isOwn: true },
  { id: "s1", authorName: "Elira", authorInitial: "E", accent: "orange", seen: false },
  { id: "s2", authorName: "Blerim", authorInitial: "B", accent: "olive", seen: false },
  { id: "s3", authorName: "Vjosa", authorInitial: "V", accent: "orange", seen: true },
  { id: "s4", authorName: "Driton", authorInitial: "D", accent: "olive", seen: true },
  { id: "s5", authorName: "Arta", authorInitial: "A", accent: "orange", seen: true },
];

// ---------------------------------------------------------------------
// Trending topics / hashtags
// ---------------------------------------------------------------------

export type Topic = {
  id: string;
  label: string;
  postCount: number;
};

export const topicCatalog: Topic[] = [
  { id: "t1", label: "#gjumiibebit", postCount: 342 },
  { id: "t2", label: "#ushqimingurte", postCount: 289 },
  { id: "t3", label: "#binjaket", postCount: 74 },
  { id: "t4", label: "#kolikat", postCount: 156 },
  { id: "t5", label: "#pordheshtieparë", postCount: 98 },
];

// ---------------------------------------------------------------------
// Experts
// ---------------------------------------------------------------------

export type ExpertKind = "Pediatër" | "Nutricionist" | "Konsulente Gjidhënieje" | "Psikolog Fëmijësh" | "Trajner Gjumi";

export type Expert = {
  id: string;
  name: string;
  kind: ExpertKind;
  bio: string;
  experienceYears: number;
  languages: string[];
  rating: number;
  reviewCount: number;
  icon: IconName;
  accent: "olive" | "orange";
};

export const expertCatalog: Expert[] = [
  { id: "e1", name: "Dr. Arta Elezi", kind: "Pediatër", bio: "Pediatre me fokus te zhvillimi i foshnjave 0-2 vjeç.", experienceYears: 14, languages: ["Shqip", "Anglisht"], rating: 4.9, reviewCount: 231, icon: "shield", accent: "olive" },
  { id: "e2", name: "Fitore Krasniqi", kind: "Konsulente Gjidhënieje", bio: "Ndihmon nënat me sfida të gjidhënies që në ditët e para.", experienceYears: 8, languages: ["Shqip"], rating: 4.8, reviewCount: 145, icon: "droplet", accent: "orange" },
  { id: "e3", name: "Dr. Besnik Hoti", kind: "Trajner Gjumi", bio: "Specializuar në rutina gjumi për foshnja dhe fëmijë të vegjël.", experienceYears: 10, languages: ["Shqip", "Gjermanisht"], rating: 4.7, reviewCount: 98, icon: "moon", accent: "olive" },
  { id: "e4", name: "Vlora Berisha", kind: "Nutricionist", bio: "Këshillon për ushqimin e ngurtë dhe zakonet e shëndetshme ushqimore.", experienceYears: 6, languages: ["Shqip", "Anglisht"], rating: 4.6, reviewCount: 67, icon: "spoon", accent: "orange" },
];

// ---------------------------------------------------------------------
// Groups
// ---------------------------------------------------------------------

export type Group = {
  id: string;
  name: string;
  description: string;
  memberCount: number;
  icon: IconName;
  accent: "olive" | "orange";
};

export const groupCatalog: Group[] = [
  { id: "g1", name: "Prindër të Foshnjave të Reja", description: "Mbështetje për 0-3 muajt e parë.", memberCount: 4821, icon: "baby", accent: "orange" },
  { id: "g2", name: "Gjidhënia", description: "Këshilla dhe përvoja rreth gjidhënies.", memberCount: 3120, icon: "droplet", accent: "olive" },
  { id: "g3", name: "Gjumi i Bebit", description: "Rutina, sfida dhe zgjidhje gjumi.", memberCount: 2654, icon: "moon", accent: "olive" },
  { id: "g4", name: "Binjakët", description: "Komunitet për prindër me binjakë/treshe.", memberCount: 612, icon: "family", accent: "orange" },
  { id: "g5", name: "Foshnja të Parakohshme", description: "Përvoja dhe mbështetje mjekësore.", memberCount: 489, icon: "shield", accent: "olive" },
  { id: "g6", name: "Prindër në Prishtinë", description: "Grup lokal — takime, këmbime, ngjarje.", memberCount: 1893, icon: "globe", accent: "orange" },
];

// ---------------------------------------------------------------------
// Posts + Comments
// ---------------------------------------------------------------------

export type PostKind = "text" | "question" | "poll" | "milestone" | "review";

export type Comment = {
  id: string;
  postId: string;
  author: string;
  text: string;
  at: string;
  parentId: string | null; // null = koment kryesor, jo-null = përgjigje
};

export type Post = {
  id: string;
  authorName: string;
  authorInitial: string;
  authorIsExpert: boolean;
  accent: "olive" | "orange";
  kind: PostKind;
  text: string;
  tag: string | null;
  icon: IconName;
  at: string;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  groupName: string | null;
};

export const postCatalog: Post[] = [
  {
    id: "p1", authorName: "Elira B.", authorInitial: "E", authorIsExpert: false, accent: "orange",
    kind: "milestone", text: "Sot bëri hapat e parë vetëm! 10 muaj e 2 javë. Zemra ime plasi nga lumturia 🥹",
    tag: "#hapatiparë", icon: "sparkle", at: new Date(Date.now() - 2 * 3600000).toISOString(),
    likeCount: 214, commentCount: 38, shareCount: 12, groupName: null,
  },
  {
    id: "p2", authorName: "Dr. Arta Elezi", authorInitial: "A", authorIsExpert: true, accent: "olive",
    kind: "text", text: "Kujtesë: nëse bebi juaj është nën 3 muaj dhe ka temperaturë mbi 38°C, telefononi mjekun menjëherë — mos prisni.",
    tag: "#shëndeti", icon: "shield", at: new Date(Date.now() - 5 * 3600000).toISOString(),
    likeCount: 512, commentCount: 44, shareCount: 89, groupName: null,
  },
  {
    id: "p3", authorName: "Blerim K.", authorInitial: "B", authorIsExpert: false, accent: "olive",
    kind: "question", text: "Bebi 6 muajsh refuzon çdo pure perimesh, pranon vetëm frutat. Normale apo duhet të shqetësohem?",
    tag: "#ushqimingurte", icon: "spoon", at: new Date(Date.now() - 8 * 3600000).toISOString(),
    likeCount: 45, commentCount: 61, shareCount: 3, groupName: "Prindër të Foshnjave të Reja",
  },
  {
    id: "p4", authorName: "Vjosa R.", authorInitial: "V", authorIsExpert: false, accent: "orange",
    kind: "review", text: "Blemë këllëfin e gjumit muslin nga dyqani — ndryshim i madh, bebi fle 2 orë më shumë natën!",
    tag: "#gjumiibebit", icon: "moon", at: new Date(Date.now() - 26 * 3600000).toISOString(),
    likeCount: 98, commentCount: 15, shareCount: 22, groupName: "Gjumi i Bebit",
  },
  {
    id: "p5", authorName: "Driton M.", authorInitial: "D", authorIsExpert: false, accent: "olive",
    kind: "text", text: "Dy javë pa gjumë me binjakët — ju që keni kaluar këtë, si e menaxhuat rutinën e natës?",
    tag: "#binjaket", icon: "family", at: new Date(Date.now() - 30 * 3600000).toISOString(),
    likeCount: 67, commentCount: 29, shareCount: 5, groupName: "Binjakët",
  },
];

export const commentCatalog: Comment[] = [
  { id: "c1", postId: "p1", author: "Fitore K.", text: "Urime! Momenti më i bukur ❤️", at: new Date(Date.now() - 1.5 * 3600000).toISOString(), parentId: null },
  { id: "c2", postId: "p1", author: "Arta S.", text: "Sa e bukur, na vjen dhe neve ndonjë ditë!", at: new Date(Date.now() - 1 * 3600000).toISOString(), parentId: null },
  { id: "c3", postId: "p1", author: "Elira B.", text: "Faleminderit! 🥰", at: new Date(Date.now() - 0.8 * 3600000).toISOString(), parentId: "c2" },
  { id: "c4", postId: "p3", author: "Dr. Arta Elezi", text: "Krejt normale në këtë moshë — vazhdoni t'ia ofroni perimet pa presion, shija zhvillohet gradualisht.", at: new Date(Date.now() - 7 * 3600000).toISOString(), parentId: null },
  { id: "c5", postId: "p3", author: "Blerim K.", text: "Faleminderit doktoreshë, kjo më qetësoi shumë!", at: new Date(Date.now() - 6.5 * 3600000).toISOString(), parentId: "c4" },
];

// ---------------------------------------------------------------------
// Parenting tips (Home section)
// ---------------------------------------------------------------------

export type CommunityTip = {
  id: string;
  title: string;
  body: string;
  icon: IconName;
};

export const communityTipCatalog: CommunityTip[] = [
  { id: "ct1", title: "Koha e ekranit", body: "Për foshnja nën 18 muaj, ekspertët rekomandojnë sa më pak kohë ekrani, përveç video-thirrjeve familjare.", icon: "sparkle" },
  { id: "ct2", title: "Loja e përbashkët", body: "10 minuta lojë e fokusuar në dysheme, pa telefon, forcon lidhjen prind-fëmijë më shumë se orë të tëra pranë njëri-tjetrit të shpërqendruar.", icon: "play" },
];