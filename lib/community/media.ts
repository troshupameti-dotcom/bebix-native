import { File } from "expo-file-system";
import { supabase } from "@/lib/supabase/client";

export const COMMUNITY_BUCKET = "community-media";
/** Sa foto/video lejohen për postim (e njëjta kufi si në bazë). */
export const MAX_POST_MEDIA = 4;
/** Kohëzgjatja maksimale e videos, në sekonda. */
export const MAX_VIDEO_SECONDS = 60;
/** Kufiri i bucket-it: 50 MB për skedar. */
export const MAX_FILE_BYTES = 50 * 1024 * 1024;

export type MediaType = "image" | "video";

/** Si ruhet te `community_posts.media`. */
export type StoredMedia = {
  path: string;
  type: MediaType;
  width?: number | null;
  height?: number | null;
  duration?: number | null;
};

/** Si e përdor UI-ja: e ruajtura + URL-ja publike. */
export type PostMedia = StoredMedia & { url: string };

/** Një skedar i zgjedhur nga telefoni, ende pa u ngarkuar. */
export type LocalMedia = {
  uri: string;
  type: MediaType;
  width?: number | null;
  height?: number | null;
  duration?: number | null;
  mimeType?: string | null;
  fileSize?: number | null;
};

/**
 * Lexon bajtat e skedarit lokal. expo-file-system e lexon direkt nga disku;
 * `fetch` mbi file:// dështon ose kthen 0 bajt në disa pajisje Android,
 * prandaj mbetet vetëm si rrugë rezervë.
 */
async function readBytes(uri: string): Promise<ArrayBuffer> {
  try {
    const bytes = await new File(uri).arrayBuffer();
    if (bytes.byteLength > 0) return bytes;
  } catch {
    // p.sh. content:// nga zgjedhësi i Android-it — provo me fetch.
  }

  const response = await fetch(uri);
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength === 0) throw new Error("Skedari u lexua bosh.");
  return bytes;
}

export function publicUrl(path: string): string {
  return supabase.storage.from(COMMUNITY_BUCKET).getPublicUrl(path).data.publicUrl;
}

export function withUrls(media: StoredMedia[] | null | undefined): PostMedia[] {
  return (media ?? []).map((m) => ({ ...m, url: publicUrl(m.path) }));
}

function extensionFor(item: LocalMedia): string {
  const fromMime = item.mimeType?.split("/")[1]?.toLowerCase();
  if (fromMime === "quicktime") return "mov";
  if (fromMime && /^[a-z0-9]{2,5}$/.test(fromMime)) return fromMime === "jpeg" ? "jpg" : fromMime;
  const clean = item.uri.split("?")[0];
  const ext = clean.slice(clean.lastIndexOf(".") + 1).toLowerCase();
  if (/^[a-z0-9]{2,5}$/.test(ext)) return ext;
  return item.type === "video" ? "mp4" : "jpg";
}

function contentTypeFor(ext: string, type: MediaType): string {
  const map: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    heic: "image/heic",
    mp4: "video/mp4",
    mov: "video/quicktime",
  };
  return map[ext] ?? (type === "video" ? "video/mp4" : "image/jpeg");
}

/**
 * Ngarkon skedarët në `community-media/<user_id>/...` dhe kthen atë që ruhet
 * te postimi. Nëse njëri dështon, fshihen ata që u ngarkuan, që të mos mbeten
 * skedarë pa postim.
 */
export async function uploadPostMedia(userId: string, items: LocalMedia[]): Promise<StoredMedia[]> {
  const uploaded: StoredMedia[] = [];
  try {
    for (const item of items) {
      if (item.fileSize && item.fileSize > MAX_FILE_BYTES) {
        throw new Error("Skedari është më i madh se 50 MB.");
      }
      const ext = extensionFor(item);
      const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

      const bytes = await readBytes(item.uri);
      const { error } = await supabase.storage
        .from(COMMUNITY_BUCKET)
        .upload(path, bytes, { contentType: contentTypeFor(ext, item.type) });
      if (error) throw new Error(`Ngarkimi dështoi: ${error.message}`);

      uploaded.push({
        path,
        type: item.type,
        width: item.width ?? null,
        height: item.height ?? null,
        duration: item.duration ?? null,
      });
    }
    return uploaded;
  } catch (e) {
    await removePostMedia(uploaded);
    throw e;
  }
}

/** Fshin skedarët e një postimi; heshtazi, sepse postimi është gjëja kryesore. */
export async function removePostMedia(media: StoredMedia[]): Promise<void> {
  if (!media.length) return;
  const { error } = await supabase.storage.from(COMMUNITY_BUCKET).remove(media.map((m) => m.path));
  if (error) console.log("Fshirja e medias së postimit dështoi:", error.message);
}
