import { useEffect, useMemo, useState } from "react";
import { View, Text, Pressable, StatusBar, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAppState, active } from "@/lib/state/AppStateContext";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { haptics } from "@/lib/haptics";
import { formatTime } from "@/lib/dateUtils";
import { durationLabel } from "@/lib/baby/dayStats";
import { isNapAt } from "@/lib/baby/sleepKind";
import { setNightLightLevel, setNightOverride, useNightMode } from "@/lib/baby/nightMode";
import { nightSummary } from "@/lib/baby/nightSummary";
import { predictNextFeeding, predictNextWake } from "@/lib/baby/predictions";
import { useScreenBrightness } from "@/lib/baby/nightScreen";
import { trackRecordLogged, trackRecordUndone } from "@/lib/analytics/babyEvents";
import {
  elapsedSeconds, finishTimer, formatElapsed, loadTimer, saveTimer, startTimer, suggestedSide, switchSide, type BreastTimer,
} from "@/lib/baby/breastTimer";
import type { DiaperType } from "@/lib/state/babyTypes";
import { Icon, type IconName } from "@/components/ui/Icon";
import { AnalogNightClock, NIGHT_COLORS as C } from "@/components/baby/NightClock";
import { NightTimeline } from "@/components/baby/NightTimeline";
import { NightLight, lightBrightness } from "@/components/baby/NightLight";

/** Butoni i natës: i lartë, që preket pa syze dhe me një dorë. */
function NightButton({ label, onPress, on = false, tall = false, grow = 1 }: { label: string; onPress: () => void; on?: boolean; tall?: boolean; grow?: number }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        flex: grow,
        backgroundColor: pressed || on ? C.buttonOn : C.button,
        borderColor: on ? C.soft : C.line,
        borderWidth: 1,
        minHeight: tall ? 76 : 68,
        borderRadius: 20,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 10,
      })}
    >
      <Text style={{ color: C.text, fontSize: tall ? 20 : 17, fontFamily: "Inter_600SemiBold", textAlign: "center" }} numberOfLines={2}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Rubrika: titull i vogël me ikonë, kufi i hollë dhe butonat brenda. */
function Section({ icon, title, detail, children }: { icon: IconName; title: string; detail?: string | null; children: React.ReactNode }) {
  return (
    <View style={{ backgroundColor: C.panel, borderColor: C.line, borderWidth: 1, borderRadius: 26, padding: 12, gap: 10 }}>
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 4 }}>
        <Icon name={icon} size={14} color={C.soft} />
        <Text style={{ color: C.soft, fontSize: 12, fontFamily: "Inter_600SemiBold", letterSpacing: 1.2, marginLeft: 8, flex: 1 }}>
          {title.toUpperCase()}
        </Text>
        {detail ? <Text style={{ color: C.soft, fontSize: 12, fontFamily: "Inter_500Medium" }}>{detail}</Text> : null}
      </View>
      <View style={{ flexDirection: "row", gap: 10 }}>{children}</View>
    </View>
  );
}

/** Butoni i vogël i shiritit lart (Drita, Mbyll): zonë prekjeje 44pt. */
function TopAction({ label, icon, onPress }: { label: string; icon?: IconName; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({ minHeight: 44, flexDirection: "row", alignItems: "center", paddingHorizontal: 10, opacity: pressed ? 0.6 : 1 })}
    >
      {icon ? <Icon name={icon} size={15} color={C.soft} /> : null}
      <Text style={{ color: C.soft, fontSize: 14, fontFamily: "Inter_500Medium", marginLeft: icon ? 6 : 0 }}>{label}</Text>
    </Pressable>
  );
}

type Saved = { kind: "feeding" | "diaper" | "sleep"; id: string | null; text: string };

