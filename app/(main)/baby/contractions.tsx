import { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import { Timer } from "lucide-react-native";
import { BackButton } from "@/components/ui/BackButton";
import { useTones } from "@/lib/theme/tone";
import { shadows } from "@/lib/shadows";
import { haptics } from "@/lib/haptics";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { clockTime } from "@/lib/dateUtils";
import {
  activeContraction, durationSec, formatSec, intervalSec, loadContractions, saveContractions, startContraction,
  stopContraction, summarizeContractions, type Contraction,
} from "@/lib/parent/pregnancyTools";

/**
 * Kronometri i kontraksioneve: një buton për fillimin dhe përfundimin. Ora e fundit përmblidhet (sa, sa zgjasin,
 * sa shpesh) dhe rregulli 5-1-1 thuhet me fjalë. Ekrani s'fiket ndërsa është i hapur.
 */
const KEEP_AWAKE_TAG = "contractions";

export default function ContractionsScreen() {
  const tones = useTones();
  const { t } = useTranslation();
  const [list, setList] = useState<Contraction[] | null>(null);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    let alive = true;
    void loadContractions().then((l) => alive && setList(l));
    // Si te leximi i përrallave: pa `useKeepAwake`, që në disa Android hedh gabim kur aktiviteti s'është gati.
    activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => {});
    return () => {
      alive = false;
      void Promise.resolve()
        .then(() => deactivateKeepAwake(KEEP_AWAKE_TAG))
        .catch(() => {});
    };
  }, []);

  const active = list ? activeContraction(list) : null;
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), active ? 1000 : 30_000);
    return () => clearInterval(id);
  }, [active]);

  function update(next: Contraction[]) {
    setList(next);
    void saveContractions(next);
  }

  function toggle() {
    if (!list) return;
    const at = new Date();
    setNow(at);
    if (active) {
      haptics.success();
      update(stopContraction(list, at));
    } else {
      haptics.tap();
      update(startContraction(list, at));
    }
  }

  function clear() {
    Alert.alert(t("contr_clear"), t("contr_clear_confirm"), [
      { text: t("cancel_action"), style: "cancel" },
      { text: t("delete_action"), style: "destructive", onPress: () => update([]) },
    ]);
  }

  const summary = list ? summarizeContractions(list, now) : null;
  const statusText =
    summary?.status === "511"
      ? t("contr_status_511")
      : summary?.status === "regular"
        ? t("contr_status_regular")
        : summary?.status === "early"
          ? t("contr_status_early")
          : null;
  const statusTone = summary?.status === "511" ? tones.orange : summary?.status === "regular" ? tones.amber : tones.blue;

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      <View className="flex-row items-center gap-3 px-4 pb-3 pt-2">
        <BackButton fallback="/(main)/baby" />
        <Text accessibilityRole="header" className="font-display text-xl text-ink">
          {t("preg_contr_title")}
        </Text>
      </View>

      <ScrollView className="flex-1 px-5" contentContainerStyle={{ paddingBottom: 32 }}>
        <Text className="font-body text-[14px] leading-5 text-ink-soft">{t("contr_intro")}</Text>

        <Pressable
          onPress={toggle}
          disabled={!list}
          accessibilityRole="button"
          accessibilityState={{ selected: !!active }}
          style={({ pressed }) => [
            shadows.soft,
            {
              backgroundColor: active ? tones.purple.tint : tones.purple.tintBg,
              minHeight: 112,
              marginTop: 20,
              borderRadius: 28,
              paddingHorizontal: 16,
              paddingVertical: 20,
              alignItems: "center",
              justifyContent: "center",
              transform: [{ scale: pressed ? 0.98 : 1 }],
            },
          ]}
        >
          <Timer size={28} color={active ? "#FFFFFF" : tones.purple.tint} strokeWidth={2} />
          <Text className="mt-2 font-bodySemibold text-[17px]" style={{ color: active ? "#FFFFFF" : tones.ink }}>
            {active ? t("contr_stop") : t("contr_start")}
          </Text>
          {active ? (
            <Text accessibilityLiveRegion="polite" className="mt-1 font-display text-[26px]" style={{ color: "#FFFFFF" }}>
              {t("contr_running", { t: formatSec(durationSec(active, now)) })}
            </Text>
          ) : null}
        </Pressable>

        {summary && summary.count > 0 ? (
          <View style={shadows.soft} className="mt-5 rounded-2xl bg-surface p-4">
            <Text className="font-bodySemibold text-[13px] text-ink-soft">{t("contr_last_hour")}</Text>
            <View className="mt-2 flex-row">
              <Stat label={t("contr_count")} value={String(summary.count)} />
              <Stat label={t("contr_avg_len")} value={summary.avgDurationSec != null ? formatSec(summary.avgDurationSec) : "–"} />
              <Stat label={t("contr_avg_gap")} value={summary.avgIntervalSec != null ? formatSec(summary.avgIntervalSec) : "–"} />
            </View>
            {statusText ? (
              <View className="mt-3 rounded-xl p-3" style={{ backgroundColor: statusTone.tintBg }}>
                <Text className="font-bodyMedium text-[14px] leading-5" style={{ color: statusTone.tint }}>
                  {statusText}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}

        <Text className="mt-5 font-body text-[13px] leading-5 text-ink-soft">{t("contr_urgent")}</Text>

        <View className="mt-6 flex-row items-center justify-between">
          <Text className="font-bodySemibold text-[15px] text-ink">{t("preg_contr_title")}</Text>
          {list && list.length > 0 ? (
            <Pressable onPress={clear} hitSlop={10} accessibilityRole="button">
              <Text className="font-bodyMedium text-[13.5px] text-ink-soft">{t("contr_clear")}</Text>
            </Pressable>
          ) : null}
        </View>
        {list && list.length === 0 ? <Text className="mt-2 font-body text-[13.5px] text-ink-soft">{t("contr_empty")}</Text> : null}
        {list?.slice(0, 30).map((c, i) => {
          const gap = intervalSec(list, i);
          return (
            <View key={c.startAt} style={shadows.soft} className="mt-2 flex-row items-center rounded-2xl bg-surface px-4 py-3">
              <Text className="w-14 font-bodySemibold text-[14px] text-ink">{clockTime(new Date(c.startAt))}</Text>
              <View className="flex-1">
                <Text className="font-body text-[13.5px] text-ink">
                  {c.endAt ? t("contr_len", { t: formatSec(durationSec(c)) }) : t("contr_running", { t: formatSec(durationSec(c, now)) })}
                </Text>
                {gap != null ? <Text className="font-body text-[12.5px] text-ink-soft">{t("contr_gap", { t: formatSec(gap) })}</Text> : null}
              </View>
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-1">
      <Text className="font-display text-[22px] text-ink">{value}</Text>
      <Text className="font-body text-[12px] text-ink-soft">{label}</Text>
    </View>
  );
}
