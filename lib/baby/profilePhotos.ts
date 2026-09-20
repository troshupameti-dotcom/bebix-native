import { supabase } from "@/lib/supabase/client";
import { isLocalFileUri } from "@/lib/baby/momentPhotos";

/**
 * Fotoja e bebit dhe e prindit.
 *
 * Më parë ruhej vetëm URI-ja që kthen ImagePicker — një shteg brenda dosjes
 * `cache` të app-it. Vetë file-i nuk kopjohej askund. Sistemi e pastron atë
 * dosje kur i mbaron hapësira, dhe e fshin krejt kur app-i ri-instalohet ose
 * kur pastrohet cache-i i zhvillimit. Në AsyncStorage mbetej shtegu, por pas
 * tij nuk kishte më file: `<Image>` nuk jep asnjë gabim, thjesht nuk vizaton
 * asgjë. Prandaj fotoja "zhdukej" pa asnjë shenjë.
 *
 * Tash ngarkohet në Supabase Storage sapo zgjidhet, njësoj si Momentet. Rruga
 * është `<user_id>/profile/<kind>.<ext>` — segmenti i parë është ID-ja e
 * përdoruesit, që politikat ekzistuese të bucket-it ta lejojnë pa u prekur.
 *
 * Bucket-i quhet `baby-moments`, jo `profile-photos`: emri nuk përputhet
 * plotësisht, por krijimi i një bucket-i të ri do të ishte infrastrukturë e
 * re për dy file, ndërsa këtu politikat dhe kufijtë e llojeve janë tashmë ata
 * që duhen.
 */

const BUCKET = "baby-moments";
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 7;

export type ProfilePhotoKind = "baby" | "parent";

function extensionFor(uri: string): string {
  const clean = uri.split("?")[0];
  const dot = clean.lastIndexOf(".");
  const ext = dot === -1 ? "" : clean.slice(dot + 1).toLowerCase();
  return /^(jpg|jpeg|png|webp|heic)$/.test(ext) ? ext : "jpg";
}

function contentTypeFor(ext: string): string {
  switch (ext) {
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    case "heic":
      return "image/heic";
    default:
      return "image/jpeg";
  }
}

export function profilePhotoPath(userId: string, kind: ProfilePhotoKind, ext: string): string {
  return `${userId}/profile/${kind}.${ext}`;
}

/**
 * Ngarkon foton dhe kthen rrugën brenda bucket-it, ose null nëse dështoi.
 *
 * Dështimi nuk është fatal: fotoja mbetet e dukshme nga URI-ja lokale për sa
 * kohë file-i është aty, dhe ngarkimi riprovohet herën tjetër.
 */
export async function uploadProfilePhoto(
  userId: string,
  kind: ProfilePhotoKind,
  localUri: string
): Promise<string | null> {
  if (!isLocalFileUri(localUri)) return null;

  try {
    const ext = extensionFor(localUri);
    const path = profilePhotoPath(userId, kind, ext);

    // fetch() e lexon file:// në React Native; arrayBuffer shmang base64-in.
    const response = await fetch(localUri);
    const bytes = await response.arrayBuffer();

    const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, {
      contentType: contentTypeFor(ext),
      upsert: true,
    });

    if (error) {
      console.log("Ngarkimi i fotos se profilit deshtoi:", error.message);
      return null;
    }
    return path;
  } catch (e) {
    console.log("Ngarkimi i fotos se profilit deshtoi:", e);
    return null;
  }
}

/** URL e nënshkruar për shfaqje; null nëse s'merret dot. */
export async function signedUrlForProfilePhoto(storagePath: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);

  if (error) {
    console.log("URL e nenshkruar e fotos se profilit deshtoi:", error.message);
    return null;
  }
  return data?.signedUrl ?? null;
}
