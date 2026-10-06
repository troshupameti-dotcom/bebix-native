import { supabase } from "@/lib/supabase/client";
import { COMMUNITY_BUCKET, readBytes } from "@/lib/community/media";

/**
 * Foto e profilit të ekspertit: ngarkohet te `community-media/<user_id>/avatar-*.jpg` dhe rruga ruhet te
 * `community_experts.photo_path` përmes `set_my_expert_photo` (eksperti s'mund të shkruajë drejt te tabela).
 * Fotoja e vjetër fshihet pasi e reja ruhet.
 */
export async function setMyExpertPhoto(photo: { uri: string; mimeType?: string | null }): Promise<string> {
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

  const { data: oldPath, error } = await supabase.rpc("set_my_expert_photo", { p_path: path });
  if (error) {
    await supabase.storage.from(COMMUNITY_BUCKET).remove([path]);
    throw new Error(error.message);
  }
  if (typeof oldPath === "string" && oldPath && oldPath !== path) {
    await supabase.storage.from(COMMUNITY_BUCKET).remove([oldPath]).catch(() => undefined);
  }
  return path;
}

export function expertPhotoUrl(path: string | null | undefined): string | null {
  return path ? supabase.storage.from(COMMUNITY_BUCKET).getPublicUrl(path).data.publicUrl : null;
}
