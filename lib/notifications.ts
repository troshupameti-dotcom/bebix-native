import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { supabase } from "@/lib/supabase/client";

// Si duket notification-i kur app-i âsht i hapun (foreground)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Kërkon leje, merr Expo Push Token, dhe e ruan në Supabase të lidhun
 * me user-in aktual. Thirre një herë kur user-i hyn në app (psh te
 * app/_layout.tsx pas login-it, ose te Home screen në useEffect).
 */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (!Device.isDevice) {
    // Simulatori/emulatori s'mundet me marrë push token real.
    console.log("Push notifications kërkojnë pajisje fizike, jo emulator.");
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    console.log("Leja e notifications u refuzue.");
    return null;
  }

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#6E7452",
    });
  }

  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) {
    console.log("S'u gjet EAS projectId — kontrollo app.json.");
    return null;
  }

  const tokenResponse = await Notifications.getExpoPushTokenAsync({ projectId });
  const expoPushToken = tokenResponse.data;

  // Ruaje në Supabase — lidhur me user-in aktual të loguar.
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData?.user?.id;
  if (!userId) {
    console.log("Asnjë user i loguar — s'mundem me ruajtë token-in ende.");
    return expoPushToken;
  }

  const { error } = await supabase
    .from("push_tokens")
    .upsert({ user_id: userId, expo_push_token: expoPushToken }, { onConflict: "expo_push_token" });

  if (error) {
    console.log("Gabim gjatë ruajtjes së push token:", error.message);
  }

  return expoPushToken;
}