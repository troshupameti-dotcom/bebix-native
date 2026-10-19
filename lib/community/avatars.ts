import { useEffect, useSyncExternalStore } from "react";
import { supabase } from "@/lib/supabase/client";
import { COMMUNITY_BUCKET, readBytes } from "@/lib/community/media";

/**
 * Fotot e profilit në komunitet. Postimet s'e ruajnë foton: ajo lexohet nga profili i autorit (ekspert:
 * `community_experts.photo_path`; prind: `community_user_profiles.avatar_path`), ndaj kur dikush e ndërron,
 * edhe postimet e tij të vjetra marrin foton e re.
 *
 * Të gjitha kartat e një faqeje kërkojnë bashkë: një kërkesë për të gjithë autorët, jo një për çdo postim.
 */
type Entry = { url: string | null; at: number };
const FRESH_MS = 5 * 60_000;
const cache = new Map<string, Entry>();
const listeners = new Set<() => void>();
let queued = new Set<string>();
let timer: ReturnType<typeof setTimeout> | null = null;
let version = 0;

function publicUrl(path: string | null | undefined): string | null {
  return path ? supabase.storage.from(COMMUNITY_BUCKET).getPublicUrl(path).data.publicUrl : null;
}

function emit() {
  version += 1;
  listeners.forEach((l) => l());
}

async function flush() {
  timer = null;
  const ids = [...queued];
  queued = new Set();
  if (ids.length === 0) return;
  const [profiles, experts] = await Promise.all([
    supabase.from("community_user_profiles").select("user_id, avatar_path").in("user_id", ids),
    supabase.from("community_experts").select("user_id, photo_path").in("user_id", ids),
  ]);
  const now = Date.now();
  const found = new Map<string, string | null>();
  // Pa migrimin e fotove (kolona mungon) s'ka foto prindi: vetëm të ekspertëve.
  for (const r of (profiles.error ? [] : profiles.data ?? []) as { user_id: string; avatar_path: string | null }[]) {
    found.set(r.user_id, publicUrl(r.avatar_path));
  }
  for (const r of (experts.error ? [] : experts.data ?? []) as { user_id: string | null; photo_path: string | null }[]) {
    if (r.user_id && r.photo_path) found.set(r.user_id, publicUrl(r.photo_path));
  }
  // Pa rrjet: s'ruhet asgjë, që të provohet sërish.
  if (profiles.error && experts.error) return;
  for (const id of ids) cache.set(id, { url: found.get(id) ?? null, at: now });
  emit();
}

function request(userId: string) {
  const hit = cache.get(userId);
  if (hit && Date.now() - hit.at < FRESH_MS) return;
  queued.add(userId);
  timer ??= setTimeout(() => void flush().catch(() => {}), 0);
}

/** URL e fotos së autorit, ose null (tregohet shkronja e parë). */
export function useAuthorAvatar(userId: string | null | undefined): string | null {
  useEffect(() => {
    if (userId) request(userId);
  }, [userId]);
  useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => version,
    () => version
  );
  return userId ? cache.get(userId)?.url ?? null : null;
}

/** Pas ndërrimit të fotos: kartat e mia marrin menjëherë foton e re. */
export function setCachedAvatar(userId: string, url: string | null): void {
  cache.set(userId, { url, at: Date.now() });
  emit();
}

/**
 * Fotoja e profilit e prindit në komunitet: ngarkohet te `community-media/<user_id>/avatar-*.jpg` dhe rruga ruhet
 * me `set_my_community_avatar`; e vjetra fshihet. (Ekspertët përdorin `setMyExpertPhoto`.)
 */
export async function setMyCommunityAvatar(photo: { uri: string; mimeType?: string | null }): Promise<string> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) throw new Error("Duhet të jesh i kyçur.");
  const mime = (photo.mimeType ?? "").toLowerCase();
  const ext = mime.includes("png") ? "png" : mime.includes("webp") ? "webp" : "jpg";
  const path = `${uid}/avatar-${Date.now()}.${ext}`;
  const bytes = await readBytes(photo.uri);
  if (bytes.byteLength > 5 * 1024 * 1024) throw new Error("Fotoja është mbi 5 MB.");
  const { error: uploadError } = await supabase.storage
    .from(COMMUNITY_BUCKET)
    .upload(path, bytes, { contentType: ext === "jpg" ? "image/jpeg" : `image/${ext}` });
  if (uploadError) throw new Error(`Ngarkimi dështoi: ${uploadError.message}`);
  const { data: oldPath, error } = await supabase.rpc("set_my_community_avatar", { p_path: path });
  if (error) {
    await supabase.storage.from(COMMUNITY_BUCKET).remove([path]);
    throw new Error(error.message);
  }
  if (typeof oldPath === "string" && oldPath && oldPath !== path) {
    await supabase.storage.from(COMMUNITY_BUCKET).remove([oldPath]).catch(() => undefined);
  }
  setCachedAvatar(uid, publicUrl(path));
  return path;
}

/** Vetëm për testet. */
export function __resetAvatarsForTests(): void {
  cache.clear();
  queued = new Set();
  timer = null;
}
