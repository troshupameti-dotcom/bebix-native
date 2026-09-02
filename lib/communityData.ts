import { supabase } from "@/lib/supabase/client";
import { IconName } from "@/components/ui/Icon";

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
  kind: string;
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
};

export type CommunityComment = {
  id: string;
  postId: string;
  authorId: string;
  authorName: string;
  parentId: string | null;
  text: string;
  at: string;
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
    .select("id,name,description,icon,accent, community_group_members(count)")
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
    memberCount: g.community_group_members?.[0]?.count ?? 0,
    joined: joinedIds.has(g.id),
  }));
}

export async function fetchGroupById(id: string): Promise<CommunityGroup | null> {
  const uid = await getCurrentUserId();
  const { data, error } = await supabase
    .from("community_groups")
    .select("id,name,description,icon,accent, community_group_members(count)")
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
    memberCount: (data as any).community_group_members?.[0]?.count ?? 0,
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

export async function fetchExperts(): Promise<CommunityExpert[]> {
  const uid = await getCurrentUserId();
  const { data, error } = await supabase.from("community_experts").select("*").order("rating", { ascending: false });
  if (error) throw error;

  let followedIds = new Set<string>();
  if (uid) {
    const { data: mine } = await supabase.from("community_expert_follows").select("expert_id").eq("user_id", uid);
    followedIds = new Set((mine ?? []).map((m) => m.expert_id));
  }

  return (data ?? []).map((e: any) => ({
    id: e.id,
    userId: e.user_id,
    name: e.name,
    kind: e.kind,
    bio: e.bio,
    experienceYears: e.experience_years,
    languages: e.languages ?? [],
    rating: Number(e.rating),
    reviewCount: e.review_count,
    icon: e.icon,
    accent: e.accent,
    followed: followedIds.has(e.id),
  }));
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

  return {
    id: data.id,
    userId: data.user_id,
    name: data.name,
    kind: data.kind,
    bio: data.bio,
    experienceYears: data.experience_years,
    languages: data.languages ?? [],
    rating: Number(data.rating),
    reviewCount: data.review_count,
    icon: data.icon,
    accent: data.accent,
    followed,
  };
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
  };
}

export async function fetchFeed(): Promise<CommunityPost[]> {
  const uid = await getCurrentUserId();
  const { data, error } = await supabase.from("community_feed").select("*").order("created_at", { ascending: false });
  if (error) throw error;

  let likedIds = new Set<string>();
  let savedIds = new Set<string>();
  if (uid) {
    const [{ data: likes }, { data: saves }] = await Promise.all([
      supabase.from("community_post_likes").select("post_id").eq("user_id", uid),
      supabase.from("community_post_saves").select("post_id").eq("user_id", uid),
    ]);
    likedIds = new Set((likes ?? []).map((l) => l.post_id));
    savedIds = new Set((saves ?? []).map((s) => s.post_id));
  }

  return (data ?? []).map((p) => mapFeedRow(p, likedIds, savedIds));
}

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
  const { data: saves } = await supabase.from("community_post_saves").select("post_id").eq("user_id", uid);
  const ids = (saves ?? []).map((s) => s.post_id);
  if (ids.length === 0) return [];

  const { data, error } = await supabase.from("community_feed").select("*").in("id", ids).order("created_at", { ascending: false });
  if (error) throw error;

  const { data: likes } = await supabase.from("community_post_likes").select("post_id").eq("user_id", uid);
  const likedIds = new Set((likes ?? []).map((l) => l.post_id));
  const savedIds = new Set(ids);

  return (data ?? []).map((p) => mapFeedRow(p, likedIds, savedIds));
}

