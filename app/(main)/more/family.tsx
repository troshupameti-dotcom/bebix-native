import { useCallback, useState } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator, ScrollView, Alert, Share, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { Icon } from "@/components/ui/Icon";
import { shadows } from "@/lib/shadows";
import { haptics } from "@/lib/haptics";
import { BackButton } from "@/components/ui/BackButton";
import { useThemeColors } from "@/lib/theme/useThemeColors";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { useCurrentUserId } from "@/lib/hooks/useCurrentUserId";
import {
  fetchHousehold, createInviteCode, joinHousehold, leaveHousehold, HouseholdState,
} from "@/lib/baby/household";
import { syncBabyRecords } from "@/lib/baby/babyRecordsSync";
import { retrySync } from "@/lib/baby/syncStatus";
import { useAppState } from "@/lib/state/AppStateContext";
import { friendlyError } from "@/lib/errors/userMessage";

export default function FamilyScreen() {
  const theme = useThemeColors();
  const { t } = useTranslation();
  const myId = useCurrentUserId();
  const { state } = useAppState();

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
    } catch (e: unknown) {
      setError(friendlyError(e, t, "fam_err_load"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function handleCreateCode() {
    setBusy(true);
    setError(null);
    try {
      const fresh = await createInviteCode();
      setCode(fresh);
      haptics.tap();
    } catch (e: unknown) {
      setError(friendlyError(e, t, "fam_err_code"));
    } finally {
      setBusy(false);
    }
  }

  async function handleJoin() {
    if (joinCode.trim().length < 4) return;
    setBusy(true);
    setError(null);
    try {
      // Shënimet e veta që s'kanë arritur ende në server dërgohen PARA se
      // telefoni të kalojë te bebi i familjes (pas bashkimit pastrohen).
      try {
        await syncBabyRecords(state.baby);
      } catch {
        // Pa rrjet, bashkimi do të dështojë vetë me mesazhin e vet.
      }
      await joinHousehold(joinCode);
      setJoinCode("");
      setNotice(t("fam_joined"));
      // Sync-u vëren pronarin e ri dhe tërheq historikun e familjes.
      retrySync();
      await load();
    } catch (e: unknown) {
      setError(friendlyError(e, t, "fam_err_join"));
    } finally {
      setBusy(false);
    }
  }

  function confirmLeave(memberId: string, ownerId: string, isSelf: boolean) {
    Alert.alert(
      isSelf ? t("fam_leave_q") : t("fam_remove_q"),
      isSelf
        ? t("fam_leave_body")
        : t("fam_remove_body"),
      [
        { text: t("cancel_action"), style: "cancel" },
        {
          text: isSelf ? t("fam_leave_action") : t("fam_remove"),
          style: "destructive",
          onPress: async () => {
            try {
              await leaveHousehold(memberId, ownerId);
              // Kush del, kthehet te historiku i vet.
              if (isSelf) retrySync();
              await load();
            } catch (e: unknown) {
              setError(friendlyError(e, t, "fam_err_action"));
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
          <Text className="font-display text-xl text-ink">{t("family_title")}</Text>
        </View>

        <ScrollView className="px-5" keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 40 }}>
          <Text className="font-body text-sm text-ink-soft leading-6 mb-5">
            {t("fam_intro")}
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
                <Text className="font-bodySemibold text-sm text-ink mb-1">{t("fam_invite_title")}</Text>
                <Text className="font-body text-xs text-ink-soft leading-5 mb-4">
                  {t("fam_invite_body")}
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
                      <Text className="font-bodyMedium text-sm text-on-accent">{t("fam_send_code")}</Text>
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
                      <Text className="font-bodySemibold text-sm text-on-accent">{t("fam_create_code")}</Text>
                    )}
                  </Pressable>
                )}
              </View>

              <View style={shadows.soft} className="bg-surface rounded-xl2 p-4 mb-4">
                <Text className="font-bodySemibold text-sm text-ink mb-3">
                  {t("fam_members_count")} ({members.length + 1})
                </Text>

                <View className="flex-row items-center mb-3">
                  <View className="w-9 h-9 rounded-full bg-olive-bg items-center justify-center mr-3">
                    <Icon name="check" size={16} color="#6E7452" />
                  </View>
                  <Text className="flex-1 font-body text-sm text-ink">{t("fam_you")}</Text>
                  <Text className="font-body text-[11px] text-ink-faint">{t("fam_owner")}</Text>
                </View>

                {members.length === 0 ? (
                  <Text className="font-body text-xs text-ink-faint">
                    {t("fam_none_invited")}
                  </Text>
                ) : (
                  members.map((m) => (
                    <View key={m.memberId} className="flex-row items-center mb-2">
                      <View className="w-9 h-9 rounded-full bg-cream-soft items-center justify-center mr-3">
                        <Icon name="family" size={16} color={theme.inkSoft} />
                      </View>
                      <Text className="flex-1 font-body text-sm text-ink">{t("fam_other_parent")}</Text>
                      <Pressable
                        onPress={() => confirmLeave(m.memberId, household!.ownerId, false)}
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel={t("fam_remove_label")}
                      >
                        <Text className="font-bodyMedium text-xs text-orange">{t("fam_remove")}</Text>
                      </Pressable>
                    </View>
                  ))
                )}
              </View>

              <View style={shadows.soft} className="bg-surface rounded-xl2 p-4">
                <Text className="font-bodySemibold text-sm text-ink mb-1">{t("fam_have_code")}</Text>
                <Text className="font-body text-xs text-ink-soft leading-5 mb-3">
                  {t("fam_have_code_body")}
                </Text>
                <TextInput
                  value={joinCode}
                  onChangeText={setJoinCode}
                  placeholder={t("fam_code_ph")}
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
                  <Text className="font-bodyMedium text-sm text-ink">{t("fam_join")}</Text>
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
                  <Text className="font-bodySemibold text-sm text-ink">{t("fam_member_title")}</Text>
                  <Text className="font-body text-xs text-ink-soft mt-0.5">
                    {t("fam_member_body")}
                  </Text>
                </View>
              </View>
              <Pressable
                onPress={() => myId && confirmLeave(myId, household!.ownerId, true)}
                className="bg-cream-soft rounded-xl2 py-3 items-center mt-2"
              >
                <Text className="font-bodyMedium text-sm text-orange">{t("fam_leave")}</Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
