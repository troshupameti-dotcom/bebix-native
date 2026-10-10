import { supabase } from "@/lib/supabase/client";
import { IconName } from "@/components/ui/Icon";
import {
  uploadPostMedia,
  removePostMedia,
  withUrls,
  type LocalMedia,
  type PostMedia,
  type StoredMedia,
} from "@/lib/community/media";
import { sanitizeSearch } from "@/lib/community/feedFilters";
import { expertPhotoUrl } from "@/lib/community/expertPhoto";

export type Accent = "olive" | "orange";

export type CommunityGroup = {
  id: string;
  name: string;
  description: string;
  icon: IconName;
  accent: Accent;
  memberCount: number;
  joined: boolean;
};

export type CommunityExpert = {
  id: string;
  userId: string | null;
  name: string;
  /** Teksti i lirë i specializimit (e vjetra); emri i repartit del nga `specialty`. */
  kind: string;
  /** Çelësi i repartit (pediatrician, orthopedist, ...), null kur s'është caktuar ende. */
  specialty: string | null;
  /** URL e fotos së profilit (zgjedhur nga eksperti), null kur s'ka. */
  photoUrl: string | null;
  bio: string;
  experienceYears: number;
  languages: string[];
  rating: number;
  reviewCount: number;
  icon: IconName;
  accent: Accent;
  followed: boolean;
};

export type CommunityTopic = {
  id: string;
  label: string;
  postCount: number;
};

export type CommunityTip = {
  id: string;
  title: string;
  body: string;
  icon: IconName;
};

export type CommunityPost = {
  id: string;
  authorId: string;
  authorName: string;
  authorInitial: string;
  authorIsExpert: boolean;
  /** Reparti i autorit kur është ekspert (nga pamja `community_feed`, pas migrimit të repartave). */
  authorSpecialty: string | null;
  accent: Accent;
  kind: string;
  text: string;
  tag: string | null;
  icon: IconName;
  groupId: string | null;
  groupName: string | null;
  at: string;
  likeCount: number;
  commentCount: number;
  liked: boolean;
  saved: boolean;
  media: PostMedia[];
};

export type CommentExpert = { kind: string; specialty: string | null };

export type CommunityComment = {
  id: string;
  postId: string;
  authorId: string;
  authorName: string;
  parentId: string | null;
  text: string;
  at: string;
  /** Kur autori i komentit është ekspert i verifikuar (përgjigjet e mjekëve duhet të dallohen). */
  expert: CommentExpert | null;
};

export async function getCurrentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

// ---------------------------------------------------------------------
// Grupet
// ---------------------------------------------------------------------

export async function fetchGroups(): Promise<CommunityGroup[]> {
  const uid = await getCurrentUserId();
  const { data: groups, error } = await supabase
    .from("community_groups")
    .select("id,name,description,icon,accent,member_count")
    .order("name");
  if (error) throw error;

  let joinedIds = new Set<string>();
  if (uid) {
    const { data: mine } = await supabase.from("community_group_members").select("group_id").eq("user_id", uid);
    joinedIds = new Set((mine ?? []).map((m) => m.group_id));
  }

  return (groups ?? []).map((g: any) => ({
    id: g.id,
    name: g.name,
    description: g.description,
    icon: g.icon,
    accent: g.accent,
    memberCount: g.member_count ?? 0,
    joined: joinedIds.has(g.id),
  }));
}

export async function fetchGroupById(id: string): Promise<CommunityGroup | null> {
  const uid = await getCurrentUserId();
  const { data, error } = await supabase
    .from("community_groups")
    .select("id,name,description,icon,accent,member_count")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  let joined = false;
  if (uid) {
    const { data: m } = await supabase
      .from("community_group_members")
      .select("group_id")
      .eq("group_id", id)
      .eq("user_id", uid)
      .maybeSingle();
    joined = !!m;
  }

  return {
    id: data.id,
    name: data.name,
    description: data.description,
    icon: data.icon,
    accent: data.accent,
    memberCount: (data as any).member_count ?? 0,
    joined,
  };
}