export async function fetchPostsByAuthor(authorId: string): Promise<CommunityPost[]> {
  const uid = await getCurrentUserId();
  const { data, error } = await supabase
    .from("community_feed")
    .select("*")
    .eq("author_id", authorId)
    .order("created_at", { ascending: false });
  if (error) throw error;

  let likedIds = new Set<string>();
  let savedIds = new Set<string>();
  if (uid) {
    const [{ data: likes }, { data: saves }] = await Promise.all([
      supabase.from("community_post_likes").select("post_id").eq("user_id", uid),
      supabase.from("community_post_saves").select("post_id").eq("user_id", uid),
    ]);
    likedIds = new Set((likes ?? []).map((l) => l.post_id));
    savedIds = new Set((saves ?? []).map((s) => s.post_id));
  }

  return (data ?? []).map((p) => mapFeedRow(p, likedIds, savedIds));
}

export async function fetchPostsByGroup(groupId: string): Promise<CommunityPost[]> {
  const uid = await getCurrentUserId();
  const { data, error } = await supabase
    .from("community_feed")
    .select("*")
    .eq("group_id", groupId)
    .order("created_at", { ascending: false });
  if (error) throw error;

  let likedIds = new Set<string>();
  let savedIds = new Set<string>();
  if (uid) {
    const [{ data: likes }, { data: saves }] = await Promise.all([
      supabase.from("community_post_likes").select("post_id").eq("user_id", uid),
      supabase.from("community_post_saves").select("post_id").eq("user_id", uid),
    ]);
    likedIds = new Set((likes ?? []).map((l) => l.post_id));
    savedIds = new Set((saves ?? []).map((s) => s.post_id));
  }

  return (data ?? []).map((p) => mapFeedRow(p, likedIds, savedIds));
}

export async function createPost(input: { text: string; tag?: string | null; groupId?: string | null; authorName: string }): Promise<string> {
  const uid = await getCurrentUserId();
  if (!uid) throw new Error("Duhet të jesh i kyçur për të postuar.");
  const authorInitial = (input.authorName || "T").trim().charAt(0).toUpperCase() || "T";

  // Nëse llogaria është e lidhur me një ekspert të aprovuar (shih expert_applications
  // + panelin e adminit), postimi shënohet automatikisht si i verifikuar.
  const { data: expertRow } = await supabase
    .from("community_experts")
    .select("id")
    .eq("user_id", uid)
    .maybeSingle();
  const isExpert = !!expertRow;

  const { data, error } = await supabase
    .from("community_posts")
    .insert({
      author_id: uid,
      author_name: input.authorName || "Ti",
      author_initial: authorInitial,
      author_is_expert: isExpert,
      accent: "olive",
      kind: "text",
      text: input.text,
      tag: input.tag ?? null,
      icon: isExpert ? "shield" : "sparkle",
      group_id: input.groupId ?? null,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export async function deletePost(id: string) {
  const { error } = await supabase.from("community_posts").delete().eq("id", id);
  if (error) throw error;
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

export async function fetchComments(postId: string): Promise<CommunityComment[]> {
  const { data, error } = await supabase
    .from("community_comments")
    .select("*")
    .eq("post_id", postId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((c: any) => ({
    id: c.id,
    postId: c.post_id,
    authorId: c.author_id,
    authorName: c.author_name,
    parentId: c.parent_id,
    text: c.text,
    at: c.created_at,
  }));
}

export async function addComment(input: { postId: string; text: string; parentId?: string | null; authorName: string }) {
  const uid = await getCurrentUserId();
  if (!uid) throw new Error("Duhet të jesh i kyçur.");
  const { error } = await supabase.from("community_comments").insert({
    post_id: input.postId,
    author_id: uid,
    author_name: input.authorName || "Ti",
    parent_id: input.parentId ?? null,
    text: input.text,
  });
  if (error) throw error;
}
export async function fetchExpertByUserId(userId: string): Promise<CommunityExpert | null> {
  const { data, error } = await supabase.from("community_experts").select("*").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    id: data.id,
    userId: data.user_id,
    name: data.name,
    kind: data.kind,
    bio: data.bio,
    experienceYears: data.experience_years,
    languages: data.languages ?? [],
    rating: Number(data.rating),
    reviewCount: data.review_count,
    icon: data.icon,
    accent: data.accent,
    followed: false,
  };
}