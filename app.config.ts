import type { ConfigContext, ExpoConfig } from "expo/config";

/**
 * Konfigurimi bazë është te app.json. Këtu shtohet vetëm ajo që varet nga variablat e build-it:
 * hyrja native me Google në iPhone kërkon skemën e kthimit nga ID-ja iOS e Google
 * (EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID). Pa të, plugin-i s'shtohet dhe app-i përdor hyrjen në shfletues si më parë.
 */
export default ({ config }: ConfigContext): ExpoConfig => {
  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim();
  const plugins = [...(config.plugins ?? [])];
  if (iosClientId) {
    const id = iosClientId.replace(/\.apps\.googleusercontent\.com$/, "");
    plugins.push(["@react-native-google-signin/google-signin", { iosUrlScheme: `com.googleusercontent.apps.${id}` }]);
  }
  return { ...config, plugins } as ExpoConfig;
};
