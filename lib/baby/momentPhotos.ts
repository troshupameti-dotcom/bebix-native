import { supabase } from "@/lib/supabase/client";

const BUCKET = "baby-moments";
/** Sa kohe vlen URL-ja e nenshkruar qe i jepet <Image> per shfaqje. */
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24; // 24 ore

/**
 * Fotot dhe videot e "Momenteve" ruhen si URI lokale te telefonit
 * (file://...), pra sinkronizimi i metadatave nuk i shpeton nese app-i
 * fshihet. Ky modul i ngarkon te Supabase Storage, ne nje bucket privat ku
 * cdo perdorues sheh vetem dosjen e vet (baby-moments/<user_id>/...).
 *
 * `payload.storagePath` te `baby_records` mban rrugen ne bucket; `uri`
 * mbetet URI-ja lokale ne pajisjen qe e krijoi, dhe zevendesohet me nje URL
 * te nenshkruar kur regjistrimi vjen nga serveri.
 */

function extensionFor(uri: string): string {
  const clean = uri.split("?")[0];
  const dot = clean.lastIndexOf(".");
  const ext = dot === -1 ? "" : clean.slice(dot + 1).toLowerCase();
  return /^[a-z0-9]{2,5}$/.test(ext) ? ext : "jpg";
}

function contentTypeFor(ext: string): string {
  switch (ext) {
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    case "heic":
      return "image/heic";
    case "mp4":
      return "video/mp4";
    case "mov":
      return "video/quicktime";
    default:
      return "image/jpeg";
  }
}

/** URI qe ndodhet vetem ne kete pajisje dhe qe ia vlen te ngarkohet. */
export function isLocalFileUri(uri: string | null | undefined): uri is string {
  if (!uri) return false;
  return uri.startsWith("file://") || uri.startsWith("content://") || uri.startsWith("ph://");
}

/**
 * Ngarkon nje foto/video ne bucket dhe kthen rrugen brenda tij.
 * Kthen null nese ngarkimi deshton — momenti ruhet gjithsesi, vetem pa file.
 */
export async function uploadMomentFile(
  userId: string,
  momentId: string,
  localUri: string
): Promise<string | null> {
  try {
    const ext = extensionFor(localUri);
    const path = `${userId}/${momentId}.${ext}`;

    // fetch() e lexon file:// ne React Native; arrayBuffer eviton base64.
    const response = await fetch(localUri);
    const bytes = await response.arrayBuffer();

    const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, {
      contentType: contentTypeFor(ext),
      upsert: true,
    });

    if (error) {
      console.log("Ngarkimi i file-it te momentit deshtoi:", error.message);
      return null;
    }
    return path;
  } catch (e) {
    console.log("Ngarkimi i file-it te momentit deshtoi:", e);
    return null;
  }
}

/** URL e nenshkruar per shfaqje; null nese s'merret dot. */
export async function signedUrlForMoment(storagePath: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);

  if (error) {
    console.log("URL e nenshkruar e momentit deshtoi:", error.message);
    return null;
  }
  return data?.signedUrl ?? null;
}

/** Fshin file-in e nje momenti; heshtazi, sepse metadatat jane me te rendesishme. */
export async function deleteMomentFile(storagePath: string): Promise<void> {
  const { error } = await supabase.storage.from(BUCKET).remove([storagePath]);
  if (error) console.log("Fshirja e file-it te momentit deshtoi:", error.message);
}
