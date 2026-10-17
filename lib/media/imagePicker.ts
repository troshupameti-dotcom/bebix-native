import { Alert, AppState, Linking } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { captureToSentry } from "@/lib/errors/sentry";
import type { TranslationKey } from "@/lib/i18n/translations";

type T = (key: TranslationKey, params?: Record<string, string | number>) => string;
export type PickSource = "library" | "camera";

/**
 * Hapja e galerisë ose e kamerës, e njëjtë për gjithë app-in.
 *
 * Gabimet në Sentry (REACT-NATIVE-2 dhe 3, Android): "Attempting to launch an unregistered ActivityResultLauncher".
 * Ndodh kur Android-i e ka mbyllur dhe rikrijuar dritaren e app-it (p.sh. telefon me pak memorie, ndërsa galeria
 * ishte e hapur): picker-i s'hapet më derisa app-i të rihapet. Më parë thirrja dështonte pa u kapur, prindi s'shihte
 * asgjë dhe shtypte sërish (14 herë brenda 90 sekondave). Tani:
 *  - një picker në të njëjtën kohë (shtypja e dytë injorohet derisa i pari të mbyllet);
 *  - vetëm kur app-i është aktiv;
 *  - leja kontrollohet para hapjes; kur mungon, prindi e di dhe mund të hapë Cilësimet;
 *  - çdo gabim kapet: mesazh i qartë në shqip, dhe gabimi shkon te Sentry si i trajtuar.
 *
 * Kthen rezultatin e picker-it, ose null kur s'u zgjodh asgjë (anuluar, pa leje, gabim, ose një picker tjetër hapur).
 */
let isPicking = false;

export async function pickMedia(
  source: PickSource,
  options: ImagePicker.ImagePickerOptions,
  t: T
): Promise<ImagePicker.ImagePickerSuccessResult | null> {
  if (isPicking) return null;
  if (AppState.currentState !== "active") return null;
  isPicking = true;
  try {
    const permission =
      source === "camera"
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      showPermissionAlert(source, permission.canAskAgain, t);
      return null;
    }
    const result =
      source === "camera" ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
    return result.canceled ? null : result;
  } catch (error) {
    captureToSentry(error, source === "camera" ? "image_picker_camera" : "image_picker_library");
    Alert.alert(t("picker_failed_title"), t("picker_failed_body"));
    return null;
  } finally {
    isPicking = false;
  }
}

function showPermissionAlert(source: PickSource, canAskAgain: boolean, t: T) {
  const title = t(source === "camera" ? "picker_camera_denied_title" : "picker_library_denied_title");
  const body = t(source === "camera" ? "picker_camera_denied_body" : "picker_library_denied_body");
  // Kur Android-i s'e pyet më (u refuzua "mos pyet më"), leja jepet vetëm te Cilësimet e telefonit.
  Alert.alert(
    title,
    body,
    canAskAgain
      ? [{ text: t("picker_ok") }]
      : [
          { text: t("picker_ok"), style: "cancel" },
          { text: t("picker_open_settings"), onPress: () => void Linking.openSettings() },
        ]
  );
}

/** Vetëm për testet. */
export function __resetPickerForTests(): void {
  isPicking = false;
}
