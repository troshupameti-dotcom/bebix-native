import { supabase } from "@/lib/supabase/client";

export type ApplicationStatus = "pending" | "approved" | "rejected";

export type ExpertApplication = {
  id: string;
  fullName: string;
  licenseNumber: string;
  specialization: string;
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
    experienceYears: data.experience_years,
    phone: data.phone,
    bio: data.bio,
    status: data.status,
    adminNote: data.admin_note,
    createdAt: data.created_at,
    reviewedAt: data.reviewed_at,
  };
}

export async function submitApplication(input: {
  fullName: string;
  licenseNumber: string;
  specialization: string;
  experienceYears: number;
  phone: string;
  bio: string;
}) {
  const uid = await currentUserId();
  if (!uid) throw new Error("Duhesh me qenë i kyçun.");
  const { error } = await supabase.from("expert_applications").insert({
    user_id: uid,
    full_name: input.fullName,
    license_number: input.licenseNumber,
    specialization: input.specialization,
    experience_years: input.experienceYears,
    phone: input.phone,
    bio: input.bio,
    status: "pending",
  });
  if (error) throw error;
}