export async function toggleJoinGroup(groupId: string, joined: boolean) {
  const uid = await getCurrentUserId();
  if (!uid) throw new Error("Duhet të jesh i kyçur.");
  if (joined) {
    const { error } = await supabase.from("community_group_members").delete().eq("group_id", groupId).eq("user_id", uid);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("community_group_members").insert({ group_id: groupId, user_id: uid });
    if (error) throw error;
  }
}

// ---------------------------------------------------------------------
// Ekspertët
// ---------------------------------------------------------------------

function mapExpert(e: any, followed: boolean): CommunityExpert {
  return {
    id: e.id,
    userId: e.user_id,
    name: e.name,
    kind: e.kind,
    // Kolona ekziston pas migrimit të repartave; para tij mungon dhe eksperti del me tekstin e lirë.
    specialty: e.specialty_key ?? null,
    photoUrl: expertPhotoUrl(e.photo_path),
    bio: e.bio,
    experienceYears: e.experience_years,
    languages: e.languages ?? [],
    rating: Number(e.rating),
    reviewCount: e.review_count,
    icon: e.icon,
    accent: e.accent,
    followed,
  };
}

export async function fetchExperts(): Promise<CommunityExpert[]> {
  const uid = await getCurrentUserId();
  const { data, error } = await supabase.from("community_experts").select("*").order("rating", { ascending: false });
  if (error) throw error;

  let followedIds = new Set<string>();
  if (uid) {
    const { data: mine } = await supabase.from("community_expert_follows").select("expert_id").eq("user_id", uid);
    followedIds = new Set((mine ?? []).map((m) => m.expert_id));
  }

  return (data ?? []).map((e: any) => mapExpert(e, followedIds.has(e.id)));
}

export async function fetchExpertById(id: string): Promise<CommunityExpert | null> {
  const uid = await getCurrentUserId();
  const { data, error } = await supabase.from("community_experts").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) return null;

  let followed = false;
  if (uid) {
    const { data: f } = await supabase
      .from("community_expert_follows")
      .select("expert_id")
      .eq("expert_id", id)
      .eq("user_id", uid)
      .maybeSingle();
    followed = !!f;
  }

  return mapExpert(data, followed);
}

export async function toggleFollowExpert(expertId: string, followed: boolean) {
  const uid = await getCurrentUserId();
  if (!uid) throw new Error("Duhet të jesh i kyçur.");
  if (followed) {
    const { error } = await supabase.from("community_expert_follows").delete().eq("expert_id", expertId).eq("user_id", uid);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("community_expert_follows").insert({ expert_id: expertId, user_id: uid });
    if (error) throw error;
  }
}

// ---------------------------------------------------------------------
// Temat dhe këshillat (përmbajtje e menaxhuar nga admini)
// ---------------------------------------------------------------------

export async function fetchTopics(): Promise<CommunityTopic[]> {
  const { data, error } = await supabase.from("community_topics_with_counts").select("*");
  if (error) throw error;
  return (data ?? []).map((t: any) => ({ id: t.id, label: t.label, postCount: t.post_count }));
}

export async function fetchTips(): Promise<CommunityTip[]> {
  const { data, error } = await supabase.from("community_tips").select("*").order("sort_order");
  if (error) throw error;
  return (data ?? []).map((t: any) => ({ id: t.id, title: t.title, body: t.body, icon: t.icon }));
}

// ---------------------------------------------------------------------
// Postimet
// ---------------------------------------------------------------------

function mapFeedRow(p: any, likedIds: Set<string>, savedIds: Set<string>): CommunityPost {
  return {
    id: p.id,
    authorId: p.author_id,
    authorName: p.author_name,
    authorInitial: p.author_initial,
    authorIsExpert: p.author_is_expert,
    authorSpecialty: p.author_specialty ?? null,
    accent: p.accent,
    kind: p.kind,
    text: p.text,
    tag: p.tag,
    icon: p.icon,
    groupId: p.group_id,
    groupName: p.group_name,
    at: p.created_at,
    likeCount: p.like_count,
    commentCount: p.comment_count,
    liked: likedIds.has(p.id),
    saved: savedIds.has(p.id),
    media: withUrls(p.media as StoredMedia[] | null),
  };
}

