import { File } from "expo-file-system";
import { supabase } from "@/lib/supabase/client";

export type ApplicationStatus = "pending" | "approved" | "rejected";

export type ExpertApplication = {
  id: string;
  fullName: string;
  licenseNumber: string;
  /** Teksti i specializimit (emri i repartit në çastin e aplikimit, ose teksti i lirë i aplikimeve të vjetra). */
  specialization: string;
  /** Çelësi i repartit (pediatrician, orthopedist, ...), null te aplikimet e vjetra. */
  specialtyKey: string | null;
  experienceYears: number;
  phone: string;
  bio: string;
  status: ApplicationStatus;
  adminNote: string | null;
  createdAt: string;
  reviewedAt: string | null;
};

async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

export async function fetchMyApplication(): Promise<ExpertApplication | null> {
  const uid = await currentUserId();
  if (!uid) return null;
  const { data, error } = await supabase
    .from("expert_applications")
    .select("*")
    .eq("user_id", uid)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    id: data.id,
    fullName: data.full_name,
    licenseNumber: data.license_number,
    specialization: data.specialization,
    specialtyKey: data.specialty_key ?? null,
    experienceYears: data.experience_years,
    phone: data.phone,
    bio: data.bio,
    status: data.status,
    adminNote: data.admin_note,
    createdAt: data.created_at,
    reviewedAt: data.reviewed_at,
  };
}

const LICENSE_BUCKET = "expert-licenses";

/** Foto e zgjedhur nga telefoni, ende pa u ngarkuar. */
export type LicensePhoto = { uri: string; mimeType?: string | null };

/** Ngarkon foton e licencës te bucket-i privat, në dosjen e përdoruesit. Kthen rrugën e ruajtur te aplikimi. */
export async function uploadLicensePhoto(photo: LicensePhoto): Promise<string> {
  const uid = await currentUserId();
  if (!uid) throw new Error("Duhesh me qenë i kyçun.");
  const mime = (photo.mimeType ?? "").toLowerCase();
  const ext = mime.includes("png") ? "png" : mime.includes("webp") ? "webp" : mime.includes("heic") ? "heic" : "jpg";
  const contentType = ext === "jpg" ? "image/jpeg" : `image/${ext}`;
  const path = `${uid}/license-${Date.now()}.${ext}`;

  let bytes: ArrayBuffer | null = null;
  try {
    bytes = await new File(photo.uri).arrayBuffer();
  } catch {
    // content:// nga zgjedhësi i Android-it: rruga rezervë me fetch.
  }
  if (!bytes || bytes.byteLength === 0) bytes = await (await fetch(photo.uri)).arrayBuffer();
  if (bytes.byteLength === 0) throw new Error("Fotoja u lexua bosh.");
  if (bytes.byteLength > 10 * 1024 * 1024) throw new Error("Fotoja është mbi 10 MB.");

  const { error } = await supabase.storage.from(LICENSE_BUCKET).upload(path, bytes, { contentType });
  if (error) throw new Error(`Ngarkimi i fotos dështoi: ${error.message}`);
  return path;
}

export async function submitApplication(input: {
  fullName: string;
  licenseNumber: string;
  /** Emri i repartit të zgjedhur (ruhet edhe si tekst, që aplikimi të lexohet pa listën e repartave). */
  specialization: string;
  specialtyKey: string | null;
  experienceYears: number;
  phone: string;
  bio: string;
  /** Rruga e fotos së licencës (nga `uploadLicensePhoto`). */
  licensePhotoPath: string;
}) {
  const uid = await currentUserId();
  if (!uid) throw new Error("Duhesh me qenë i kyçun.");
  const row = {
    license_photo_path: input.licensePhotoPath,
    user_id: uid,
    full_name: input.fullName,
    license_number: input.licenseNumber,
    specialization: input.specialization,
    experience_years: input.experienceYears,
    phone: input.phone,
    bio: input.bio,
    status: "pending",
  };
  const { error } = await supabase.from("expert_applications").insert({ ...row, specialty_key: input.specialtyKey });
  if (!error) return;
  // Para migrimit të repartave kolona `specialty_key` s'ekziston: aplikimi dërgohet me tekstin e repartit, si më parë.
  if (/specialty_key/i.test(error.message ?? "")) {
    const retry = await supabase.from("expert_applications").insert(row);
    if (!retry.error) return;
    throw retry.error;
  }
  throw error;
}