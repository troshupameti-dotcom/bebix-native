import { Image } from "react-native";
import type { CommunityComment, CommunityPost, FeedOptions } from "@/lib/communityData";

/**
 * Postimet shembull të mënyrës së fotografimit (lib/demo/screenshotMode.ts): profile të trilluara, me këshilla
 * të sakta, që fotot e app-it për rrjetet sociale të mos tregojnë emra të vërtetë apo postime provë.
 * Shfaqen vetëm në zhvillim dhe s'shkruhen kurrë në bazë.
 */

/** Emri i prindit në fotot (inicialja lart djathtas te Komuniteti). */
export const DEMO_PARENT_NAME = "Arbëresha";

const DEMO_PREFIX = "demo-";
export const isDemoId = (id: string | null | undefined) => !!id && id.startsWith(DEMO_PREFIX);

type DemoPost = Omit<CommunityPost, "at" | "media" | "liked" | "saved"> & { minutesAgo: number; photo?: number };

const expert = (key: string, name: string, specialty: string) => ({
  authorId: `${DEMO_PREFIX}author-${key}`,
  authorName: name,
  authorInitial: name.replace(/^Dr\.\s*/, "").charAt(0),
  authorIsExpert: true,
  authorSpecialty: specialty,
  icon: "shield" as const,
});
const parent = (key: string, name: string) => ({
  authorId: `${DEMO_PREFIX}author-${key}`,
  authorName: name,
  authorInitial: name.charAt(0),
  authorIsExpert: false,
  authorSpecialty: null,
  icon: "sparkle" as const,
});

const POSTS: DemoPost[] = [
  {
    id: `${DEMO_PREFIX}psikologia`,
    ...expert("psikologia", "Dr. Elira Kastrati", "psychologist"),
    accent: "olive",
    kind: "text",
    tag: null,
    groupId: null,
    groupName: null,
    minutesAgo: 35,
    likeCount: 128,
    commentCount: 24,
    text:
      "Bebja nuk ka nevojë për prindër të përsosur, por për prindër të pranishëm.\n\n" +
      "Kur e merrni në krah sa herë qan, ajo nuk llastohet: mëson se bota është e sigurt dhe se dikush i përgjigjet. " +
      "Kjo siguri është themeli i vetëbesimit të saj më vonë.\n\n" +
      "Kujdesuni edhe për veten. Lodhja, lotët dhe pasiguria në muajt e parë janë normale. Nëse trishtimi zgjat më shumë " +
      "se dy javë, flisni me mjekun tuaj: nuk jeni vetëm.",
  },
  {
    id: `${DEMO_PREFIX}nutricionistja`,
    ...expert("nutricionistja", "Blerta Zeqiri", "nutritionist"),
    accent: "olive",
    kind: "text",
    tag: "#ushqimingurte",
    groupId: null,
    groupName: null,
    minutesAgo: 120,
    likeCount: 214,
    commentCount: 37,
    photo: require("@/assets/images/demo/nutritionist-breakfast.jpg"),
    text:
      "Mëngjes i shpejtë për fëmijët 1–3 vjeç: jogurt me tërshërë dhe fruta pylli.\n\n" +
      "Për një porcion:\n" +
      "• 4 lugë jogurt natyral pa sheqer\n" +
      "• 2 lugë tërshërë e imët, e lagur 5 minuta me pak qumësht\n" +
      "• Një grusht fruta pylli (mjedra, boronica, manaferra)\n" +
      "• Pak kanellë, pa sheqer të shtuar\n\n" +
      "Përzieni dhe shërbejeni menjëherë. Jogurti sjell kalcium dhe proteina, tërshëra fibra, frutat vitaminë C.\n\n" +
      "Kujdes: boronicat dhe kokrrat e tjera të rrumbullakëta pritini në gjysmë ose shtypini me pirun deri në moshën 4 vjeç.",
  },
  {
    id: `${DEMO_PREFIX}dhembi`,
    ...parent("teuta", "Teuta Sopi"),
    accent: "olive",
    kind: "text",
    tag: null,
    groupId: null,
    groupName: null,
    minutesAgo: 190,
    likeCount: 56,
    commentCount: 18,
    text:
      "Lirit sot i doli dhëmbi i parë! Natën e kaloi pak më i shqetësuar, por unaza e ftohtë e dhëmbëzimit e qetësoi shumë. " +
      "Juve çfarë ju ka ndihmuar më shumë?",
  },
  {
    id: `${DEMO_PREFIX}pediatri`,
    ...expert("pediatri", "Dr. Arben Dervishi", "pediatrician"),
    accent: "olive",
    kind: "text",
    tag: "#gjumiibebit",
    groupId: null,
    groupName: null,
    minutesAgo: 310,
    likeCount: 342,
    commentCount: 41,
    text:
      "Gjumi i sigurt deri në moshën 1 vjeç, katër rregulla të thjeshta:\n\n" +
      "1. Bebja fle gjithmonë në shpinë.\n" +
      "2. Në dyshek të fortë e të rrafshët, pa jastëk, batanije të trasha apo lodra.\n" +
      "3. Në dhomën tuaj, por në krevatin e vet, të paktën gjatë 6 muajve të parë.\n" +
      "4. Dhoma e freskët (16–20 °C) dhe pa tym duhani.\n\n" +
      "Këto ulin ndjeshëm rrezikun e vdekjes së papritur të foshnjës.",
  },
  {
    id: `${DEMO_PREFIX}gjumi`,
    ...parent("dreni", "Dren Bytyqi"),
    accent: "olive",
    kind: "text",
    tag: "#gjumiibebit",
    groupId: null,
    groupName: null,
    minutesAgo: 480,
    likeCount: 97,
    commentCount: 15,
    text:
      "Nata e parë që Ema fjeti 6 orë rresht! Rutina e mbrëmjes po funksionon: banjë e ngrohtë, përrallë, dritë e zbehtë " +
      "dhe gjithmonë e njëjta orë. Faleminderit për këshillat këtu.",
  },
  {
    id: `${DEMO_PREFIX}gjidhenia`,
    ...expert("gjidhenia", "Valbona Shala", "lactation"),
    accent: "olive",
    kind: "text",
    tag: null,
    groupId: null,
    groupName: null,
    minutesAgo: 1500,
    likeCount: 176,
    commentCount: 29,
    text:
      "Gjidhënia nuk duhet të dhembë. Nëse ndjeni dhimbje gjatë gjithë ushqyerjes, zakonisht bebja nuk e ka kapur mirë gjirin.\n\n" +
      "Afrojeni bebin te gjiri (jo gjirin te bebja): mjekra prek gjirin, goja e hapur gjerë, buzët të kthyera nga jashtë. " +
      "Nëse dhimbja vazhdon, kërkoni ndihmën e një konsulenteje gjidhënieje: zakonisht zgjidhet shpejt.",
  },
  {
    id: `${DEMO_PREFIX}binjaket`,
    ...parent("fjolla", "Fjolla Rexhepi"),
    accent: "olive",
    kind: "text",
    tag: "#binjaket",
    groupId: null,
    groupName: null,
    minutesAgo: 2900,
    likeCount: 64,
    commentCount: 22,
    text:
      "Mami binjakësh këtu. Si ia dilni me ushqyerjen e natës? Ne i zgjojmë të dy njëherësh dhe na është lehtësuar shumë.",
  },
];

