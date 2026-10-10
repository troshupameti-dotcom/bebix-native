import { log } from "@/lib/log";
import * as Device from "expo-device";
import AsyncStorage from "@react-native-async-storage/async-storage";
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
    log("Push notifications kërkojnë development build, jo Expo Go.");
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
    log("expo-notifications s'është i disponueshëm:", e);
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
    log("Push notifications kërkojnë pajisje fizike, jo emulator.");
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
    log("Leja e njoftimeve u refuzua.");
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
    log("S'u gjet EAS projectId — kontrollo app.json.");
    return null;
  }

  const tokenResponse = await Notifications.getExpoPushTokenAsync({ projectId });
  const expoPushToken = tokenResponse.data;

  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user.id;
  if (!userId) {
    log("Asnjë përdorues i kyçur — token-i nuk u ruajt.");
    return expoPushToken;
  }

  // Token-i është i telefonit: nëse ishte i një llogarie tjetër (dikush tjetër
  // u kyç më parë këtu), funksioni ia kalon llogarisë së kyçur tani. Me
  // upsert-in e vjetër kjo dështonte, dhe njoftimet e llogarisë së mëparshme
  // vazhdonin të vinin në këtë telefon.
  const { error } = await supabase.rpc("register_push_token", { p_token: expoPushToken });
  if (error) {
    log("Gabim gjatë ruajtjes së push token:", error.message);
  } else {
    await AsyncStorage.setItem(PUSH_TOKEN_KEY, expoPushToken);
  }

  return expoPushToken;
}

const PUSH_TOKEN_KEY = "bebix_push_token";

/**
 * Thirret PARA daljes nga llogaria: telefoni nuk duhet të marrë më kujtesat e
 * bebit dhe porositë e llogarisë që sapo doli.
 */
export async function unregisterPushToken(): Promise<void> {
  try {
    const token = await AsyncStorage.getItem(PUSH_TOKEN_KEY);
    if (!token) return;
    await supabase.rpc("unregister_push_token", { p_token: token });
    await AsyncStorage.removeItem(PUSH_TOKEN_KEY);
  } catch {
    // Pa rrjet: serveri e heq token-in vetë kur Expo e raporton si të pavlefshëm,
    // ose kur llogaria tjetër e regjistron sërish në këtë telefon.
  }
}

const WEEKLY_RECAP_ID = "bebix-weekly-recap";

/**
 * Përmbledhja e së hënës: njoftim lokal çdo të hënë në 09:00 (jashtë orëve
 * të qeta), një herë në javë. S'kërkon leje vetë — përdor atë që u dha te
 * hyrja; pa leje, ose kur prindi e fik, hiqet.
 */
export async function syncWeeklyRecapReminder(opts: { enabled: boolean; title: string; body: string }): Promise<void> {
  const Notifications = loadNotifications();
  if (!Notifications) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(WEEKLY_RECAP_ID);
    if (!opts.enabled) return;
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== "granted") return;
    await Notifications.scheduleNotificationAsync({
      identifier: WEEKLY_RECAP_ID,
      content: { title: opts.title, body: opts.body, data: { type: "weekly" } },
      // 1 = e diel, pra 2 = e hëna.
      trigger: { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday: 2, hour: 9, minute: 0, channelId: "default" },
    });
  } catch (e) {
    log("Përmbledhja javore s'u planifikua:", e);
  }
}

/**
 * Dëgjon prekjen e njoftimeve dhe thërret `onOpen` me `data`-n e tyre — edhe
 * për njoftimin që e hapi app-in nga e mbyllura. Kthen funksionin që ndal dëgjimin.
 */
/** Njoftimet e trajtuara tashmë: layout-i mund të rimontohet (p.sh. pas hyrjes). */
const handledOpens = new Set<string>();

export function listenForNotificationOpens(onOpen: (data: unknown) => void): () => void {
  const Notifications = loadNotifications();
  if (!Notifications) return () => {};

  const handle = (response: import("expo-notifications").NotificationResponse) => {
    const id = response.notification.request.identifier;
    if (handledOpens.has(id)) return;
    handledOpens.add(id);
    onOpen(response.notification.request.content.data);
  };

  const subscription = Notifications.addNotificationResponseReceivedListener(handle);
  Notifications.getLastNotificationResponseAsync()
    .then((response) => {
      if (response) handle(response);
    })
    .catch(() => {});

  return () => subscription.remove();
}