/** Sa postime lexohen njëherësh; të tjerat vijnë kur prindi zbret poshtë. */
export const FEED_PAGE_SIZE = 20;

/**
 * Një faqe e rrjedhës, nga më i riu. `before` = `at` i postimit të fundit
 * të faqes së mëparshme (faqosje sipas kohës, jo sipas numrit: një postim
 * i ri në krye s'e zhvendos faqen tjetër dhe s'sjell dublikata).
 *
 * Më parë lexohej e gjithë rrjedha dhe të gjitha pëlqimet e ruajtjet e
 * përdoruesit — me mijëra postime, ekrani hapej gjithnjë e më ngadalë.
 */
export type FeedTab = "all" | "experts" | "following";

export type FeedOptions = {
  before?: string;
  limit?: number;
  /** "all" = për ty, "experts" = vetëm postimet e ekspertëve, "following" = ekspertët që ndjek dhe grupet ku je anëtar. */
  tab?: FeedTab;
  topic?: string | null;
  /** Kërkim te teksti, tema dhe autori — te serveri, mes të gjitha postimeve (jo vetëm atyre të ngarkuara). */
  query?: string;
  /** Reparti i ekspertit (vetëm me tab "experts", dhe vetëm pas migrimit të repartave). */
  specialty?: string | null;
};

/** Autorët (ekspertët) dhe grupet që ndjek përdoruesi: baza e skedës "Të ndjekurit". */
async function followScope(uid: string): Promise<{ authorIds: string[]; groupIds: string[] }> {
  const [{ data: follows }, { data: groups }] = await Promise.all([
    supabase.from("community_expert_follows").select("expert_id").eq("user_id", uid),
    supabase.from("community_group_members").select("group_id").eq("user_id", uid),
  ]);
  const expertIds = (follows ?? []).map((f) => f.expert_id as string);
  let authorIds: string[] = [];
  if (expertIds.length) {
    const { data: experts } = await supabase.from("community_experts").select("user_id").in("id", expertIds);
    authorIds = (experts ?? []).map((e) => e.user_id as string | null).filter((x): x is string => !!x);
  }
  return { authorIds, groupIds: (groups ?? []).map((g) => g.group_id as string) };
}

export async function fetchFeed(options: FeedOptions = {}): Promise<CommunityPost[]> {
  const uid = await getCurrentUserId();
  let query = supabase.from("community_feed").select("*");
  if (options.before) query = query.lt("created_at", options.before);

  const tab = options.tab ?? "all";
  if (tab === "experts") {
    query = query.eq("author_is_expert", true);
    if (options.specialty) query = query.eq("author_specialty", options.specialty);
  } else if (tab === "following") {
    if (!uid) return [];
    const { authorIds, groupIds } = await followScope(uid);
    const parts = [
      authorIds.length ? `author_id.in.(${authorIds.join(",")})` : "",
      groupIds.length ? `group_id.in.(${groupIds.join(",")})` : "",
    ].filter(Boolean);
    if (parts.length === 0) return [];
    query = query.or(parts.join(","));
  }
  if (options.topic) query = query.eq("tag", options.topic);
  const q = sanitizeSearch(options.query ?? "");
  if (q) query = query.or(`text.ilike.*${q}*,tag.ilike.*${q}*,author_name.ilike.*${q}*`);

  const { data, error } = await query
    .order("created_at", { ascending: false })
    .limit(options.limit ?? FEED_PAGE_SIZE);
  if (error) throw error;

  let likedIds = new Set<string>();
  let savedIds = new Set<string>();
  const ids = (data ?? []).map((p) => p.id as string);
  if (uid && ids.length) {
    // Vetëm për postimet e kësaj faqeje.
    const [{ data: likes }, { data: saves }] = await Promise.all([
      supabase.from("community_post_likes").select("post_id").eq("user_id", uid).in("post_id", ids),
      supabase.from("community_post_saves").select("post_id").eq("user_id", uid).in("post_id", ids),
    ]);
    likedIds = new Set((likes ?? []).map((l) => l.post_id));
    savedIds = new Set((saves ?? []).map((s) => s.post_id));
  }

  return (data ?? []).map((p) => mapFeedRow(p, likedIds, savedIds));
}

