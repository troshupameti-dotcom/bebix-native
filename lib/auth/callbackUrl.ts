import * as Linking from "expo-linking";
import Constants, { ExecutionEnvironment } from "expo-constants";

/**
 * Adresa ku Supabase e kthen përdoruesin pas hyrjes me Google dhe pas linkut
 * të rivendosjes së fjalëkalimit.
 *
 * Në build-et e app-it (zhvillim dhe prodhim) është gjithmonë saktësisht
 * `bebix://auth/callback`. Më parë merrej nga `Linking.createURL`, që në
 * build-e jep `bebix:///auth/callback` (tri vija): kur ajo s'përputhej me
 * listën e lejuar te Supabase, Supabase e dërgonte përdoruesin te Site URL,
 * pra te webi, dhe app-i s'merrte kurrë sesionin.
 * Vetëm Expo Go ka adresë tjetër (exp://<IP>:8081/--/auth/callback).
 */
export function authCallbackUrl(): string {
  return Constants.executionEnvironment === ExecutionEnvironment.StoreClient
    ? Linking.createURL("auth/callback")
    : "bebix://auth/callback";
}
