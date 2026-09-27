import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/lib/supabase/client";

/**
 * Fshirja e llogarisë.
 *
 * Puna e vërtetë bëhet nga edge function `delete-account`, sepse klienti
 * s'ka të drejtë ta fshijë përdoruesin te `auth.users`. Këtu vetëm
 * thirret, dhe pastaj pastrohet telefoni: pa këtë, të dhënat e bebit do të
 * mbeteshin në AsyncStorage edhe pasi llogaria s'ekziston më.
 */

/** `error`: teksti i serverit (mesazhet tona janë shqip) ose gabimi i rrjetit — ekrani e përkthen. */
export type DeleteAccountResult = { ok: true } | { ok: false; error: unknown };

/** Çelësat që duhen fshirë nga telefoni. Ruajtja lokale është burimi i UI-së. */
const LOCAL_KEYS_PREFIX = ["bebix", "@bebix", "appState", "baby"];

async function clearLocalData(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const ours = keys.filter((key) => LOCAL_KEYS_PREFIX.some((prefix) => key.startsWith(prefix)));
    if (ours.length > 0) await AsyncStorage.multiRemove(ours);
  } catch {
    // Nëse pastrimi lokal dështon, llogaria në server është fshirë gjithsesi.
  }
}

export async function deleteAccount(): Promise<DeleteAccountResult> {
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) {
    return { ok: false, error: { message: "JWT: auth session missing" } };
  }

  try {
    const { data, error } = await supabase.functions.invoke<{ ok?: boolean; error?: string }>(
      "delete-account",
      { method: "POST" }
    );

    // Funksionet kthejnë gabimet si status jo-2xx; trupi mban arsyen e vërtetë.
    if (error) {
      const detail = await readFunctionError(error);
      return { ok: false, error: detail ? { message: detail } : error };
    }
    if (data?.error) return { ok: false, error: { message: data.error } };
    if (!data?.ok) return { ok: false, error: null };

    await clearLocalData();
    await supabase.auth.signOut();
    return { ok: true };
  } catch (e: unknown) {
    return { ok: false, error: e };
  }
}

/** supabase-js e fsheh trupin e përgjigjes te `context`; aty rri mesazhi ynë. */
async function readFunctionError(error: unknown): Promise<string | null> {
  const context = (error as { context?: unknown }).context;
  if (!context || typeof (context as Response).json !== "function") return null;
  try {
    const body = await (context as Response).json();
    return typeof body?.error === "string" ? body.error : null;
  } catch {
    return null;
  }
}