/** Pëlqimet dhe ruajtjet e përdoruesit VETËM për këto postime (jo të gjitha që ka bërë ndonjëherë). */
async function myReactions(uid: string | null, ids: string[]): Promise<{ likedIds: Set<string>; savedIds: Set<string> }> {
  if (!uid || ids.length === 0) return { likedIds: new Set(), savedIds: new Set() };
  const [{ data: likes }, { data: saves }] = await Promise.all([
    supabase.from("community_post_likes").select("post_id").eq("user_id", uid).in("post_id", ids),
    supabase.from("community_post_saves").select("post_id").eq("user_id", uid).in("post_id", ids),
  ]);
  return {
    likedIds: new Set((likes ?? []).map((l) => l.post_id)),
    savedIds: new Set((saves ?? []).map((s) => s.post_id)),
  };
}

/** Sa postime lexohen për profilin, grupin ose të ruajturat (më të rejat). */
const LIST_LIMIT = 50;

export async function fetchPost(id: string): Promise<CommunityPost | null> {
  const uid = await getCurrentUserId();
  const { data, error } = await supabase.from("community_feed").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) return null;

  let likedIds = new Set<string>();
  let savedIds = new Set<string>();
  if (uid) {
    const [{ data: like }, { data: save }] = await Promise.all([
      supabase.from("community_post_likes").select("post_id").eq("post_id", id).eq("user_id", uid).maybeSingle(),
      supabase.from("community_post_saves").select("post_id").eq("post_id", id).eq("user_id", uid).maybeSingle(),
    ]);
    if (like) likedIds.add(id);
    if (save) savedIds.add(id);
  }

  return mapFeedRow(data, likedIds, savedIds);
}

export async function fetchSavedPosts(): Promise<CommunityPost[]> {
  const uid = await getCurrentUserId();
  if (!uid) return [];
  const { data: saves } = await supabase
    .from("community_post_saves")
    .select("post_id")
    .eq("user_id", uid)
    .order("created_at", { ascending: false })
    .limit(LIST_LIMIT);
  const ids = (saves ?? []).map((s) => s.post_id);
  if (ids.length === 0) return [];

  const { data, error } = await supabase.from("community_feed").select("*").in("id", ids).order("created_at", { ascending: false });
  if (error) throw error;

  const { likedIds } = await myReactions(uid, ids);
  const savedIds = new Set(ids);
  return (data ?? []).map((p) => mapFeedRow(p, likedIds, savedIds));
}

export async function fetchPostsByAuthor(authorId: string): Promise<CommunityPost[]> {
  const uid = await getCurrentUserId();
  const { data, error } = await supabase
    .from("community_feed")
    .select("*")
    .eq("author_id", authorId)
    .order("created_at", { ascending: false })
    .limit(LIST_LIMIT);
  if (error) throw error;

  const { likedIds, savedIds } = await myReactions(uid, (data ?? []).map((p) => p.id as string));
  return (data ?? []).map((p) => mapFeedRow(p, likedIds, savedIds));
}

export async function fetchPostsByGroup(groupId: string): Promise<CommunityPost[]> {
  const uid = await getCurrentUserId();
  const { data, error } = await supabase
    .from("community_feed")
    .select("*")
    .eq("group_id", groupId)
    .order("created_at", { ascending: false })
    .limit(LIST_LIMIT);
  if (error) throw error;

  const { likedIds, savedIds } = await myReactions(uid, (data ?? []).map((p) => p.id as string));
  return (data ?? []).map((p) => mapFeedRow(p, likedIds, savedIds));
}

