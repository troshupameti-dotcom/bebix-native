import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MotiView } from "moti";
import { Footprints } from "lucide-react-native";
import { BackButton } from "@/components/ui/BackButton";
import { useTones } from "@/lib/theme/tone";
import { shadows } from "@/lib/shadows";
import { haptics } from "@/lib/haptics";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { clockTime, formatDate } from "@/lib/dateUtils";
import {
  KICK_GOAL, addKick, finishKicks, kickMinutes, kickWindowOver, loadKicks, reachedGoal, saveKicks, undoKick,
  type KickSession, type KickState,
} from "@/lib/parent/pregnancyTools";

/**
 * Numëruesi i lëvizjeve (nga java e 28-të): një prekje për çdo lëvizje, deri në 10. Seanca mbijeton mbylljen e
 * app-it (rri te telefoni). Pas 2 orësh pa 10 lëvizje, ekrani e thotë qartë: telefono sot.
 */
export default function KicksScreen() {
  const tones = useTones();
  const { t, lang } = useTranslation();
  const [state, setState] = useState<KickState | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [justDone, setJustDone] = useState<KickSession | null>(null);

  useEffect(() => {
    let alive = true;
    void loadKicks().then((s) => alive && setState(s));
    return () => {
      alive = false;
    };
  }, []);

  const current = state?.current ?? null;
  useEffect(() => {
    if (!current) return;
    const id = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(id);
  }, [current]);

  function update(next: KickState) {
    setState(next);
    void saveKicks(next);
  }

  function tap() {
    if (!state) return;
    const at = new Date();
    setNow(at);
    const next = addKick(state, at);
    if (!next.current && next.history[0] && reachedGoal(next.history[0])) {
      haptics.success();
      setJustDone(next.history[0]);
    } else {
      haptics.tap();
      setJustDone(null);
    }
    update(next);
  }

  function finish() {
    if (!state) return;
    haptics.select();
    const next = finishKicks(state);
    setJustDone(null);
    update(next);
  }

  const count = current?.kicks.length ?? 0;
  const over = current ? kickWindowOver(current, now) : false;
  const pct = Math.min(1, count / KICK_GOAL);

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      <View className="flex-row items-center gap-3 px-4 pb-3 pt-2">
        <BackButton fallback="/(main)/baby" />
        <Text accessibilityRole="header" className="font-display text-xl text-ink">
          {t("preg_kicks_title")}
        </Text>
      </View>

      <ScrollView className="flex-1 px-5" contentContainerStyle={{ paddingBottom: 32 }}>
        <Text className="font-body text-[14px] leading-5 text-ink-soft">{t("kicks_intro")}</Text>

        <View className="mt-6 items-center">
          <Pressable
            onPress={tap}
            disabled={!state}
            accessibilityRole="button"
            accessibilityLabel={`${t("kicks_tap")}. ${t("kicks_count", { n: count })}`}
            style={({ pressed }) => [
              shadows.soft,
              {
                width: 200,
                height: 200,
                borderRadius: 100,
                backgroundColor: tones.pink.tintBg,
                borderWidth: 6,
                borderColor: pct > 0 ? tones.pink.tint : tones.pink.chip,
                alignItems: "center",
                justifyContent: "center",
                transform: [{ scale: pressed ? 0.96 : 1 }],
              },
            ]}
          >
            <Footprints size={34} color={tones.pink.tint} strokeWidth={2} />
            <Text className="mt-2 font-display text-[30px]" style={{ color: tones.ink }}>
              {t("kicks_count", { n: count })}
            </Text>
            <Text className="mt-1 font-bodySemibold text-[14px]" style={{ color: tones.pink.tint }}>
              {t("kicks_tap")}
            </Text>
          </Pressable>

          {current ? (
            <Text className="mt-4 font-body text-[14px] text-ink-soft">{t("kicks_elapsed", { m: kickMinutes(current, now) })}</Text>
          ) : null}
          {current ? (
            <View className="mt-3 flex-row gap-3">
              <Pressable
                onPress={() => {
                  haptics.select();
                  update(undoKick(state!));
                }}
                accessibilityRole="button"
                className="rounded-full bg-surface px-4 py-2.5"
                style={shadows.soft}
              >
                <Text className="font-bodyMedium text-[14px] text-ink">{t("kicks_undo")}</Text>
              </Pressable>
              <Pressable onPress={finish} accessibilityRole="button" className="rounded-full bg-surface px-4 py-2.5" style={shadows.soft}>
                <Text className="font-bodyMedium text-[14px] text-ink">{t("kicks_stop")}</Text>
              </Pressable>
            </View>
          ) : null}
        </View>

        {justDone ? (
          <MotiView from={{ opacity: 0, translateY: 6 }} animate={{ opacity: 1, translateY: 0 }}>
            <View accessibilityLiveRegion="polite" className="mt-6 rounded-2xl p-4" style={{ backgroundColor: tones.green.tintBg }}>
              <Text className="font-bodySemibold text-[15px]" style={{ color: tones.green.tint }}>
                {t("kicks_done", { m: kickMinutes(justDone) })}
              </Text>
            </View>
          </MotiView>
        ) : null}

        {over ? (
          <View accessibilityRole="alert" className="mt-6 rounded-2xl p-4" style={{ backgroundColor: tones.orange.tintBg }}>
            <Text className="font-bodySemibold text-[15px] leading-5" style={{ color: tones.orange.tint }}>
              {t("kicks_window_over")}
            </Text>
          </View>
        ) : null}

        <Text className="mt-6 font-body text-[13px] leading-5 text-ink-soft">{t("kicks_warning")}</Text>

        <Text className="mt-6 font-bodySemibold text-[15px] text-ink">{t("kicks_history")}</Text>
        {state && state.history.length === 0 ? <Text className="mt-2 font-body text-[13.5px] text-ink-soft">{t("kicks_empty")}</Text> : null}
        {state?.history.slice(0, 10).map((s) => (
          <View key={s.startedAt} style={shadows.soft} className="mt-2 flex-row items-center justify-between rounded-2xl bg-surface px-4 py-3">
            <Text className="font-body text-[13.5px] text-ink-soft">
              {`${formatDate(s.startedAt, lang)}, ${clockTime(new Date(s.startedAt))}`}
            </Text>
            <Text className="font-bodySemibold text-[13.5px]" style={{ color: reachedGoal(s) ? tones.ink : tones.orange.tint }}>
              {reachedGoal(s) ? t("kicks_done", { m: kickMinutes(s) }) : t("kicks_partial", { n: s.kicks.length, m: kickMinutes(s) })}
            </Text>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
