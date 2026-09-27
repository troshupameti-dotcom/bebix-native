import { useState } from "react";
import { View, Text, Pressable, TextInput, Image, ScrollView, Alert, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { useAppState } from "@/lib/state/AppStateContext";
import { ParentRelation } from "@/lib/state/types";
import { Icon } from "@/components/ui/Icon";
import { shadows } from "@/lib/shadows";
import { useAuthUser } from "@/lib/hooks/useAuthUser";
import { supabase } from "@/lib/supabase/client";
import { BackButton, goBackOr } from "@/components/ui/BackButton";
import { uploadProfilePhoto } from "@/lib/baby/profilePhotos";
import { syncProfilePhotoToSupabase } from "@/lib/babySync";
import { useCurrentUserId } from "@/lib/hooks/useCurrentUserId";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import type { TranslationKey } from "@/lib/i18n/translations";

const RELATIONS: { value: ParentRelation; labelKey: TranslationKey }[] = [
  { value: "mom", labelKey: "prof_rel_mom" },
  { value: "dad", labelKey: "prof_rel_dad" },
  { value: "guardian", labelKey: "prof_rel_guardian" },
];

const PROVIDER_KEYS: Record<string, TranslationKey> = {
  google: "prof_login_google",
  apple: "prof_login_apple",
  email: "prof_login_email",
};

export default function ProfileScreen() {
  const { state, updateProfile } = useAppState();
  const { t } = useTranslation();
  const userId = useCurrentUserId();
  const { email, provider, loading: authLoading } = useAuthUser();
  const [name, setName] = useState(state.profile.parentName || "");
  const [relation, setRelation] = useState<ParentRelation>(state.profile.relation);
  const [photo, setPhoto] = useState(state.profile.parentPhoto);
  const [photoPath, setPhotoPath] = useState(state.profile.parentPhotoPath);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const pickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8, allowsEditing: true, aspect: [1, 1] });
    if (result.canceled || !result.assets[0]) return;

    // Shfaqet menjehere nga cache-i, por ngarkohet sakaq: URI-ja e
    // ImagePicker vdes bashke me cache-in e app-it.
    const localUri = result.assets[0].uri;
    setPhoto(localUri);
    if (!userId) return;
    const path = await uploadProfilePhoto(userId, "parent", localUri);
    if (path) {
      setPhotoPath(path);
      void syncProfilePhotoToSupabase("parent", path);
    }
  };

  const save = () => {
    updateProfile({ parentName: name.trim() || null, relation, parentPhoto: photo, parentPhotoPath: photoPath });
    goBackOr("/(main)/more");
  };

  // Llogaritë e krijuara me Google/Apple s'kanë fjalëkalim derisa të caktojnë një.
  const isSocial = provider === "google" || provider === "apple";

  const savePassword = async () => {
    setPasswordError(null);
    if (password.length < 8) {
      setPasswordError(t("signup_error_password"));
      return;
    }
    if (password !== confirmPassword) {
      setPasswordError(t("signup_error_confirm_password"));
      return;
    }

    setSavingPassword(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSavingPassword(false);

    if (error) {
      setPasswordError(error.message);
      return;
    }

    setPassword("");
    setConfirmPassword("");
    Alert.alert(
      isSocial ? t("prof_pw_set_title") : t("prof_pw_changed_title"),
      t("prof_pw_body"),
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      <View className="flex-row items-center justify-between px-5 pt-2 mb-5">
        <BackButton fallback="/(main)/more" />
        <Text className="font-bodyMedium text-lg text-ink">{t("prof_title")}</Text>
        <Pressable onPress={save} className="px-4 py-2 rounded-full bg-olive">
          <Text className="font-bodySemibold text-xs text-on-accent">{t("prof_save")}</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <View className="items-center mb-6">
          <Pressable onPress={pickPhoto} className="w-24 h-24 rounded-full bg-olive-bg items-center justify-center overflow-hidden mb-2">
            {photo ? <Image source={{ uri: photo }} className="w-24 h-24" /> : <Icon name="camera" size={28} color="#6E7452" />}
          </Pressable>
          <Pressable onPress={pickPhoto}>
            <Text className="font-bodyMedium text-xs text-olive">{t("prof_change_photo")}</Text>
          </Pressable>
        </View>

        <View className="px-5">
          <Text className="font-bodySemibold text-xs text-ink-soft mb-2">{t("prof_name")}</Text>
          <View style={shadows.soft} className="bg-surface rounded-xl2 px-4 py-3 mb-5">
            <TextInput value={name} onChangeText={setName} placeholder={t("prof_ph_name")} placeholderClassName="text-ink-faint" className="font-body text-sm text-ink" />
          </View>

          <Text className="font-bodySemibold text-xs text-ink-soft mb-2">{t("prof_relation")}</Text>
          <View className="flex-row mb-5">
            {RELATIONS.map((r) => (
              <Pressable
                key={r.value}
                onPress={() => setRelation(r.value)}
                className={`px-4 py-2 rounded-full mr-2 ${relation === r.value ? "bg-olive" : "bg-surface"}`}
                style={relation !== r.value ? shadows.soft : undefined}
              >
                <Text className={`font-bodyMedium text-xs ${relation === r.value ? "text-on-accent" : "text-ink-soft"}`}>{t(r.labelKey)}</Text>
              </Pressable>
            ))}
          </View>

          <Text className="font-bodySemibold text-xs text-ink-soft mb-2">{t("prof_account")}</Text>
          <View style={shadows.soft} className="bg-surface rounded-xl2 px-4 py-3 mb-5">
            {authLoading ? (
              <ActivityIndicator className="text-olive" />
            ) : (
              <>
                <Text className="font-bodySemibold text-sm text-ink">{email ?? t("prof_no_email")}</Text>
                {provider ? (
                  <Text className="font-body text-xs text-ink-soft mt-1">
                    {PROVIDER_KEYS[provider] ? t(PROVIDER_KEYS[provider]) : t("prof_login_other", { provider })}
                  </Text>
                ) : null}
              </>
            )}
          </View>

          <Text className="font-bodySemibold text-xs text-ink-soft mb-2">
            {isSocial ? t("prof_set_password") : t("prof_change_password")}
          </Text>
          <View style={shadows.soft} className="bg-surface rounded-xl2 px-4 py-3">
            {isSocial ? (
              <Text className="font-body text-xs text-ink-soft mb-3 leading-5">
                {t("prof_social_note", { provider: provider === "google" ? "Google" : "Apple" })}
              </Text>
            ) : null}

            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder={t("prof_ph_new_password")}
              placeholderClassName="text-ink-faint"
              secureTextEntry
              autoComplete="new-password"
              className="font-body text-sm text-ink border-b border-cream-line pb-2 mb-3"
            />
            <TextInput
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder={t("prof_ph_repeat")}
              placeholderClassName="text-ink-faint"
              secureTextEntry
              autoComplete="new-password"
              className="font-body text-sm text-ink border-b border-cream-line pb-2"
            />

            {passwordError ? (
              <Text className="font-body text-xs text-red-500 mt-3">{passwordError}</Text>
            ) : null}

            <Pressable
              onPress={savePassword}
              disabled={savingPassword}
              className={`mt-4 py-2.5 rounded-full items-center ${savingPassword ? "bg-olive/50" : "bg-olive"}`}
            >
              {savingPassword ? (
                <ActivityIndicator className="text-on-accent" />
              ) : (
                <Text className="font-bodySemibold text-xs text-on-accent">
                  {isSocial ? t("prof_set_password_btn") : t("prof_save_password_btn")}
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
