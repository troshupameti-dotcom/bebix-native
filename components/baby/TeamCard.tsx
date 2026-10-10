import { useCallback, useEffect, useState } from "react";
import { View, Text, Pressable, ActivityIndicator } from "react-native";
import { useFocusEffect } from "expo-router";
import { Icon } from "@/components/ui/Icon";
import { TONES } from "@/components/baby/LogTiles";
import { shadows } from "@/lib/shadows";
import { haptics } from "@/lib/haptics";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { useToast } from "@/lib/toast/ToastContext";
import { fetchDaySummary, fetchNightShift, fetchPeople, resolveDataOwnerId, sendThanks, setNightShift } from "@/lib/baby/household";
import { currentNightKey, memberDays, personLabel, shoutout, todayRange, type HouseholdPerson, type MemberDay } from "@/lib/baby/team";

const REFRESH_MS = 5 * 60_000;

type Data = { people: HouseholdPerson[]; days: MemberDay[]; ownerId: string; night: string; onDuty: string | null };

/**
 * "Ekipi sot": kush bëri çfarë (sipas shënimeve të secilit), një lavdërim
 * për më të zellshmin, "Faleminderit ❤️" për partnerin dhe kush zgjohet
 * sonte. Del vetëm kur familja ka të paktën dy prindër.
 */
export function TeamCard() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [data, setData] = useState<Data | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const people = await fetchPeople();
      const parents = people.filter((p) => p.role === "parent");
      if (parents.length < 2) {
        setData(null);
        return;
      }
      const range = todayRange();
      const night = currentNightKey();
      const ownerId = (await resolveDataOwnerId()) ?? parents.find((p) => p.isOwner)?.userId ?? "";
      const [rows, onDuty] = await Promise.all([fetchDaySummary(range.from, range.to), fetchNightShift(ownerId, night).catch(() => null)]);
      setData({ people: parents, days: memberDays(parents, rows), ownerId, night, onDuty });
    } catch {
      // Pa rrjet ose pa migrimin: karta thjesht s'shfaqet.
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );
  useEffect(() => {
    const id = setInterval(() => void load(), REFRESH_MS);
    return () => clearInterval(id);
  }, [load]);

  if (!data) return null;

  const label = (p: HouseholdPerson) => (p.isMe ? t("fam_you") : personLabel(p, t));
  const byId = new Map(data.people.map((p) => [p.userId, p]));
  const praise = shoutout(data.days);
  const praised = praise ? byId.get(praise.userId) : null;
  const praiseText =
    praise && praised
      ? praised.isMe
        ? t(praise.kind === "diapers" ? "team_shout_diapers_me" : "team_shout_feedings_me", { n: praise.n })
        : t(praise.kind === "diapers" ? "team_shout_diapers" : "team_shout_feedings", { name: label(praised), n: praise.n })
      : null;

  async function thank(p: HouseholdPerson) {
    haptics.success();
    setBusy(`thanks:${p.userId}`);
    try {
      const sent = await sendThanks(p.userId);
      showToast(sent ? t("team_thanks_sent", { name: label(p) }) : t("team_thanks_limit"));
    } catch {
      showToast(t("team_error"));
    } finally {
      setBusy(null);
    }
  }

  async function pickNight(userId: string) {
    if (!data) return;
    haptics.select();
    const next = data.onDuty === userId ? null : userId;
    setBusy("night");
    setData({ ...data, onDuty: next });
    try {
      await setNightShift(data.night, next);
    } catch {
      setData({ ...data });
      showToast(t("team_error"));
    } finally {
      setBusy(null);
    }
  }

  const onDuty = data.onDuty ? byId.get(data.onDuty) : null;

  return (
    <View style={shadows.soft} className="mt-5 rounded-xl3 bg-surface p-4">
      <View className="mb-2 flex-row items-center gap-2">
        <Icon name="family" size={15} color={TONES.green.tint} />
        <Text className="font-bodySemibold text-base text-ink">{t("team_title")}</Text>
      </View>

      {praiseText ? (
        <View className="mb-3 rounded-2xl px-3 py-2.5" style={{ backgroundColor: TONES.green.tintBg }}>
          <Text className="font-bodySemibold text-[14px]" style={{ color: "#17212B" }}>
            {praiseText}
          </Text>
        </View>
      ) : null}

      {data.days.map((d) => {
        const p = byId.get(d.userId)!;
        return (
          <View key={d.userId} className="flex-row items-center py-2" style={{ minHeight: 48 }}>
            <View className="flex-1">
              <Text className="font-bodySemibold text-[14px] text-ink">{label(p)}</Text>
              <Text className="font-body text-xs text-ink-soft">
                {t("team_counts", { f: d.feedings, d: d.diapers, s: d.sleeps })}
              </Text>
            </View>
            {!p.isMe ? (
              <Pressable
                onPress={() => void thank(p)}
                disabled={busy !== null}
                accessibilityRole="button"
                accessibilityLabel={t("team_thanks_label", { name: label(p) })}
                className="h-11 flex-row items-center rounded-full px-4"
                style={{ backgroundColor: TONES.pink.tintBg }}
              >
                {busy === `thanks:${p.userId}` ? (
                  <ActivityIndicator size="small" color={TONES.pink.tint} />
                ) : (
                  <Text className="font-bodySemibold text-[13px]" style={{ color: TONES.pink.tint }}>
                    {t("team_thanks")}
                  </Text>
                )}
              </Pressable>
            ) : null}
          </View>
        );
      })}

      <View className="my-2 h-px bg-ink/5" />
      <Text className="mb-2 font-bodyMedium text-[13px] text-ink">
        {onDuty ? t("team_night_on", { name: label(onDuty) }) : t("team_night_q")}
      </Text>
      <View className="flex-row flex-wrap" style={{ gap: 8 }}>
        {data.people.map((p) => {
          const active = data.onDuty === p.userId;
          return (
            <Pressable
              key={p.userId}
              onPress={() => void pickNight(p.userId)}
              disabled={busy === "night"}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              className="h-11 flex-row items-center gap-1.5 rounded-full px-4"
              style={{ backgroundColor: active ? TONES.purple.tint : TONES.purple.tintBg }}
            >
              <Icon name="moon" size={13} color={active ? "#FFFFFF" : TONES.purple.tint} />
              <Text className="font-bodySemibold text-[13px]" style={{ color: active ? "#FFFFFF" : TONES.purple.tint }}>
                {label(p)}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Text className="mt-2 font-body text-[11px] text-ink-faint">{t("team_night_hint")}</Text>
    </View>
  );
}
