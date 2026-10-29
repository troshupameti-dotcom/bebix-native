import { useEffect, useState } from "react";
import { View, Text, Pressable, StatusBar, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAppState, active } from "@/lib/state/AppStateContext";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { haptics } from "@/lib/haptics";
import { formatTime } from "@/lib/dateUtils";
import { durationLabel } from "@/lib/baby/dayStats";
import { isNapAt } from "@/lib/baby/sleepKind";
import { setNightLightLevel, setNightOverride, takeNightReturn, useNightMode } from "@/lib/baby/nightMode";
import { router } from "expo-router";
import { useScreenBrightness } from "@/lib/baby/nightScreen";
import { trackRecordLogged, trackRecordUndone } from "@/lib/analytics/babyEvents";
import {
  elapsedSeconds, finishTimer, formatElapsed, loadTimer, saveTimer, startTimer, suggestedSide, type BreastTimer,
} from "@/lib/baby/breastTimer";
import { Icon, type IconName } from "@/components/ui/Icon";
import { AnalogNightClock, NIGHT_COLORS as C } from "@/components/baby/NightClock";
import { NightLight, lightBrightness } from "@/components/baby/NightLight";
import { NightSky } from "@/components/baby/NightSky";

/** Një nga tre butonat e natës: i madh, katror, me ikonë dhe një fjalë. */
function NightButton({ icon, label, onPress, on = false }: { icon: IconName; label: string; onPress: () => void; on?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        flex: 1,
        aspectRatio: 1,
        maxHeight: 132,
        backgroundColor: pressed || on ? C.buttonOn : C.button,
        borderColor: on ? C.soft : C.line,
        borderWidth: 1,
        borderRadius: 28,
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
      })}
    >
      <Icon name={icon} size={30} color={C.text} />
      <Text style={{ color: C.text, fontSize: 17, fontFamily: "Inter_600SemiBold", textAlign: "center" }} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

type Saved = { kind: "feeding" | "diaper" | "sleep"; id: string | null; text: string };

/**
 * Pamja e natës, e thjeshtë: ora, sa kohë fle (ose është zgjuar) bebi, dhe tre butona poshtë ku arrin gishti i
 * madh: Ushqim, Pelenë, Gjumë. Lart vetëm ikona e dritës së kuqe dhe "Mbyll". E kuqe mbi qiellin e natës (blu e
 * mesnatës shumë e errët, Hëna dhe yjet: NightSky), ekrani i errësuar vetë; pa animacione dhe pa emoji. Çdo prekje
 * dridhet dhe shkruan "U ruajt" me mundësi anulimi.
 */
