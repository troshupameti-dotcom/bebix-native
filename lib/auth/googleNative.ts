import { NativeModules, Platform, TurboModuleRegistry } from "react-native";

const WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim() || "";
const IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim() || "";

/**
 * Hyrja native me Google: dritarja e Google-it në vetë telefonin, me emrin "Bebix", pa kaluar te shfletuesi me
 * adresën e serverit (…supabase.co). Ndizet vetëm kur build-i ka ID-të e Google-it dhe modulin native; në Expo Go
 * dhe pa ID përdoret hyrja në shfletues si më parë. Kontrolli i modulit bëhet para `require`-it (shih widgets/available).
 */
export function nativeGoogleAvailable(): boolean {
  if (Platform.OS === "web" || !WEB_CLIENT_ID) return false;
  if (Platform.OS === "ios" && !IOS_CLIENT_ID) return false;
  try {
    return (TurboModuleRegistry.get("RNGoogleSignin") ?? NativeModules.RNGoogleSignin) != null;
  } catch {
    return false;
  }
}

export type NativeGoogleResult = { type: "token"; idToken: string } | { type: "cancelled" };

/** Hap zgjedhjen e llogarisë Google dhe kthen ID token-in për `supabase.auth.signInWithIdToken`. */
export async function signInWithGoogleNative(): Promise<NativeGoogleResult> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const lib = require("@react-native-google-signin/google-signin") as typeof import("@react-native-google-signin/google-signin");
  const { GoogleSignin, isSuccessResponse, isErrorWithCode, statusCodes } = lib;
  GoogleSignin.configure({ webClientId: WEB_CLIENT_ID, ...(IOS_CLIENT_ID ? { iosClientId: IOS_CLIENT_ID } : {}) });
  try {
    if (Platform.OS === "android") await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    // Çdo herë pyetet për llogarinë (si `prompt=select_account` në shfletues), jo rikyçje e heshtur e së fundit.
    await GoogleSignin.signOut().catch(() => null);
    const response = await GoogleSignin.signIn();
    if (!isSuccessResponse(response)) return { type: "cancelled" };
    const idToken = response.data.idToken;
    if (!idToken) throw new Error("Google s'ktheu ID token");
    return { type: "token", idToken };
  } catch (e) {
    if (isErrorWithCode(e) && (e.code === statusCodes.SIGN_IN_CANCELLED || e.code === statusCodes.IN_PROGRESS)) {
      return { type: "cancelled" };
    }
    throw e;
  }
}