export async function createPost(input: {
  text: string;
  tag?: string | null;
  groupId?: string | null;
  authorName: string;
  media?: LocalMedia[];
}): Promise<string> {
  const uid = await getCurrentUserId();
  if (!uid) throw new Error("Duhet të jesh i kyçur për të postuar.");
  const localMedia = input.media ?? [];
  if (!input.text.trim() && localMedia.length === 0) {
    throw new Error("Shkruaj diçka ose shto një foto/video.");
  }
  // Emri, shenja "ekspert" dhe ora i vendos serveri (trigger-i
  // community_posts_guard): klienti s'mund të deklarojë vete që është mjek.
  const authorName = input.authorName.trim();

  // Skedarët ngarkohen para postimit, që rreshti të ruhet bashkë me rrugët.
  const media = await uploadPostMedia(uid, localMedia);

  // Kolona "kind" NUK dërgohet me qëllim: ka listën e vet të vlerave të
  // pranuara në bazë, dhe një vlerë e panjohur (photo/video/mixed) e
  // refuzonte të gjithë postimin. Pamja varet nga lista "media", jo nga ajo.

  const { data, error } = await supabase
    .from("community_posts")
    .insert({
      author_id: uid,
      author_name: authorName,
      author_initial: authorName.charAt(0).toUpperCase() || "P",
      accent: "olive",
      text: input.text,
      media,
      tag: input.tag ?? null,
      group_id: input.groupId ?? null,
    })
    .select("id")
    .single();
  if (error) {
    // Postimi s'u ruajt: mos lër skedarë jetimë.
    await removePostMedia(media);
    // Gabimet e Supabase-it jane objekte, jo Error: pa kete, UI-ja tregonte
    // vetem mesazhin e pergjithshem dhe shkaku i vertete humbte.
    throw new Error(error.message || "post_failed");
  }
  return data.id;
}

export async function deletePost(post: { id: string; media: StoredMedia[] }) {
  const { error } = await supabase.from("community_posts").delete().eq("id", post.id);
  if (error) throw error;
  await removePostMedia(post.media);
}

export async function toggleLike(postId: string, liked: boolean) {
  const uid = await getCurrentUserId();
  if (!uid) throw new Error("Duhet të jesh i kyçur.");
  if (liked) {
    const { error } = await supabase.from("community_post_likes").delete().eq("post_id", postId).eq("user_id", uid);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("community_post_likes").insert({ post_id: postId, user_id: uid });
    if (error) throw error;
  }
}

export async function toggleSave(postId: string, saved: boolean) {
  const uid = await getCurrentUserId();
  if (!uid) throw new Error("Duhet të jesh i kyçur.");
  if (saved) {
    const { error } = await supabase.from("community_post_saves").delete().eq("post_id", postId).eq("user_id", uid);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("community_post_saves").insert({ post_id: postId, user_id: uid });
    if (error) throw error;
  }
}

// ---------------------------------------------------------------------
// Komentet
// ---------------------------------------------------------------------

/** Cilët nga këta përdorues janë ekspertë të verifikuar (user_id -> lloji dhe reparti). */
export async function expertsByUserId(userIds: string[]): Promise<Map<string, CommentExpert>> {
  const map = new Map<string, CommentExpert>();
  if (userIds.length === 0) return map;
  let res = await supabase.from("community_experts").select("user_id,kind,specialty_key").in("user_id", userIds);
  // Para migrimit të repartave kolona `specialty_key` s'ekziston: përsëri lexohet vetëm lloji.
  if (res.error) res = (await supabase.from("community_experts").select("user_id,kind").in("user_id", userIds)) as typeof res;
  for (const e of (res.data ?? []) as { user_id: string | null; kind: string; specialty_key?: string | null }[]) {
    if (e.user_id) map.set(e.user_id, { kind: e.kind, specialty: e.specialty_key ?? null });
  }
  return map;
}

