import { supabase } from "@/lib/supabase/client";
import { realtimeTopic } from "@/lib/supabase/realtimeTopic";
import type { TranslationKey } from "@/lib/i18n/translations";

/**
 * Mesazhet private (inbox) dhe ndjekja mes prindërve.
 *
 * Rregulli (në bazë, jo vetëm këtu): dy vetë mund t'i shkruajnë njëri-tjetrit
 * kur NJËRI ndjek tjetrin (prind ose ekspert) dhe asnjëri s'e ka bllokuar
 * tjetrin. Mesazhet ruhen; dërguesi e fshin të vetin. 30 mesazhe në minutë.
 */

export const MESSAGE_MAX = 2000;
/** Sa mesazhe lexohen njëherësh (më të vjetrat vijnë kur zbret lart). */
export const PAGE_SIZE = 40;

export type InboxRow = {
  id: string;
  otherId: string;
  otherName: string;
  otherIsExpert: boolean;
  lastAt: string;
  preview: string;
  fromMe: boolean;
  unread: boolean;
};

export type Message = { id: string; conversationId: string; senderId: string; kind: "text" | "screenshot"; body: string; at: string };

export type PublicProfile = {
  userId: string;
  name: string;
  expertId: string | null;
  followers: number;
  following: number;
  iFollow: boolean;
  followsMe: boolean;
  canMessage: boolean;
  blocked: boolean;
  /** Pa migrimin e mesazheve në server: vetëm emri dhe postimet, pa Ndiq/Shkruaj. */
  limited?: boolean;
};

/** Mesazhi i vlefshëm (1–2000 pas pastrimit), ose null. */
export function cleanMessage(text: string): string | null {
  const t = text.trim();
  return t.length >= 1 && t.length <= MESSAGE_MAX ? t : null;
}

/** Mund të shkruajnë: njëri ndjek tjetrin dhe s'ka bllokim (pasqyrë e dm_allowed në bazë). */
export function canMessage(iFollow: boolean, followsMe: boolean, blocked: boolean): boolean {
  return !blocked && (iFollow || followsMe);
}

/** Dita e mesazhit si çelës ("2026-10-12"), për ndarësit "Sot" / data. */
export function dayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Gabimet e bazës → teksti për prindin. */
export function messageErrorKey(err: unknown): TranslationKey {
  const msg = err instanceof Error ? err.message : String((err as { message?: string })?.message ?? err);
  if (msg.includes("dm_rate_limit")) return "dm_err_rate";
  if (msg.includes("dm_not_allowed") || msg.includes("row-level security")) return "dm_err_not_allowed";
  return "dm_err_generic";
}

/** Tabela s'ekziston (migrimi s'është ekzekutuar ende): PGRST205 / 42P01, ose funksioni mungon (PGRST202). */
export function isMissing(error: { code?: string } | null): boolean {
  return !!error && (error.code === "PGRST205" || error.code === "42P01" || error.code === "PGRST202" || error.code === "42883");
}

// --- Emri dhe ndjekja ------------------------------------------------------

/** Emri im publik te Komuniteti (i njëjti rregull si te postimet). */
export async function setMyCommunityName(name: string): Promise<void> {
  await supabase.rpc("set_my_community_name", { p_name: name.trim() });
}

export async function fetchPublicProfile(userId: string): Promise<PublicProfile | null> {
  const { data, error } = await supabase.rpc("community_public_profile", { p_user: userId });
  if (error) throw error;
  const r = (data as any[] | null)?.[0];
  if (!r) return null;
  return {
    userId: r.user_id,
    name: r.display_name ?? "Prind",
    expertId: r.expert_id ?? null,
    followers: Number(r.followers) || 0,
    following: Number(r.following) || 0,
    iFollow: !!r.i_follow,
    followsMe: !!r.follows_me,
    canMessage: !!r.can_message,
    blocked: !!r.blocked,
  };
}

export async function followUser(userId: string): Promise<void> {
  const { data } = await supabase.auth.getSession();
  const me = data.session?.user.id;
  if (!me) throw new Error("not_authenticated");
  const { error } = await supabase.from("community_user_follows").insert({ follower_id: me, followee_id: userId });
  if (error && error.code !== "23505") throw new Error(error.message);
}

export async function unfollowUser(userId: string): Promise<void> {
  const { data } = await supabase.auth.getSession();
  const me = data.session?.user.id;
  if (!me) return;
  const { error } = await supabase.from("community_user_follows").delete().eq("follower_id", me).eq("followee_id", userId);
  if (error) throw new Error(error.message);
}

