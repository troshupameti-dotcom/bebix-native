import "react-native-url-polyfill/auto";
import { AppState } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // Një build pa këto dy vlera (p.sh. variablat e EAS-it mungojnë) rrëzohej
  // me një gabim të paqartë te createClient. Tani gabimi thotë çfarë mungon
  // dhe arrin te Sentry.
  throw new Error("Mungon EXPO_PUBLIC_SUPABASE_URL ose EXPO_PUBLIC_SUPABASE_ANON_KEY në konfigurimin e build-it.");
}

/**
 * Single Supabase client for the whole app. Unlike the web version there's
 * no browser/server split — React Native always runs "client-side", so
 * sessions are persisted to AsyncStorage (the RN equivalent of localStorage)
 * and auto-refreshed in the background.
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

/**
 * Rifreskimi i token-it vetëm kur app-i është në plan të parë (rekomandimi i
 * Supabase-it për React Native). Në sfond, kohëmatësit e rifreskimit nuk
 * xhirojnë me siguri: pas një pushimi të gjatë token-i kishte skaduar dhe
 * kërkesa e parë (p.sh. sync-u) dështonte me "JWT expired".
 */
AppState.addEventListener("change", (state) => {
  if (state === "active") {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});