export async function fetchComments(postId: string): Promise<CommunityComment[]> {
  const [{ data, error }, blocked] = await Promise.all([
    supabase
      .from("community_comments")
      .select("*")
      .eq("post_id", postId)
      .order("created_at", { ascending: true }),
    fetchBlockedUserIds(),
  ]);
  if (error) throw error;
  const visible = (data ?? []).filter((c: any) => !blocked.has(c.author_id));
  const experts = await expertsByUserId([...new Set(visible.map((c: any) => c.author_id as string))]);
  return visible.map((c: any) => ({
    id: c.id,
    postId: c.post_id,
    authorId: c.author_id,
    authorName: c.author_name,
    parentId: c.parent_id,
    text: c.text,
    at: c.created_at,
    expert: experts.get(c.author_id) ?? null,
  }));
}

/** Koha e postimit më të ri në rrjedhë: pas saj kontrollohet nëse ka postime të reja ("Postime të reja ↑"). */
export async function fetchNewestPostAt(): Promise<string | null> {
  const { data } = await supabase
    .from("community_feed")
    .select("created_at")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.created_at as string | undefined) ?? null;
}

export async function addComment(input: { postId: string; text: string; parentId?: string | null; authorName: string }) {
  const uid = await getCurrentUserId();
  if (!uid) throw new Error("Duhet të jesh i kyçur.");
  const { error } = await supabase.from("community_comments").insert({
    post_id: input.postId,
    author_id: uid,
    // Bosh: serveri vendos "Prind" (jo "Ti", që të tjerëve u dilte si emër).
    author_name: input.authorName.trim(),
    parent_id: input.parentId ?? null,
    text: input.text,
  });
  if (error) throw error;
}

export async function deleteComment(id: string) {
  const { error } = await supabase.from("community_comments").delete().eq("id", id);
  if (error) throw error;
}

// ---------------------------------------------------------------------
// Moderimi: raportimi dhe bllokimi (App Store 1.2 i kerkon per permbajtje
// nga perdoruesit). 3 raportime te hapura e fshehin postimin nga feed-i.
// ---------------------------------------------------------------------

export type ReportReason = "spam" | "harassment" | "inappropriate" | "misinformation" | "other";

async function report(target: { post_id: string } | { comment_id: string }, reason: ReportReason) {
  const uid = await getCurrentUserId();
  if (!uid) throw new Error("Duhet të jesh i kyçur.");
  const { error } = await supabase.from("community_reports").insert({ reporter_id: uid, reason, ...target });
  // 23505 = e ke raportuar tashmë; për përdoruesin është e njëjta gjë.
  if (error && error.code !== "23505") throw error;
}

export function reportPost(postId: string, reason: ReportReason) {
  return report({ post_id: postId }, reason);
}

export function reportComment(commentId: string, reason: ReportReason) {
  return report({ comment_id: commentId }, reason);
}

export async function blockUser(userId: string) {
  const uid = await getCurrentUserId();
  if (!uid) throw new Error("Duhet të jesh i kyçur.");
  if (uid === userId) throw new Error("Nuk mund të bllokosh veten.");
  const { error } = await supabase
    .from("community_blocks")
    .upsert({ blocker_id: uid, blocked_id: userId }, { onConflict: "blocker_id,blocked_id", ignoreDuplicates: true });
  if (error) throw error;
}

export async function unblockUser(userId: string) {
  const uid = await getCurrentUserId();
  if (!uid) return;
  const { error } = await supabase.from("community_blocks").delete().eq("blocker_id", uid).eq("blocked_id", userId);
  if (error) throw error;
}

export async function fetchBlockedUserIds(): Promise<Set<string>> {
  const uid = await getCurrentUserId();
  if (!uid) return new Set();
  const { data } = await supabase.from("community_blocks").select("blocked_id").eq("blocker_id", uid);
  return new Set((data ?? []).map((b) => b.blocked_id));
}

export async function fetchExpertByUserId(userId: string): Promise<CommunityExpert | null> {
  const { data, error } = await supabase.from("community_experts").select("*").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return mapExpert(data, false);
}