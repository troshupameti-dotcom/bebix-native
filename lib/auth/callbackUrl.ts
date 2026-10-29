import * as Linking from "expo-linking";
import Constants, { ExecutionEnvironment } from "expo-constants";

const isExpoGo = () => Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

/**
 * Adresa e app-it ku përfundon hyrja me Google dhe linku i rivendosjes së
 * fjalëkalimit (pra edhe adresa që pret `openAuthSessionAsync`).
 *
 * Në build-et e app-it (zhvillim dhe prodhim) është gjithmonë saktësisht
 * `bebix://auth/callback`. Më parë merrej nga `Linking.createURL`, që në
 * build-e jep `bebix:///auth/callback` (tri vija): kur ajo s'përputhej me
 * listën e lejuar te Supabase, Supabase e dërgonte përdoruesin te Site URL,
 * pra te webi, dhe app-i s'merrte kurrë sesionin.
 * Vetëm Expo Go ka adresë tjetër (exp://<IP>:8081/--/auth/callback).
 */
export function authCallbackUrl(): string {
  return isExpoGo() ? Linking.createURL("auth/callback") : "bebix://auth/callback";
}

/** Faqja e webit që e kthen hyrjen te Expo Go (bebix-web/public/auth/app.html). */
export const WEB_AUTH_RETURN = "https://www.bebix.store/auth/app.html";

/**
 * Adresa që i jepet Supabase-it si `redirectTo` (Google, rivendosja e fjalëkalimit).
 *
 * Build-et shkojnë drejt te `bebix://auth/callback`. Në Expo Go adresa exp://<IP>:8081 ndryshon me rrjetin dhe
 * Supabase s'e njeh, ndaj e kthente përdoruesin te webi (29 tetor). Prandaj kalon përmes faqes së webit, që
 * Supabase e pranon gjithmonë (i njëjti domain si Site URL) dhe që e çon menjëherë te Expo Go me sesionin.
 */
export function authRedirectTo(): string {
  const app = authCallbackUrl();
  return isExpoGo() ? `${WEB_AUTH_RETURN}?to=${encodeURIComponent(app)}` : app;
}
