import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/lib/supabase/client";
import { resolveDataOwnerId } from "@/lib/baby/household";
import type { AppState, BabyGender, BloodType } from "@/lib/state/types";
import type { EmergencyContact, MedicalInfoRow } from "@/lib/state/babyTypes";

/**
 * Cilësimet e bebit përtej emrit dhe datës së lindjes: gjinia, grupi i gjakut,
 * alergjitë, pediatri, shënimet, kontaktet e urgjencës dhe info mjekësore.
 *
 * Më parë rrinin vetëm në telefon: pas ndërrimit të telefonit, ri-instalimit
 * ose rimarrjes së të dhënave nga llogaria dilnin bosh, dhe prindi tjetër i
 * familjes s'i shihte kurrë. Tani ruhen te `baby_profiles.details` (JSON).
 */
export type ProfileDetails = {
  nickname: string | null;
  babyGender: BabyGender;
  bloodType: BloodType;
  allergies: string;
  pediatrician: string;
  medicalNotes: string;
  parentNotes: string;
  emergencyContacts: EmergencyContact[];
  medicalInfo: MedicalInfoRow[];
  medicalActiveKeys: string[];
};

export function detailsFromState(state: AppState): ProfileDetails {
  const p = state.profile;
  return {
    nickname: p.nickname,
    babyGender: p.babyGender,
    bloodType: p.bloodType,
    allergies: p.allergies,
    pediatrician: p.pediatrician,
    medicalNotes: p.medicalNotes,
    parentNotes: p.parentNotes,
    emergencyContacts: state.baby.emergencyContacts,
    medicalInfo: state.baby.medicalInfo,
    medicalActiveKeys: state.baby.medicalActiveKeys,
  };
}

/** Pranon vetëm fushat e njohura me llojin e duhur (JSON-i vjen nga serveri). */
export function parseDetails(raw: unknown): Partial<ProfileDetails> | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const out: Partial<ProfileDetails> = {};
  const str = (k: keyof ProfileDetails) => {
    if (typeof r[k] === "string") (out as Record<string, unknown>)[k] = r[k];
  };
  (["allergies", "pediatrician", "medicalNotes", "parentNotes"] as const).forEach(str);
  if (typeof r.nickname === "string" || r.nickname === null) out.nickname = r.nickname as string | null;
  if (r.babyGender === "girl" || r.babyGender === "boy" || r.babyGender === "other") out.babyGender = r.babyGender;
  if (r.bloodType === null || (typeof r.bloodType === "string" && /^(0|A|B|AB)[+-]$/.test(r.bloodType))) {
    out.bloodType = r.bloodType as BloodType;
  }
  if (Array.isArray(r.emergencyContacts)) {
    out.emergencyContacts = r.emergencyContacts.filter(
      (c): c is EmergencyContact =>
        !!c && typeof c === "object" && typeof (c as EmergencyContact).id === "string" && typeof (c as EmergencyContact).name === "string"
    );
  }
  if (Array.isArray(r.medicalInfo)) {
    out.medicalInfo = r.medicalInfo.filter(
      (m): m is MedicalInfoRow => !!m && typeof m === "object" && typeof (m as MedicalInfoRow).key === "string"
    );
  }
  if (Array.isArray(r.medicalActiveKeys)) {
    out.medicalActiveKeys = r.medicalActiveKeys.filter((k): k is string => typeof k === "string");
  }
  return Object.keys(out).length ? out : null;
}

const DETAILS_PENDING_KEY = "bebix_baby_details_pending";

/** Dërgon detajet te serveri; kur s'ka rrjet, i shënon "në pritje" për hapjen tjetër. */
export async function saveProfileDetailsRemote(details: ProfileDetails): Promise<boolean> {
  try {
    const ownerId = await resolveDataOwnerId();
    if (!ownerId) throw new Error("no owner");
    const { error } = await supabase
      .from("baby_profiles")
      .upsert({ user_id: ownerId, details, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
    if (error) throw error;
    await AsyncStorage.removeItem(DETAILS_PENDING_KEY);
    return true;
  } catch {
    await AsyncStorage.setItem(DETAILS_PENDING_KEY, "1");
    return false;
  }
}

export async function isProfileDetailsPending(): Promise<boolean> {
  return (await AsyncStorage.getItem(DETAILS_PENDING_KEY)) === "1";
}

/** Detajet e ruajtura te serveri, ose null (s'ka rresht, s'ka rrjet, ose bosh). */
export async function fetchProfileDetails(): Promise<Partial<ProfileDetails> | null> {
  const ownerId = await resolveDataOwnerId();
  if (!ownerId) return null;
  const { data, error } = await supabase.from("baby_profiles").select("details").eq("user_id", ownerId).maybeSingle();
  if (error || !data) return null;
  return parseDetails(data.details);
}