const COMMENTS: Record<string, { author: string; minutesAgo: number; text: string; expert?: string }[]> = {
  [`${DEMO_PREFIX}nutricionistja`]: [
    { author: "Teuta Sopi", minutesAgo: 95, text: "E provuam sot në mëngjes dhe Liri e hëngri të gjithën. Faleminderit!" },
    { author: "Dren Bytyqi", minutesAgo: 80, text: "A mund ta bëj me jogurt greku?" },
    { author: "Blerta Zeqiri", minutesAgo: 70, text: "Po, vetëm pa sheqer dhe pa aroma. Nëse është shumë i trashë, holloni me pak qumësht.", expert: "nutritionist" },
  ],
  [`${DEMO_PREFIX}pediatri`]: [
    { author: "Fjolla Rexhepi", minutesAgo: 290, text: "Po mbështjellja me pelenë (swaddle), deri kur lejohet?" },
    {
      author: "Dr. Arben Dervishi",
      minutesAgo: 270,
      text: "Ndaloni sapo bebja nis të provojë të kthehet në bark, zakonisht rreth muajit të dytë ose të tretë.",
      expert: "pediatrician",
    },
  ],
  [`${DEMO_PREFIX}psikologia`]: [
    { author: "Teuta Sopi", minutesAgo: 20, text: "Kisha nevojë ta lexoja këtë sot." },
  ],
};

const ago = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

function photoUrl(asset: number): string {
  try {
    return Image.resolveAssetSource(asset)?.uri ?? "";
  } catch {
    return "";
  }
}

function toPost(p: DemoPost): CommunityPost {
  const { minutesAgo, photo, ...rest } = p;
  return {
    ...rest,
    at: ago(minutesAgo),
    liked: false,
    saved: false,
    media: photo ? [{ path: "demo/nutritionist-breakfast.jpg", type: "image", width: 1080, height: 1080, url: photoUrl(photo) }] : [],
  };
}

/** Si `fetchFeed`, me filtrat e skedave, temës dhe kërkimit. Një faqe e vetme. */
export function demoFeed(options: FeedOptions = {}): CommunityPost[] {
  if (options.before) return [];
  const tab = options.tab ?? "all";
  const q = (options.query ?? "").trim().toLowerCase();
  return POSTS.filter((p) => {
    if (tab === "experts" && (!p.authorIsExpert || (options.specialty && p.authorSpecialty !== options.specialty))) return false;
    if (tab === "following" && !p.authorIsExpert) return false;
    if (tab === "age" && p.authorIsExpert) return false;
    if (options.topic && p.tag !== options.topic) return false;
    if (q && !`${p.text} ${p.tag ?? ""} ${p.authorName}`.toLowerCase().includes(q)) return false;
    return true;
  }).map(toPost);
}

export function demoPost(id: string): CommunityPost | null {
  const p = POSTS.find((x) => x.id === id);
  return p ? toPost(p) : null;
}

export function demoPostsByAuthor(authorId: string): CommunityPost[] {
  return POSTS.filter((p) => p.authorId === authorId).map(toPost);
}

export function demoComments(postId: string): CommunityComment[] {
  return (COMMENTS[postId] ?? []).map((c, i) => ({
    id: `${postId}-c${i}`,
    postId,
    authorId: `${DEMO_PREFIX}comment-${i}`,
    authorName: c.author,
    parentId: null,
    text: c.text,
    at: ago(c.minutesAgo),
    expert: c.expert ? { kind: "doctor", specialty: c.expert } : null,
  }));
}

/** Postimi më i ri shembull: që pilula "Postime të reja" të mos dalë në foto. */
export function demoNewestAt(): string {
  return ago(Math.min(...POSTS.map((p) => p.minutesAgo)));
}
