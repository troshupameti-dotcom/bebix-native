import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/lib/supabase/client";

const PENDING_PROFILE_KEY = "bebix_pending_profile";

export type PendingProfile = {
  parentName: string;
  babyName: string;
  babyDob: string | null; // ISO date "YYYY-MM-DD", ose null nëse s'u dha
};

/**
 * Ruan përgjigjet e onboarding-ut (emri i bebit, emri i prindit, data e
 * lindjes) përkohësisht në pajisje, para se llogaria të krijohet.
 * Arsyeja: nëse Supabase kërkon konfirmim email-i, s'ka session menjëherë
 * pas signUp(), dhe RLS s'lejon shkrim te `baby_profiles` pa auth.uid().
 * Të dhënat mbesin këtu deri sa përdoruesi të ketë session aktiv (ose
 * menjëherë pas signUp, ose në login-in e parë), atëherë sinkronizohen.
 */
export async function savePendingProfile(data: PendingProfile) {
  await AsyncStorage.setItem(PENDING_PROFILE_KEY, JSON.stringify(data));
}

export async function getPendingProfile(): Promise<PendingProfile | null> {
  const raw = await AsyncStorage.getItem(PENDING_PROFILE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PendingProfile;
  } catch {
    return null;
  }
}

export async function clearPendingProfile() {
  await AsyncStorage.removeItem(PENDING_PROFILE_KEY);
}

/**
 * Shkruan (upsert) profilin e ruajtur përkohësisht te `baby_profiles`, pasi
 * përdoruesi ka session aktiv. S'hedh gabim nëse s'ka të dhëna të pritshme
 * (p.sh. dikush hyri direkt pa kaluar nga onboarding-u).
 */
export async function syncPendingProfileToSupabase(userId: string): Promise<void> {
  const pending = await getPendingProfile();
  if (!pending) return;

  const { error } = await supabase.from("baby_profiles").upsert({
    user_id: userId,
    parent_name: pending.parentName || null,
    baby_name: pending.babyName || null,
    baby_dob: pending.babyDob,
    updated_at: new Date().toISOString(),
  });

  if (!error) {
    await clearPendingProfile();
  }
  // Nëse dështon, mbetet e ruajtur — riprovohet herën tjetër që
  // syncPendingProfileToSupabase() thirret (p.sh. në login-in pasardhës).
}

/**
 * Konverton "DD.MM.VVVV" në "VVVV-MM-DD" (formati i pritur nga Postgres
 * `date`). Kthen null nëse formati ose data s'është e vlefshme.
 */
export function parseDobInput(value: string): string | null {
  const match = value.trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (!match) return null;
  const [, dd, mm, yyyy] = match;
  const day = Number(dd);
  const month = Number(mm);
  const year = Number(yyyy);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const iso = `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
  const d = new Date(iso);
  const valid =
    !Number.isNaN(d.getTime()) &&
    d.getUTCFullYear() === year &&
    d.getUTCMonth() + 1 === month &&
    d.getUTCDate() === day;

  return valid ? iso : null;
}

/**
 * Formaton input-in e datës ndërsa përdoruesi shkruan numra (p.sh. nga
 * tastiera "number-pad" e Android-it, e cila s'ka "."). Fut "." vetë pas
 * ditës dhe muajit: "15032025" -> "15.03.2025". Injoron çdo gjë që s'është
 * numër, dhe e kufizon në 8 shifra (DDMMVVVV).
 */
export function formatDobInput(text: string): string {
  const digits = text.replace(/\D/g, "").slice(0, 8);
  if (digits.length > 4) return `${digits.slice(0, 2)}.${digits.slice(2, 4)}.${digits.slice(4)}`;
  if (digits.length > 2) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  return digits;
}