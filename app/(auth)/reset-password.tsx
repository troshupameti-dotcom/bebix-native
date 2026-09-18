import { useState } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { supabase } from "@/lib/supabase/client";
import { Icon } from "@/components/ui/Icon";
import { shadows } from "@/lib/shadows";
import { useThemeColors } from "@/lib/theme/useThemeColors";

const MIN_PASSWORD = 6;

/**
 * Fjalëkalimi i ri, pasi përdoruesi ka hapur linkun nga email-i.
 *
 * Kur arrihet këtu, `app/auth/callback.tsx` e ka vendosur tashmë sesionin
 * me token-in e rikuperimit, prandaj `updateUser` ka të drejtë ta ndryshojë
 * fjalëkalimin pa e ditur të vjetrin.
 */
export default function ResetPasswordScreen() {
  const theme = useThemeColors();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tooShort = password.length > 0 && password.length < MIN_PASSWORD;
  const mismatch = confirm.length > 0 && confirm !== password;
  const canSave = password.length >= MIN_PASSWORD && confirm === password && !loading;

  async function handleSave() {
    if (!canSave) return;
    setLoading(true);
    setError(null);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw new Error(updateError.message);
      router.replace("/(main)/home");
    } catch (e: any) {
      const message: string = e?.message ?? "";
      setError(
        message.toLowerCase().includes("session")
          ? "Linku ka skaduar. Kërko një link të ri te 'Fjalëkalimi i harruar'."
          : message || "Fjalëkalimi nuk u ndryshua. Provo përsëri."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1 }}>
          <View className="px-6 pt-10">
            <Text className="font-display text-2xl text-ink mb-2">Fjalëkalim i ri</Text>
            <Text className="font-body text-sm text-ink-soft leading-6 mb-6">
              Zgjidh një fjalëkalim të ri për llogarinë tënde. Të paktën {MIN_PASSWORD} karaktere.
            </Text>

            <Text className="font-bodyMedium text-sm text-ink-soft mb-2">Fjalëkalimi i ri</Text>
            <View style={shadows.soft} className="flex-row items-center bg-surface rounded-xl2 px-4 mb-1">
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                placeholderClassName="text-ink-faint"
                secureTextEntry={!visible}
                autoCapitalize="none"
                className="flex-1 py-3 font-body text-sm text-ink"
              />
              <Pressable onPress={() => setVisible((v) => !v)} hitSlop={8} accessibilityLabel={visible ? "Fshih" : "Shfaq"}>
                <Icon name={visible ? "eyeOff" : "eye"} size={18} color={theme.inkFaint} />
              </Pressable>
            </View>
            <Text className="font-body text-[11px] text-orange mb-3 h-4">
              {tooShort ? `Të paktën ${MIN_PASSWORD} karaktere.` : ""}
            </Text>

            <Text className="font-bodyMedium text-sm text-ink-soft mb-2">Përsërite</Text>
            <TextInput
              value={confirm}
              onChangeText={setConfirm}
              placeholder="••••••••"
              placeholderClassName="text-ink-faint"
              secureTextEntry={!visible}
              autoCapitalize="none"
              style={shadows.soft}
              className="bg-surface rounded-xl2 px-4 py-3 font-body text-sm text-ink mb-1"
            />
            <Text className="font-body text-[11px] text-orange mb-3 h-4">
              {mismatch ? "Fjalëkalimet nuk përputhen." : ""}
            </Text>

            {error && (
              <View className="bg-orange-bg rounded-xl2 p-3 mb-4">
                <Text className="font-body text-xs text-orange leading-5">{error}</Text>
              </View>
            )}

            <Pressable
              onPress={handleSave}
              disabled={!canSave}
              className="bg-olive rounded-xl2 py-3.5 items-center"
              style={{ opacity: canSave ? 1 : 0.5 }}
            >
              {loading ? (
                <ActivityIndicator color={theme.onAccent} />
              ) : (
                <Text className="font-bodySemibold text-sm text-on-accent">Ruaj fjalëkalimin</Text>
              )}
            </Pressable>

            <Pressable onPress={() => router.replace("/(auth)/login")} className="items-center mt-5">
              <Text className="font-body text-xs text-ink-faint">Anulo dhe kthehu te kyçja</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
