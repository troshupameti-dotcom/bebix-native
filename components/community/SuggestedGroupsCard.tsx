import { useEffect, useMemo, useState } from "react";
import { View, Text, Pressable, ActivityIndicator, Alert } from "react-native";
import { useRouter } from "expo-router";
import { Icon } from "@/components/ui/Icon";
import { shadows } from "@/lib/shadows";
import { haptics } from "@/lib/haptics";
import { useThemeColors } from "@/lib/theme/useThemeColors";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { useToast } from "@/lib/toast/ToastContext";
import { useAppState } from "@/lib/state/AppStateContext";
import {
  activeSnoozes, AUTO_GROUPS_ENABLED, autoGroupLabel, fetchGroupSuggestions, growthPair, joinSuggestedGroup, leaveAutoGroup,
  loadSnoozes, snooze, type Suggestion,
} from "@/lib/community/autoGroups";

/**
 * "Grupe për bebin tënd": 1–2 sugjerime me "Bashkohu" dhe "Jo tash" (30
 * ditë). Kur bebi rritet: "Bebi po rritet: bashkohu te 6–12 muaj", me
 * mundësinë për të dalë nga grupi i vjetër. Prindi vendos vetë; asgjë s'bëhet
 * automatikisht. `showProfileLink`: pa datëlindje, një lidhje e vogël te
 * profili i bebit (vetëm te "Grupet").
 */
export function SuggestedGroupsCard({ refreshKey, showProfileLink = false }: { refreshKey: number; showProfileLink?: boolean }) {
  const router = useRouter();
  const { t } = useTranslation();
  const theme = useThemeColors();
  const { showToast } = useToast();
  const { state } = useAppState();
  const [list, setList] = useState<Suggestion[] | null>(null);
  const [snoozed, setSnoozed] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!AUTO_GROUPS_ENABLED) return;
    let alive = true;
    void Promise.all([fetchGroupSuggestions(), loadSnoozes()]).then(([s, sn]) => {
      if (!alive) return;
      setList(s);
      setSnoozed(activeSnoozes(sn));
    });
    return () => {
      alive = false;
    };
  }, [refreshKey]);

  const visible = useMemo(() => (list ?? []).filter((s) => !snoozed.has(s.key)), [list, snoozed]);
  const growth = growthPair(visible);
  const joins = visible.filter((s) => s.action === "join").slice(0, 2);
  const leaves = visible.filter((s) => s.action === "leave" && s.key !== growth?.leave);

  if (!AUTO_GROUPS_ENABLED || list === null) return null;

  if (visible.length === 0) {
    if (!showProfileLink || state.profile.babyDob) return null;
    return (
      <Pressable onPress={() => router.push("/(main)/baby/settings")} accessibilityRole="button" className="mx-5 mb-3 flex-row items-center py-2" style={{ minHeight: 44 }}>
        <Icon name="baby" size={14} color={theme.olive} />
        <Text className="ml-2 flex-1 font-bodyMedium text-xs text-olive">{t("ag_add_dob")}</Text>
        <Icon name="chevronRight" size={14} color={theme.olive} />
      </Pressable>
    );
  }

  async function join(key: string) {
    haptics.tap();
    setBusy(key);
    try {
      const groupId = await joinSuggestedGroup(key);
      haptics.success();
      setList((prev) => (prev ?? []).filter((s) => s.key !== key));
      showToast(t("ag_joined", { name: autoGroupLabel(key, t) }));
      router.push(`/community/group/${groupId}`);
    } catch {
      showToast(t("ag_error"));
    } finally {
      setBusy(null);
    }
  }

  function leave(key: string) {
    haptics.select();
    Alert.alert(t("ag_leave_title", { name: autoGroupLabel(key, t) }), t("ag_leave_body"), [
      { text: t("cancel_action"), style: "cancel" },
      {
        text: t("ag_leave"),
        style: "destructive",
        onPress: async () => {
          try {
            await leaveAutoGroup(key);
            setList((prev) => (prev ?? []).filter((s) => s.key !== key));
          } catch {
            showToast(t("ag_error"));
          }
        },
      },
    ]);
  }

  async function notNow(key: string) {
    haptics.select();
    setSnoozed(activeSnoozes(await snooze(key)));
  }

  return (
    <View style={shadows.soft} className="mx-5 mb-3 mt-3 rounded-xl2 bg-surface p-4">
      <View className="mb-1 flex-row items-center">
        <Icon name="family" size={15} color={theme.olive} />
        <Text className="ml-2 flex-1 font-bodySemibold text-sm text-ink">{growth ? t("ag_growing_title") : t("ag_title")}</Text>
      </View>
      <Text className="mb-3 font-body text-[11.5px] leading-4 text-ink-faint">{t("ag_privacy")}</Text>

      {joins.map((s) => (
        <View key={s.key} className="mb-2 flex-row items-center" style={{ gap: 8 }}>
          <Text className="flex-1 font-bodyMedium text-[14px] text-ink" numberOfLines={2}>
            {growth?.join === s.key ? t("ag_growing_join", { name: autoGroupLabel(s.key, t) }) : autoGroupLabel(s.key, t)}
          </Text>
          <Pressable
            onPress={() => void notNow(s.key)}
            accessibilityRole="button"
            accessibilityLabel={t("ag_not_now")}
            className="items-center justify-center px-2"
            style={{ minHeight: 48 }}
          >
            <Text className="font-bodyMedium text-xs text-ink-faint">{t("ag_not_now")}</Text>
          </Pressable>
          <Pressable
            onPress={() => void join(s.key)}
            disabled={busy !== null}
            accessibilityRole="button"
            accessibilityLabel={`${t("cexplore_join")}: ${autoGroupLabel(s.key, t)}`}
            className="items-center justify-center rounded-full bg-olive px-4"
            style={{ minHeight: 48, minWidth: 104 }}
          >
            {busy === s.key ? <ActivityIndicator color={theme.onAccent} /> : <Text className="font-bodySemibold text-[13px] text-on-accent">{t("cexplore_join")}</Text>}
          </Pressable>
        </View>
      ))}

      {growth ? (
        <Pressable onPress={() => leave(growth.leave)} accessibilityRole="button" className="justify-center" style={{ minHeight: 44 }}>
          <Text className="font-bodyMedium text-xs text-ink-soft">{t("ag_leave_old", { name: autoGroupLabel(growth.leave, t) })}</Text>
        </Pressable>
      ) : null}
      {leaves.map((s) => (
        <Pressable key={s.key} onPress={() => leave(s.key)} accessibilityRole="button" className="justify-center" style={{ minHeight: 44 }}>
          <Text className="font-bodyMedium text-xs text-ink-soft">{t("ag_leave_old", { name: autoGroupLabel(s.key, t) })}</Text>
        </Pressable>
      ))}
    </View>
  );
}
