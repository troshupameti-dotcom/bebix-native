import { useEffect, useState } from "react";
import { View, Text, Pressable, StatusBar } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAppState, active } from "@/lib/state/AppStateContext";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { haptics } from "@/lib/haptics";
import { formatTime } from "@/lib/dateUtils";
import { durationLabel } from "@/lib/baby/dayStats";
import { isNapAt } from "@/lib/baby/sleepKind";
import { setNightOverride } from "@/lib/baby/nightMode";
import {
  elapsedSeconds, finishTimer, formatElapsed, loadTimer, saveTimer, startTimer, suggestedSide, type BreastTimer,
} from "@/lib/baby/breastTimer";
import type { DiaperType } from "@/lib/state/babyTypes";

// Ngjyra të ngrohta e të errëta: s'zgjojnë sytë (as bebin) në 3 të natës.
const C = {
  bg: "#0B0605",
  text: "#FFB199",
  soft: "#B9715F",
  faint: "#7A4A3E",
  button: "#2A0F0B",
  buttonOn: "#5A1E14",
  line: "#3A1610",
};

/** Butonat: 84dp të lartë, që të preken pa syze dhe me një dorë. */
function Big({ label, onPress, on = false }: { label: string; onPress: () => void; on?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        backgroundColor: pressed || on ? C.buttonOn : C.button,
        borderColor: C.line,
        borderWidth: 1,
        minHeight: 84,
        borderRadius: 26,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 12,
      })}
    >
      <Text style={{ color: C.text, fontSize: 21, fontFamily: "Inter_600SemiBold", textAlign: "center" }} numberOfLines={2}>
        {label}
      </Text>
    </Pressable>
  );
}

type Saved = { kind: "feeding" | "diaper" | "sleep"; id: string | null; text: string };

/**
 * Pamja e natës: ora, gjendja e bebit dhe katër butona të mëdhenj poshtë,
 * ku arrin gishti i madh. Pa animacione; çdo prekje dridhet dhe shkruan
 * "U ruajt" me mundësi anulimi.
 */
