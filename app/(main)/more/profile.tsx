import { useState } from "react";
import { View, Text, Pressable, TextInput, Image, ScrollView, Alert, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { useAppState } from "@/lib/state/AppStateContext";
import { ParentRelation } from "@/lib/state/types";
import { Icon } from "@/components/ui/Icon";
import { shadows } from "@/lib/shadows";
import { useAuthUser } from "@/lib/hooks/useAuthUser";
import { supabase } from "@/lib/supabase/client";

const RELATIONS: { value: ParentRelation; label: string }[] = [
  { value: "mom", label: "Mama" },
  { value: "dad", label: "Babi" },
  { value: "guardian", label: "Kujdestar/e" },
];

const PROVIDER_LABELS: Record<string, string> = {
  google: "Hyrje me Google",
  apple: "Hyrje me Apple",
  email: "Hyrje me email",
};

export default function ProfileScreen() {
  const router = useRouter();
  const { state, updateProfile } = useAppState();
  const { email, provider, loading: authLoading } = useAuthUser();
  const [name, setName] = useState(state.profile.parentName || "");
  const [relation, setRelation] = useState<ParentRelation>(state.profile.relation);
  const [photo, setPhoto] = useState(state.profile.parentPhoto);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const pickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8, allowsEditing: true, aspect: [1, 1] });
    if (!result.canceled) setPhoto(result.assets[0].uri);
  };

  const save = () => {
    updateProfile({ parentName: name.trim() || null, relation, parentPhoto: photo });
    router.back();
  };

  // Llogaritë e krijuara me Google/Apple s'kanë fjalëkalim derisa të caktojnë një.
  const isSocial = provider === "google" || provider === "apple";

  const savePassword = async () => {
    setPasswordError(null);
    if (password.length < 8) {
      setPasswordError("Të paktën 8 karaktere.");
      return;
    }
    if (password !== confirmPassword) {
      setPasswordError("Fjalëkalimet nuk përputhen.");
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
      isSocial ? "Fjalëkalimi u caktua" : "Fjalëkalimi u ndryshua",
      "Tani mund të hysh edhe me email.",
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      <View className="flex-row items-center justify-between px-5 pt-2 mb-5">
        <Pressable onPress={() => router.back()} style={shadows.soft} className="w-10 h-10 rounded-full bg-surface items-center justify-center">
          <Icon name="chevronLeft" size={18} color="#2C271F" />
        </Pressable>
        <Text className="font-bodyMedium text-lg text-ink">Profili im</Text>
        <Pressable onPress={save} className="px-4 py-2 rounded-full bg-olive">
          <Text className="font-bodySemibold text-xs text-white">Ruaj</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <View className="items-center mb-6">
          <Pressable onPress={pickPhoto} className="w-24 h-24 rounded-full bg-olive-bg items-center justify-center overflow-hidden mb-2">
            {photo ? <Image source={{ uri: photo }} className="w-24 h-24" /> : <Icon name="camera" size={28} color="#6E7452" />}
          </Pressable>
          <Pressable onPress={pickPhoto}>
            <Text className="font-bodyMedium text-xs text-olive">Ndrysho foton</Text>
          </Pressable>
        </View>

        <View className="px-5">
          <Text className="font-bodySemibold text-xs text-ink-soft mb-2">Emri</Text>
          <View style={shadows.soft} className="bg-surface rounded-xl2 px-4 py-3 mb-5">
            <TextInput value={name} onChangeText={setName} placeholder="Emri yt" placeholderTextColor="#A79D8A" className="font-body text-sm text-ink" />
          </View>

          <Text className="font-bodySemibold text-xs text-ink-soft mb-2">Lidhja me bebin</Text>
          <View className="flex-row mb-5">
            {RELATIONS.map((r) => (
              <Pressable
                key={r.value}
                onPress={() => setRelation(r.value)}
                className={`px-4 py-2 rounded-full mr-2 ${relation === r.value ? "bg-olive" : "bg-surface"}`}
                style={relation !== r.value ? shadows.soft : undefined}
              >
                <Text className={`font-bodyMedium text-xs ${relation === r.value ? "text-white" : "text-ink-soft"}`}>{r.label}</Text>
              </Pressable>
            ))}
          </View>

          <Text className="font-bodySemibold text-xs text-ink-soft mb-2">Llogaria</Text>
          <View style={shadows.soft} className="bg-surface rounded-xl2 px-4 py-3 mb-5">
            {authLoading ? (
              <ActivityIndicator color="#6E7452" />
            ) : (
              <>
                <Text className="font-bodySemibold text-sm text-ink">{email ?? "Pa email"}</Text>
                {provider ? (
                  <Text className="font-body text-xs text-ink-soft mt-1">
                    {PROVIDER_LABELS[provider] ?? `Hyrje me ${provider}`}
                  </Text>
                ) : null}
              </>
            )}
          </View>

          <Text className="font-bodySemibold text-xs text-ink-soft mb-2">
            {isSocial ? "Cakto fjalëkalim" : "Ndrysho fjalëkalimin"}
          </Text>
          <View style={shadows.soft} className="bg-surface rounded-xl2 px-4 py-3">
            {isSocial ? (
              <Text className="font-body text-xs text-ink-soft mb-3 leading-5">
                Hyre me {provider === "google" ? "Google" : "Apple"}. Cakto një fjalëkalim për të hyrë edhe me email.
              </Text>
            ) : null}

            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="Fjalëkalimi i ri"
              placeholderTextColor="#A79D8A"
              secureTextEntry
              autoComplete="new-password"
              className="font-body text-sm text-ink border-b border-cream-line pb-2 mb-3"
            />
            <TextInput
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Shkruaje përsëri"
              placeholderTextColor="#A79D8A"
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
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text className="font-bodySemibold text-xs text-white">
                  {isSocial ? "Cakto fjalëkalimin" : "Ruaj fjalëkalimin"}
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
