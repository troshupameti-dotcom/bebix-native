import * as Device from "expo-device";
import Constants, { ExecutionEnvironment } from "expo-constants";
import { Platform } from "react-native";
import { supabase } from "@/lib/supabase/client";

/**
 * KUJDES: `expo-notifications` NUK importohet në krye me qëllim.
 *
 * Nga SDK 53, Expo Go s'i mban push notifications në Android, dhe vetë
 * importi i modulit hedh gabim. Meqë ky file importohet nga
 * app/(main)/_layout.tsx, ai gabim e rrëzonte gjithë layout-in e tab-eve:
 * route-i dukej "missing the required default export", dhe më pas <Stack>
 * dështonte me "Cannot read property 'ErrorBoundary' of undefined".
 *
 * Prandaj moduli ngarkohet vetëm pasi verifikohet që s'jemi në Expo Go.
 */
const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

type NotificationsModule = typeof import("expo-notifications");

/** undefined = ende e paprovuar, null = e padisponueshme ne kete mjedis. */
let cachedModule: NotificationsModule | null | undefined;

function loadNotifications(): NotificationsModule | null {
  if (cachedModule !== undefined) return cachedModule;

  if (isExpoGo) {
    console.log("Push notifications kërkojnë development build, jo Expo Go.");
    cachedModule = null;
    return null;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cachedModule = require("expo-notifications") as NotificationsModule;
    // Si duket njoftimi kur app-i është i hapur (foreground).
    cachedModule.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  } catch (e) {
    // Build i vjetër pa modulin nativ: s'ka push, por app-i punon.
    console.log("expo-notifications s'është i disponueshëm:", e);
    cachedModule = null;
  }

  return cachedModule;
}

/**
 * Kërkon leje, merr Expo Push Token, dhe e ruan në Supabase për përdoruesin
 * aktual. Thirret nga app/(main)/_layout.tsx, një herë për session, vetëm
 * kur përdoruesi është i kyçur.
 */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (!Device.isDevice) {
    // Emulatori s'merr push token real.
    console.log("Push notifications kërkojnë pajisje fizike, jo emulator.");
    return null;
  }

  const Notifications = loadNotifications();
  if (!Notifications) return null;

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    console.log("Leja e njoftimeve u refuzua.");
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

  // Ruaje në Supabase — lidhur me përdoruesin aktual.
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData?.user?.id;
  if (!userId) {
    console.log("Asnjë përdorues i kyçur — token-i nuk u ruajt.");
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
