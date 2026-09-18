import { useCallback, useState } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator, ScrollView, Alert, Share, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { Icon } from "@/components/ui/Icon";
import { shadows } from "@/lib/shadows";
import { haptics } from "@/lib/haptics";
import { BackButton } from "@/components/ui/BackButton";
import { useThemeColors } from "@/lib/theme/useThemeColors";
import { useCurrentUserId } from "@/lib/hooks/useCurrentUserId";
import {
  fetchHousehold, createInviteCode, joinHousehold, leaveHousehold, HouseholdState,
} from "@/lib/baby/household";

export default function FamilyScreen() {
  const theme = useThemeColors();
  const myId = useCurrentUserId();

  const [household, setHousehold] = useState<HouseholdState | null>(null);
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setHousehold(await fetchHousehold());
    } catch (e: any) {
      setError(e?.message ?? "Të dhënat e familjes nuk u ngarkuan.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function handleCreateCode() {
    setBusy(true);
    setError(null);
    try {
      const fresh = await createInviteCode();
      setCode(fresh);
      haptics.tap();
    } catch (e: any) {
      setError(e?.message ?? "Kodi nuk u krijua.");
    } finally {
      setBusy(false);
    }
  }

  async function handleJoin() {
    if (joinCode.trim().length < 4) return;
    setBusy(true);
    setError(null);
    try {
      await joinHousehold(joinCode);
      setJoinCode("");
      setNotice("U bashkove me familjen. Të dhënat e bebit do të shfaqen pas sinkronizimit.");
      await load();
    } catch (e: any) {
      setError(e?.message ?? "Bashkimi dështoi.");
    } finally {
      setBusy(false);
    }
  }

  function confirmLeave(memberId: string, ownerId: string, isSelf: boolean) {
    Alert.alert(
      isSelf ? "Dil nga familja?" : "Hiq këtë prind?",
      isSelf
        ? "Nuk do t'i shohësh më të dhënat e bebit. Ato mbeten te prindi që i krijoi."
        : "Ky prind nuk do t'i shohë më të dhënat e bebit.",
      [
        { text: "Anulo", style: "cancel" },
        {
          text: isSelf ? "Dil" : "Hiqe",
          style: "destructive",
          onPress: async () => {
            try {
              await leaveHousehold(memberId, ownerId);
              await load();
            } catch (e: any) {
              setError(e?.message ?? "Veprimi dështoi.");
            }
          },
        },
      ]
    );
  }

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-cream items-center justify-center">
        <ActivityIndicator className="text-olive" />
      </SafeAreaView>
    );
  }

  const isOwner = household?.isOwner ?? true;
  const members = household?.members ?? [];

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View className="flex-row items-center px-5 pt-2 mb-4">
          <BackButton fallback="/(main)/more" className="mr-3" />
          <Text className="font-display text-xl text-ink">Familja</Text>
        </View>

        <ScrollView className="px-5" keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 40 }}>
          <Text className="font-body text-sm text-ink-soft leading-6 mb-5">
            Të dy prindërit mund të shohin dhe të shënojnë te i njëjti bebe: ushqyerjet, gjumin,
            pelenat, vaksinat dhe momentet. Çdo gjë që shënon njëri, e sheh tjetri.
          </Text>

          {notice && (
            <View className="bg-olive-bg rounded-xl2 p-3 mb-4">
              <Text className="font-body text-xs text-olive leading-5">{notice}</Text>
            </View>
          )}
          {error && (
            <View className="bg-orange-bg rounded-xl2 p-3 mb-4">
              <Text className="font-body text-xs text-orange leading-5">{error}</Text>
            </View>
          )}

          {isOwner ? (
            <>
              <View style={shadows.soft} className="bg-surface rounded-xl2 p-4 mb-4">
                <Text className="font-bodySemibold text-sm text-ink mb-1">Fto prindin tjetër</Text>
                <Text className="font-body text-xs text-ink-soft leading-5 mb-4">
                  Krijo një kod dhe dërgoja. Kodi vlen 7 ditë dhe përdoret një herë të vetme.
                </Text>

                {code ? (
                  <>
                    <View className="bg-cream-soft rounded-xl2 py-4 items-center mb-3">
                      <Text className="font-display text-3xl text-ink tracking-[6px]">{code}</Text>
                    </View>
                    <Pressable
                      onPress={() => Share.share({ message: `Bashkohu me bebin tonë te Bebix me kodin: ${code}` })}
                      className="bg-olive rounded-xl2 py-3 items-center"
                    >
                      <Text className="font-bodyMedium text-sm text-on-accent">Dërgo kodin</Text>
                    </Pressable>
                  </>
                ) : (
                  <Pressable
                    onPress={handleCreateCode}
                    disabled={busy}
                    className="bg-olive rounded-xl2 py-3 items-center"
                    style={{ opacity: busy ? 0.5 : 1 }}
                  >
                    {busy ? (
                      <ActivityIndicator color={theme.onAccent} />
                    ) : (
                      <Text className="font-bodySemibold text-sm text-on-accent">Krijo kod ftese</Text>
                    )}
                  </Pressable>
                )}
              </View>

              <View style={shadows.soft} className="bg-surface rounded-xl2 p-4 mb-4">
                <Text className="font-bodySemibold text-sm text-ink mb-3">
                  Prindërit në familje ({members.length + 1})
                </Text>

                <View className="flex-row items-center mb-3">
                  <View className="w-9 h-9 rounded-full bg-olive-bg items-center justify-center mr-3">
                    <Icon name="check" size={16} color="#6E7452" />
                  </View>
                  <Text className="flex-1 font-body text-sm text-ink">Ti</Text>
                  <Text className="font-body text-[11px] text-ink-faint">pronar i të dhënave</Text>
                </View>

                {members.length === 0 ? (
                  <Text className="font-body text-xs text-ink-faint">
                    Ende nuk ke ftuar askënd.
                  </Text>
                ) : (
                  members.map((m) => (
                    <View key={m.memberId} className="flex-row items-center mb-2">
                      <View className="w-9 h-9 rounded-full bg-cream-soft items-center justify-center mr-3">
                        <Icon name="family" size={16} color={theme.inkSoft} />
                      </View>
                      <Text className="flex-1 font-body text-sm text-ink">Prindi tjetër</Text>
                      <Pressable
                        onPress={() => confirmLeave(m.memberId, household!.ownerId, false)}
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel="Hiq nga familja"
                      >
                        <Text className="font-bodyMedium text-xs text-orange">Hiqe</Text>
                      </Pressable>
                    </View>
                  ))
                )}
              </View>

              <View style={shadows.soft} className="bg-surface rounded-xl2 p-4">
                <Text className="font-bodySemibold text-sm text-ink mb-1">Ke marrë një kod?</Text>
                <Text className="font-body text-xs text-ink-soft leading-5 mb-3">
                  Nëse bebin e ka krijuar prindi tjetër, shkruaj kodin e tij këtu. Kujdes: të dhënat
                  që ke shënuar në këtë telefon nuk bashkohen me të tijat.
                </Text>
                <TextInput
                  value={joinCode}
                  onChangeText={setJoinCode}
                  placeholder="P.sh. K7PQR2"
                  placeholderClassName="text-ink-faint"
                  autoCapitalize="characters"
                  autoCorrect={false}
                  maxLength={6}
                  className="bg-cream-soft rounded-xl2 px-4 py-3 font-body text-sm text-ink mb-3 tracking-[3px]"
                />
                <Pressable
                  onPress={handleJoin}
                  disabled={busy || joinCode.trim().length < 4}
                  className="bg-cream-soft rounded-xl2 py-3 items-center"
                  style={{ opacity: busy || joinCode.trim().length < 4 ? 0.5 : 1 }}
                >
                  <Text className="font-bodyMedium text-sm text-ink">Bashkohu</Text>
                </Pressable>
              </View>
            </>
          ) : (
            <View style={shadows.soft} className="bg-surface rounded-xl2 p-4">
              <View className="flex-row items-center mb-3">
                <View className="w-10 h-10 rounded-full bg-olive-bg items-center justify-center mr-3">
                  <Icon name="family" size={18} color="#6E7452" />
                </View>
                <View className="flex-1">
                  <Text className="font-bodySemibold text-sm text-ink">Je pjesë e një familjeje</Text>
                  <Text className="font-body text-xs text-ink-soft mt-0.5">
                    Po sheh të dhënat e bebit që krijoi prindi tjetër.
                  </Text>
                </View>
              </View>
              <Pressable
                onPress={() => myId && confirmLeave(myId, household!.ownerId, true)}
                className="bg-cream-soft rounded-xl2 py-3 items-center mt-2"
              >
                <Text className="font-bodyMedium text-sm text-orange">Dil nga familja</Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