/**
 * Pamja e natës, për orën 3 të natës: e kuqe mbi të zezë, ekrani i errësuar vetë, ora, gjendja e bebit dhe çka
 * pritet (ushqimi i radhës, zgjimi), "Nata deri tani" me një shikim, dhe tri rubrika poshtë ku arrin gishti i
 * madh: Ushqimi, Pelena, Gjumi. "Drita" e kthen krejt ekranin në dritë të kuqe për ndërrimin e pelenës.
 * Pa animacione dhe pa emoji; çdo prekje dridhet dhe shkruan "U ruajt" me mundësi anulimi.
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

  // Përmbledhja dhe parashikimet rillogariten një herë në minutë, jo çdo sekondë me orën.
  const minute = Math.floor(now.getTime() / 60_000);
  const { fromHour, toHour } = night.prefs;
  const summary = useMemo(
    () => nightSummary(b, new Date(minute * 60_000), { fromHour, toHour }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [b.feedingLog, b.sleepLog, b.diaperLog, minute, fromHour, toHour]
  );
  const nextFeeding = useMemo(
    () => predictNextFeeding(b.feedingLog, new Date(minute * 60_000)),
    [b.feedingLog, minute]
  );
  const sleeping = !!ongoing;
  const nextWake = useMemo(
    () => (sleeping ? predictNextWake(b.sleepLog, new Date(minute * 60_000)) : null),
    [b.sleepLog, sleeping, minute]
  );

  const minutesSince = (iso: string) => Math.max(0, Math.round((now.getTime() - new Date(iso).getTime()) / 60000));
  const status = ongoing
    ? t("now_asleep_for", { t: durationLabel(minutesSince(ongoing.startAt), t) })
    : lastWake
      ? t("now_awake_for", { t: durationLabel(minutesSince(lastWake), t) })
      : t("now_no_sleep");

  // Çka pritet: zgjimi kur fle, përndryshe ushqimi i radhës (vetëm kur ritmi i bebit e mbështet).
  const expected = ongoing && nextWake
    ? t("night_next_wake", { time: formatTime(nextWake.at, lang) })
    : nextFeeding
      ? nextFeeding.due
        ? t("night_feeding_due")
        : t("night_next_feeding", { time: formatTime(nextFeeding.at, lang) })
      : null;
  const facts = [lastFeeding ? t("night_last_feeding", { time: formatTime(lastFeeding.at, lang) }) : null, expected].filter(Boolean).join(" · ");

  const sideLabel = (side: "left" | "right") => t(side === "left" ? "feeding_side_left" : "feeding_side_right");
  const otherSide = (side: "left" | "right") => (side === "left" ? "right" : "left");

  // Butoni i ushqimit ndjek llojin e fundit: gjiri me timer, biberoni me sasinë e fundit.
  const lastType = lastFeeding?.type;
  const feedLabel = timer
    ? t("night_breast_stop", { t: formatElapsed(elapsedSeconds(timer, now)) })
    : lastType === "breast"
      ? t("night_breast_start", { side: sideLabel(suggestedSide(lastBreastSide)) })
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
      trackRecordLogged({ kind: "feeding", source: "quick_button", at: done.at });
      setSaved({ kind: "feeding", id, text: t("night_saved", { what: t("feeding_type_breast") }) });
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
    setSaved({ kind: "feeding", id, text: t("night_saved", { what: feedLabel }) });
  }

  // Gjiri tjetër pa e ndalur timerin: shënimi i fundit del "të dy gjinjtë".
  function changeSide() {
    if (!timer) return;
    haptics.tap();
    const next = switchSide(timer, otherSide(timer.side));
    setTimer(next);
    void saveTimer(next);
    setSaved({ kind: "feeding", id: null, text: t("night_side_now", { side: sideLabel(next.side) }) });
  }

  const diaperLabel: Record<DiaperType, string> = { wet: t("night_wet"), dirty: t("night_dirty"), both: t("night_both") };

  function diaper(type: DiaperType) {
    haptics.success();
    const id = baby.addDiaperEntry({ type });
    trackRecordLogged({ kind: "diaper", source: "quick_button" });
    setSaved({ kind: "diaper", id, text: t("night_saved", { what: diaperLabel[type] }) });
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

  const summaryText = t("night_summary", {
    f: summary.feedings.length,
    d: summary.diapers.length,
    s: summary.sleptMin > 0 ? durationLabel(summary.sleptMin, t) : t("dur_min", { n: 0 }),
  });

  if (light) {
    return (
      <>
        <StatusBar hidden />
        <NightLight level={lightLevel} onLevel={setLightLevel} onClose={closeLight} />
      </>
    );
  }

  const analog = night.prefs.clock === "analog";
  const align = analog ? "center" : "left";

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={["top", "bottom"]}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />
      <View style={{ flexDirection: "row", alignItems: "center", paddingLeft: 20, paddingRight: 10, paddingTop: 4 }}>
        <Text style={{ color: C.faint, fontSize: 13, fontFamily: "Inter_500Medium", flex: 1 }}>{t("night_title")}</Text>
        <TopAction
          label={t("night_light")}
          icon="flash"
          onPress={() => {
            haptics.tap();
            setLight(true);
          }}
        />
        <TopAction label={t("night_exit")} onPress={() => setNightOverride("off")} />
      </View>

      <View style={{ flex: 1, justifyContent: "center", paddingHorizontal: 24, alignItems: analog ? "center" : "flex-start" }}>
        {analog ? (
          <AnalogNightClock now={now} size={compact ? 150 : 200} />
        ) : (
          <Text style={{ color: C.text, fontSize: compact ? 52 : 64, fontFamily: "Inter_600SemiBold", letterSpacing: -1 }}>{formatTime(now.toISOString(), lang)}</Text>
        )}
        <Text style={{ color: C.soft, fontSize: compact ? 16 : 18, fontFamily: "Inter_500Medium", marginTop: analog ? 12 : 4, textAlign: align }}>
          {status}
        </Text>
        {facts ? (
          <Text style={{ color: C.soft, opacity: 0.8, fontSize: 14, fontFamily: "Inter_400Regular", marginTop: 4, textAlign: align }}>{facts}</Text>
        ) : null}

        {/* Nata deri tani: me një shikim, pa hapur asgjë. */}
        <View style={{ alignSelf: "stretch", marginTop: compact ? 14 : 22 }}>
          <View style={{ flexDirection: "row", alignItems: "baseline", marginBottom: 6 }}>
            <Text style={{ color: C.faint, fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 1.2, flex: 1 }}>{t("night_so_far").toUpperCase()}</Text>
            <Text style={{ color: C.soft, fontSize: 12, fontFamily: "Inter_500Medium" }}>{summaryText}</Text>
          </View>
          <NightTimeline summary={summary} now={now} label={`${t("night_so_far")}: ${summaryText}`} />
        </View>

        <View style={{ minHeight: 48, marginTop: 6, justifyContent: "center", alignSelf: "stretch" }}>
          {saved ? (
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: analog ? "center" : "flex-start" }}>
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

      {/* Tri rubrika, poshtë, ku arrin gishti i madh me një dorë. */}
      <View style={{ paddingHorizontal: 14, paddingBottom: 12, gap: 10 }}>
        <Section icon="spoon" title={t("night_section_feeding")} detail={timer ? sideLabel(timer.side) : null}>
          <NightButton label={feedLabel} onPress={feed} on={!!timer} tall grow={timer ? 1.6 : 1} />
          {timer ? <NightButton label={t("night_switch_side", { side: sideLabel(otherSide(timer.side)) })} onPress={changeSide} tall /> : null}
        </Section>
        <Section icon="diaper" title={t("night_section_diaper")}>
          <NightButton label={diaperLabel.wet} onPress={() => diaper("wet")} />
          <NightButton label={diaperLabel.dirty} onPress={() => diaper("dirty")} />
          <NightButton label={diaperLabel.both} onPress={() => diaper("both")} />
        </Section>
        <Section icon="moon" title={t("night_section_sleep")} detail={ongoing ? status : null}>
          <NightButton label={ongoing ? t("night_woke") : t("night_sleep")} onPress={toggleSleep} on={!!ongoing} tall />
        </Section>
      </View>
    </SafeAreaView>
  );
}