export function NightMode() {
  const { t, lang } = useTranslation();
  const { state, baby } = useAppState();
  const b = state.baby;
  const [now, setNow] = useState(() => new Date());
  const [timer, setTimer] = useState<BreastTimer | null>(null);
  const [saved, setSaved] = useState<Saved | null>(null);

  useEffect(() => {
    let alive = true;
    void loadTimer().then((v) => alive && setTimer(v));
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  useEffect(() => {
    if (!saved) return;
    const id = setTimeout(() => setSaved(null), 5000);
    return () => clearTimeout(id);
  }, [saved]);

  const feedings = active(b.feedingLog);
  const sleeps = active(b.sleepLog);
  const lastFeeding = feedings.find((f) => f.type !== "medicine" && f.type !== "water") ?? null;
  const ongoing = sleeps.find((s) => !s.endAt) ?? null;
  const lastWake = sleeps.find((s) => s.endAt)?.endAt ?? null;
  const lastBreastSide = feedings.find((f) => f.type === "breast")?.side ?? null;

  const minutesSince = (iso: string) => Math.max(0, Math.round((now.getTime() - new Date(iso).getTime()) / 60000));
  const status = ongoing
    ? t("now_asleep_for", { t: durationLabel(minutesSince(ongoing.startAt), t) })
    : lastWake
      ? t("now_awake_for", { t: durationLabel(minutesSince(lastWake), t) })
      : t("now_no_sleep");

  // Butoni i ushqimit ndjek llojin e fundit: gjiri me timer, biberoni me sasinë e fundit.
  const lastType = lastFeeding?.type;
  const feedLabel = timer
    ? t("night_breast_stop", { t: formatElapsed(elapsedSeconds(timer, now)) })
    : lastType === "breast"
      ? t("night_breast_start", { side: t(suggestedSide(lastBreastSide) === "left" ? "feeding_side_left" : "feeding_side_right") })
      : (lastType === "bottle" || lastType === "formula") && lastFeeding?.amountMl
        ? t("night_bottle", { ml: lastFeeding.amountMl })
        : t("night_fed");

  function feed() {
    haptics.success();
    if (timer) {
      const done = finishTimer(timer);
      setTimer(null);
      void saveTimer(null);
      const id = baby.addFeedingEntry({ type: "breast", side: done.side, at: done.at, durationMin: done.durationMin });
      setSaved({ kind: "feeding", id, text: t("quick_saved_what", { what: t("feeding_type_breast") }) });
      return;
    }
    if (lastType === "breast") {
      const next = startTimer(suggestedSide(lastBreastSide));
      setTimer(next);
      void saveTimer(next);
      setSaved({ kind: "feeding", id: null, text: t("night_breast_started") });
      return;
    }
    const type = lastType === "formula" ? "formula" : lastType === "bottle" ? "bottle" : (lastType ?? "bottle");
    const id = baby.addFeedingEntry({ type, amountMl: type === "bottle" || type === "formula" ? (lastFeeding?.amountMl ?? null) : null });
    setSaved({ kind: "feeding", id, text: t("quick_saved_what", { what: feedLabel }) });
  }

  function diaper(type: DiaperType) {
    haptics.success();
    const id = baby.addDiaperEntry({ type });
    setSaved({ kind: "diaper", id, text: t("quick_saved_what", { what: t(`diaper_type_${type}` as never) }) });
  }

  function toggleSleep() {
    haptics.success();
    if (ongoing) {
      baby.endSleep(ongoing.id);
      setSaved({ kind: "sleep", id: null, text: t("night_woke_saved") });
    } else {
      baby.startSleep(isNapAt(new Date()));
      setSaved({ kind: "sleep", id: null, text: t("night_sleep_saved") });
    }
  }

  function undo() {
    if (!saved?.id) return;
    haptics.warning();
    if (saved.kind === "feeding") baby.deleteFeedingEntry(saved.id);
    if (saved.kind === "diaper") baby.deleteDiaperEntry(saved.id);
    setSaved(null);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={["top", "bottom"]}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingTop: 8 }}>
        <Text style={{ color: C.faint, fontSize: 13, fontFamily: "Inter_500Medium" }}>{t("night_title")}</Text>
        <Pressable onPress={() => setNightOverride("off")} hitSlop={12} accessibilityRole="button" style={{ minHeight: 44, justifyContent: "center" }}>
          <Text style={{ color: C.soft, fontSize: 14, fontFamily: "Inter_500Medium" }}>{t("night_exit")}</Text>
        </Pressable>
      </View>

      <View style={{ flex: 1, justifyContent: "center", paddingHorizontal: 24 }}>
        <Text style={{ color: C.text, fontSize: 64, fontFamily: "Inter_600SemiBold", letterSpacing: -1 }}>
          {formatTime(now.toISOString(), lang)}
        </Text>
        <Text style={{ color: C.soft, fontSize: 18, fontFamily: "Inter_500Medium", marginTop: 6 }}>{status}</Text>
        {lastFeeding ? (
          <Text style={{ color: C.faint, fontSize: 15, fontFamily: "Inter_400Regular", marginTop: 4 }}>
            {t("night_last_feeding", { time: formatTime(lastFeeding.at, lang) })}
          </Text>
        ) : null}
        {saved ? (
          <View style={{ flexDirection: "row", alignItems: "center", marginTop: 18 }}>
            <Text style={{ color: C.text, fontSize: 16, fontFamily: "Inter_600SemiBold" }}>✓ {saved.text}</Text>
            {saved.id ? (
              <Pressable onPress={undo} hitSlop={12} accessibilityRole="button" style={{ marginLeft: 14, minHeight: 44, justifyContent: "center" }}>
                <Text style={{ color: C.soft, fontSize: 15, fontFamily: "Inter_600SemiBold", textDecorationLine: "underline" }}>{t("night_undo")}</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </View>

      {/* Poshtë, ku arrin gishti i madh me një dorë. */}
      <View style={{ paddingHorizontal: 16, paddingBottom: 12, gap: 10 }}>
        <Big label={feedLabel} onPress={feed} on={!!timer} />
        <View style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Big label={t("diaper_type_wet")} onPress={() => diaper("wet")} />
          </View>
          <View style={{ flex: 1 }}>
            <Big label={t("diaper_type_dirty")} onPress={() => diaper("dirty")} />
          </View>
        </View>
        <Big label={ongoing ? t("night_woke") : t("night_sleep")} onPress={toggleSleep} on={!!ongoing} />
      </View>
    </SafeAreaView>
  );
}
