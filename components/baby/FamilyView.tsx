import { useEffect, useMemo, useState } from "react";
import { View, Text, ScrollView, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MotiView } from "moti";
import { Icon } from "@/components/ui/Icon";
import { TONES } from "@/components/baby/LogTiles";
import { MemoriesCard } from "@/components/baby/MemoriesCard";
import { TodayCard } from "@/components/baby/TodayCard";
import { shadows } from "@/lib/shadows";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { useMomentUri } from "@/lib/baby/useMomentUri";
import { latestGrowth } from "@/lib/baby/growthLatest";
import { fetchShareCare, resolveDataOwnerId } from "@/lib/baby/household";
import { formatDate } from "@/lib/dateUtils";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { resetBabyRecordsSyncState } from "@/lib/baby/babyRecordsSync";
import { retrySync } from "@/lib/baby/syncStatus";
import type { BabyModuleState, Moment } from "@/lib/state/babyTypes";
import type { BabyProfile } from "@/lib/state/types";

const SHARE_SEEN_KEY = "bebix_viewer_share_care_v1";

/**
 * Kur prindërit e ndezin ndarjen e kujdesit, shënimet e vjetra të ushqimit
 * kanë kaluar tashmë kursorin e sync-ut: tërhiqet historiku i plotë një herë.
 */
async function pullAgainIfShareTurnedOn(share: boolean) {
  const before = await AsyncStorage.getItem(SHARE_SEEN_KEY).catch(() => null);
  await AsyncStorage.setItem(SHARE_SEEN_KEY, share ? "1" : "0").catch(() => {});
  if (share && before !== "1") {
    await resetBabyRecordsSyncState();
    retrySync();
  }
}

const visible = <T extends { deletedAt: string | null; archivedAt: string | null }>(list: T[]) =>
  list.filter((e) => !e.deletedAt && !e.archivedAt);

function Photo({ moment }: { moment: Moment }) {
  const uri = useMomentUri(moment);
  return (
    <View className="overflow-hidden rounded-2xl bg-cream-soft" style={{ width: "31.5%", aspectRatio: 1 }}>
      {uri ? <Image source={{ uri }} style={{ width: "100%", height: "100%" }} /> : null}
    </View>
  );
}

/**
 * Pamja e gjyshërve (shikues): bebi, fotot, arritjet dhe rritja — pa butona
 * shënimi. Ushqimi/gjumi/pelenat dalin vetëm kur prindërit i kanë ndarë.
 */
export function FamilyView({ profile, baby, babyName, ageText }: { profile: BabyProfile; baby: BabyModuleState; babyName: string; ageText: string }) {
  const { t, lang } = useTranslation();
  const [shareCare, setShareCare] = useState(false);
  useEffect(() => {
    let alive = true;
    void resolveDataOwnerId()
      .then((owner) => (owner ? fetchShareCare(owner) : false))
      .then((v) => {
        if (alive) setShareCare(v);
        void pullAgainIfShareTurnedOn(v);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const photos = useMemo(
    () =>
      visible(baby.moments)
        .filter((m) => m.type === "photo" && (m.uri || m.storagePath))
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 9),
    [baby.moments]
  );
  const milestones = useMemo(
    () =>
      [
        ...visible(baby.moments).filter((m) => m.type === "milestone").map((m) => ({ id: m.id, title: m.title, date: m.date })),
        ...visible(baby.timeline).map((e) => ({ id: e.id, title: e.title, date: e.date })),
      ]
        .filter((m) => m.title.trim())
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 8),
    [baby.moments, baby.timeline]
  );
  const growth = latestGrowth(baby.growthHistory);

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      <ScrollView className="flex-1 px-5" contentContainerStyle={{ paddingBottom: 32 }}>
        <MotiView from={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ type: "timing", duration: 220 }} className="mt-2 items-center">
          {profile.babyPhoto ? (
            <Image source={{ uri: profile.babyPhoto }} style={{ width: "100%", aspectRatio: 1.3, borderRadius: 28 }} />
          ) : (
            <View style={{ width: "100%", aspectRatio: 1.3, borderRadius: 28 }} className="items-center justify-center bg-cream-soft">
              <Icon name="baby" size={44} color="#A79D8A" />
            </View>
          )}
          <Text className="mt-4 font-display text-[26px] text-ink">{babyName}</Text>
          {ageText ? <Text className="mt-0.5 font-body text-[14px] text-ink-soft">{ageText}</Text> : null}
          <View className="mt-3 rounded-full px-3 py-1.5" style={{ backgroundColor: TONES.green.tintBg }}>
            <Text className="font-bodyMedium text-[12px]" style={{ color: TONES.green.tint }}>
              {t("viewer_badge")}
            </Text>
          </View>
        </MotiView>

        {growth.weight || growth.height ? (
          <View style={shadows.soft} className="mt-5 flex-row rounded-xl3 bg-surface p-4">
            {growth.weight ? (
              <View className="flex-1">
                <Text className="font-body text-xs text-ink-soft">{t("viewer_weight")}</Text>
                <Text className="font-display text-[22px] text-ink">{growth.weight.value} kg</Text>
                <Text className="font-body text-[11px] text-ink-faint">{formatDate(growth.weight.date, lang)}</Text>
              </View>
            ) : null}
            {growth.height ? (
              <View className="flex-1">
                <Text className="font-body text-xs text-ink-soft">{t("viewer_height")}</Text>
                <Text className="font-display text-[22px] text-ink">{growth.height.value} cm</Text>
                <Text className="font-body text-[11px] text-ink-faint">{formatDate(growth.height.date, lang)}</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {shareCare ? (
          <TodayCard feedings={visible(baby.feedingLog)} sleeps={visible(baby.sleepLog)} diapers={visible(baby.diaperLog)} babyDob={profile.babyDob} />
        ) : null}

        <MemoriesCard baby={baby} profile={profile} babyName={babyName} viewer />

        <View style={shadows.soft} className="mt-5 rounded-xl3 bg-surface p-4">
          <Text className="mb-3 font-bodySemibold text-base text-ink">{t("viewer_photos")}</Text>
          {photos.length ? (
            <View className="flex-row flex-wrap" style={{ gap: 8 }}>
              {photos.map((m) => (
                <Photo key={m.id} moment={m} />
              ))}
            </View>
          ) : (
            <Text className="font-body text-sm text-ink-soft">{t("viewer_no_photos")}</Text>
          )}
        </View>

        <View style={shadows.soft} className="mt-5 rounded-xl3 bg-surface p-4">
          <Text className="mb-2 font-bodySemibold text-base text-ink">{t("viewer_milestones")} ⭐</Text>
          {milestones.length ? (
            milestones.map((m) => (
              <View key={m.id} className="flex-row items-center py-2">
                <Text className="flex-1 font-bodyMedium text-[14px] text-ink">{m.title}</Text>
                <Text className="font-body text-xs text-ink-faint">{formatDate(m.date, lang)}</Text>
              </View>
            ))
          ) : (
            <Text className="font-body text-sm text-ink-soft">{t("viewer_no_milestones")}</Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
