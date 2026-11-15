import { Alert } from "react-native";
import { pickMedia, type PickSource } from "@/lib/media/imagePicker";
import { useAppState } from "@/lib/state/AppStateContext";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { useCurrentUserId } from "@/lib/hooks/useCurrentUserId";
import { supabase } from "@/lib/supabase/client";
import { uploadProfilePhoto } from "@/lib/baby/profilePhotos";
import { syncProfilePhotoToSupabase } from "@/lib/babySync";

/**
 * Fotoja e bebit nga galeria ose nga kamera, e njëjtë te faqja kryesore dhe te cilësimet e bebit.
 * Fotoja del menjëherë (URI-ja e picker-it) dhe ngarkohet sakaq te Supabase: URI-ja rri në cache-in e app-it, që
 * sistemi e pastron kur do, ndaj pa ngarkimin fotoja zhdukej pa asnjë shenjë.
 * Kthen true kur u zgjodh një foto.
 */
export function useBabyPhotoPicker(): (source: PickSource) => Promise<boolean> {
  const { t } = useTranslation();
  const { updateProfile } = useAppState();
  const userId = useCurrentUserId();

  return async (source) => {
    const result = await pickMedia(source, { mediaTypes: ["images"], quality: 0.8, allowsEditing: true, aspect: [1, 1] }, t);
    const localUri = result?.assets[0]?.uri;
    if (!localUri) return false;
    updateProfile({ babyPhoto: localUri });

    // Llogaria merret drejt nga sesioni: hook-u mund të mos jetë gati ende, dhe atëherë fotoja mbetej vetëm në
    // cache-in e telefonit, pa u ngarkuar kurrë.
    const uid = userId ?? (await supabase.auth.getSession()).data.session?.user.id ?? null;
    if (!uid) return true;
    const path = await uploadProfilePhoto(uid, "baby", localUri);
    if (!path) {
      Alert.alert(t("baby_photo_upload_failed_title"), t("baby_photo_upload_failed_body"));
      return true;
    }
    updateProfile({ babyPhotoPath: path });
    // Që fotoja të mos jetojë vetëm në këtë pajisje: pas riinstalimit ose në një telefon tjetër rikthehet nga kjo rrugë.
    void syncProfilePhotoToSupabase("baby", path);
    return true;
  };
}