export function NightMode() {
  const { t, lang } = useTranslation();
  const { state, baby } = useAppState();
  const night = useNightMode();
  const b = state.baby;
  const { height } = useWindowDimensions();
  const compact = height < 720;
  const [now, setNow] = useState(() => new Date());
  const [timer, setTimer] = useState<BreastTimer | null>(null);
  const [saved, setSaved] = useState<Saved | null>(null);
  const [light, setLight] = useState(false);
  // Fuqia e dritës ndryshon me gisht shumë herë në sekondë: ruhet vetëm kur mbyllet drita.
  const [lightLevel, setLightLevel] = useState(night.prefs.lightLevel);

  useScreenBrightness(light ? lightBrightness(lightLevel) : night.prefs.dimLevel);

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

  // Ushqimi ndjek llojin e fundit: gjiri nis/ndal timerin, biberoni shënohet me sasinë e fundit.
  const lastType = lastFeeding?.type;
  const feedLabel = timer ? formatElapsed(elapsedSeconds(timer, now)) : t("night_btn_feed");

  function feed() {
    haptics.success();
    if (timer) {
      const done = finishTimer(timer);
      setTimer(null);
      void saveTimer(null);
      const id = baby.addFeedingEntry({ type: "breast", side: done.side, at: done.at, durationMin: done.durationMin });
      trackRecordLogged({ kind: "feeding", source: "quick_button", at: done.at });
      setSaved({ kind: "feeding", id, text: t("night_saved", { what: t("night_btn_feed") }) });
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
    trackRecordLogged({ kind: "feeding", source: "quick_button" });
    setSaved({ kind: "feeding", id, text: t("night_saved", { what: t("night_btn_feed") }) });
  }

  // Natën pelena më e shpeshtë është e lagur; nëse ishte tjetër, "Anulo" dhe shënohet nga ditari.
  function diaper() {
    haptics.success();
    const id = baby.addDiaperEntry({ type: "wet" });
    trackRecordLogged({ kind: "diaper", source: "quick_button" });
    setSaved({ kind: "diaper", id, text: t("night_saved", { what: t("night_btn_diaper") }) });
  }

  function toggleSleep() {
    haptics.success();
    if (ongoing) {
      baby.endSleep(ongoing.id);
      setSaved({ kind: "sleep", id: null, text: t("night_woke_saved") });
    } else {
      baby.startSleep(isNapAt(new Date()));
      trackRecordLogged({ kind: "sleep", source: "quick_button" });
      setSaved({ kind: "sleep", id: null, text: t("night_sleep_saved") });
    }
  }

  function undo() {
    if (!saved?.id) return;
    haptics.warning();
    if (saved.kind !== "sleep") trackRecordUndone(saved.kind, "delete");
    if (saved.kind === "feeding") baby.deleteFeedingEntry(saved.id);
    if (saved.kind === "diaper") baby.deleteDiaperEntry(saved.id);
    setSaved(null);
  }

  function closeLight() {
    setLight(false);
    setNightLightLevel(lightLevel);
  }

  if (light) {
    return (
      <>
        <StatusBar hidden />
        <NightLight level={lightLevel} onLevel={setLightLevel} onClose={closeLight} />
      </>
    );
  }

  const analog = night.prefs.clock === "analog";

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={["top", "bottom"]}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />
      {/* Qielli me Hënën dhe yjet: pas gjithçkaje, pa marrë prekje */}
      <NightSky />
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingTop: 4 }}>
        {/* Drita e kuqe: vetëm ikona (emri i saj u lexohet lexuesve të ekranit). */}
        <Pressable
          onPress={() => {
            haptics.tap();
            setLight(true);
          }}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t("night_light")}
          style={({ pressed }) => ({ width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", backgroundColor: pressed ? C.buttonOn : C.button })}
        >
          <Icon name="flash" size={20} color={C.text} />
        </Pressable>
        <Pressable
          onPress={() => {
            // U ndez nga Cilësimet: mbyllja të kthen atje.
            const back = takeNightReturn();
            setNightOverride("off");
            if (back) router.navigate(back as never);
          }}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t("night_exit")}
          style={({ pressed }) => ({ minHeight: 48, justifyContent: "center", paddingHorizontal: 12, opacity: pressed ? 0.6 : 1 })}
        >
          <Text style={{ color: C.soft, fontSize: 15, fontFamily: "Inter_500Medium" }}>{t("night_exit")}</Text>
        </Pressable>
      </View>

      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 }}>
        {analog ? (
          <AnalogNightClock now={now} size={compact ? 170 : 220} />
        ) : (
          <Text style={{ color: C.text, fontSize: compact ? 64 : 80, fontFamily: "Inter_600SemiBold", letterSpacing: -2 }}>
            {formatTime(now.toISOString(), lang)}
          </Text>
        )}
        <Text style={{ color: C.soft, fontSize: compact ? 18 : 20, fontFamily: "Inter_500Medium", marginTop: 12, textAlign: "center" }}>{status}</Text>

        <View style={{ minHeight: 48, marginTop: 14, justifyContent: "center" }}>
          {saved ? (
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Text style={{ color: C.text, fontSize: 16, fontFamily: "Inter_600SemiBold", flexShrink: 1 }}>{saved.text}</Text>
              {saved.id ? (
                <Pressable onPress={undo} hitSlop={12} accessibilityRole="button" style={{ marginLeft: 14, minHeight: 44, justifyContent: "center" }}>
                  <Text style={{ color: C.soft, fontSize: 15, fontFamily: "Inter_600SemiBold", textDecorationLine: "underline" }}>{t("night_undo")}</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </View>
      </View>

      {/* Tre butona, poshtë, ku arrin gishti i madh me një dorë. */}
      <View style={{ flexDirection: "row", gap: 12, paddingHorizontal: 16, paddingBottom: 16 }}>
        <NightButton icon="spoon" label={feedLabel} onPress={feed} on={!!timer} />
        <NightButton icon="diaper" label={t("night_btn_diaper")} onPress={diaper} />
        <NightButton icon="moon" label={ongoing ? t("night_btn_wake") : t("night_btn_sleep")} onPress={toggleSleep} on={!!ongoing} />
      </View>
    </SafeAreaView>
  );
}