// --- Bisedat ---------------------------------------------------------------

/** Inbox-i, ose `available: false` kur migrimi s'është në server (hyrjet fshihen). */
export async function fetchInbox(): Promise<{ available: boolean; rows: InboxRow[] }> {
  const { data, error } = await supabase.rpc("dm_inbox");
  if (isMissing(error)) return { available: false, rows: [] };
  if (error) throw error;
  return {
    available: true,
    rows: ((data ?? []) as any[]).map((r) => ({
      id: r.id,
      otherId: r.other_id,
      otherName: r.other_name ?? "Prind",
      otherIsExpert: !!r.other_is_expert,
      lastAt: r.last_message_at,
      preview: r.last_message_preview ?? "",
      fromMe: !!r.last_from_me,
      unread: !!r.unread,
    })),
  };
}

/** Nis ose gjej bisedën me dikë; gabim kur s'lejohet. */
export async function startConversation(otherId: string): Promise<string> {
  const { data, error } = await supabase.rpc("start_conversation", { p_other: otherId });
  if (error) throw new Error(error.message);
  return data as string;
}

/** Biseda: kush është tjetri (emri dhe id-ja), dhe a mund të shkruaj ende. */
export async function fetchConversation(id: string): Promise<{ otherId: string; otherName: string; canSend: boolean } | null> {
  const { data: session } = await supabase.auth.getSession();
  const me = session.session?.user.id;
  const { data, error } = await supabase.from("dm_conversations").select("id, user_a, user_b").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data || !me) return null;
  const otherId = (data.user_a === me ? data.user_b : data.user_a) as string;
  const [profile, can] = await Promise.all([fetchPublicProfile(otherId), supabase.rpc("dm_can_send", { p_conversation: id })]);
  return { otherId, otherName: profile?.name ?? "Prind", canSend: can.data === true };
}

const toMessage = (r: any): Message => ({ id: r.id, conversationId: r.conversation_id, senderId: r.sender_id, kind: r.kind, body: r.body, at: r.created_at });

/** Mesazhet, më të rejat para (për listën e kthyer përmbys); `before` për faqen e radhës. */
export async function fetchMessages(conversationId: string, before?: string): Promise<Message[]> {
  let q = supabase.from("dm_messages").select("id, conversation_id, sender_id, kind, body, created_at").eq("conversation_id", conversationId);
  if (before) q = q.lt("created_at", before);
  const { data, error } = await q.order("created_at", { ascending: false }).limit(PAGE_SIZE);
  if (error) throw error;
  return (data ?? []).map(toMessage);
}

export async function sendMessage(conversationId: string, text: string): Promise<Message> {
  const clean = cleanMessage(text);
  if (!clean) throw new Error("dm_bad_body");
  const { data: session } = await supabase.auth.getSession();
  const me = session.session?.user.id;
  if (!me) throw new Error("not_authenticated");
  const { data, error } = await supabase
    .from("dm_messages")
    .insert({ conversation_id: conversationId, sender_id: me, body: clean })
    .select("id, conversation_id, sender_id, kind, body, created_at")
    .single();
  if (error) throw new Error(error.message);
  return toMessage(data);
}

/** Shënim te biseda kur dikush bën screenshot (iPhone e lejon vetëm ta dimë, jo ta ndalojmë). */
export async function noteScreenshot(conversationId: string): Promise<void> {
  const { data: session } = await supabase.auth.getSession();
  const me = session.session?.user.id;
  if (!me) return;
  await supabase.from("dm_messages").insert({ conversation_id: conversationId, sender_id: me, kind: "screenshot", body: "" });
}

export async function deleteMessage(id: string): Promise<void> {
  const { error } = await supabase.from("dm_messages").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function markConversationRead(id: string): Promise<void> {
  await supabase.rpc("mark_conversation_read", { p_conversation: id });
}

/** Mesazhet e reja menjëherë (Realtime, me RLS). Kthen funksionin që e mbyll lidhjen. */
export function subscribeToConversation(conversationId: string, onInsert: (m: Message) => void, onDelete: (id: string) => void): () => void {
  const channel = supabase
    .channel(realtimeTopic(`dm:${conversationId}`))
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "dm_messages", filter: `conversation_id=eq.${conversationId}` }, (p) =>
      onInsert(toMessage(p.new))
    )
    .on("postgres_changes", { event: "DELETE", schema: "public", table: "dm_messages" }, (p) => {
      const id = (p.old as { id?: string })?.id;
      if (id) onDelete(id);
    })
    .subscribe();
  return () => {
    void supabase.removeChannel(channel);
  };
}
