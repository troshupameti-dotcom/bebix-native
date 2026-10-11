import { useCallback, useEffect, useRef, useState } from "react";
import { AppState as RNAppState, DeviceEventEmitter, Platform } from "react-native";
import { useAppState } from "@/lib/state/AppStateContext";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { BREAST_TIMER_EVENT, loadTimer } from "@/lib/baby/breastTimer";
import { isNapAt } from "@/lib/baby/sleepKind";
import { queueSource, trackRecordLogged } from "@/lib/analytics/babyEvents";
import { applyPending, planDrain, type WidgetAction } from "@/lib/widgets/queue";
import { buildSnapshot, sameSnapshot } from "@/lib/widgets/snapshot";
import { drainQueue, loadSnapshot, QUEUE_EVENT, saveSnapshot } from "@/lib/widgets/store";
import { syncIosWidgets } from "@/lib/widgets/iosSync";
import type { WidgetSnapshot } from "@/lib/widgets/snapshot";

/** Rivizatimi i widget-eve: Android (react-native-android-widget) dhe iPhone (expo-widgets + Live Activity). */
async function reloadWidgets(snapshot: WidgetSnapshot | null) {
  if (Platform.OS === "ios") {
    if (snapshot) await syncIosWidgets(snapshot);
    return;
  }
  if (Platform.OS !== "android") return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { refreshAndroidWidgets } = require("@/widgets/android-home/taskHandler") as typeof import("@/widgets/android-home/taskHandler");
    await refreshAndroidWidgets();
  } catch {
    // Build pa modulin e widget-it (p.sh. Expo Go): s'ka çfarë të rifreskohet.
  }
}

/**
 * Lidhja app ↔ widget, pa UI:
 *  - zbraz radhën e prekjeve (në hapje, në kthim në plan të parë, dhe sapo widget-i shton diçka);
 *  - shkruan pamjen e re sa herë ndryshon ushqimi, pelena, gjumi, timeri i gjirit ose gjuha.
 */
export function WidgetBridge() {
  const { state, baby, hydrated } = useAppState();
  const { lang } = useTranslation();
  const [timerVersion, setTimerVersion] = useState(0);

  // Zbrazja lexon gjendjen më të fundit pa u rikrijuar në çdo render.
  const latest = useRef({ state, baby });
  useEffect(() => {
    latest.current = { state, baby };
  }, [state, baby]);

  const drain = useCallback(() => {
    let applied: WidgetAction[] = [];
    void drainQueue((queue) => {
      const { state: cur, baby: actions } = latest.current;
      applied = planDrain(queue, { diaperLog: cur.baby.diaperLog, sleepLog: cur.baby.sleepLog });
      for (const a of applied) {
        if (a.kind === "diaper") actions.addDiaperEntry({ id: a.id, type: a.type, at: a.at });
        else if (a.kind === "sleep_start") actions.startSleep(isNapAt(a.at), { id: a.id, at: a.at });
        else actions.endSleep(a.sleepId, a.at);
        // Shënimi hyn tani në ditar: ora e prekjes dhe sa vonë hyri.
        if (a.kind !== "sleep_end") trackRecordLogged({ kind: a.kind === "diaper" ? "diaper" : "sleep", source: queueSource(a.source), at: a.at, queuedAt: a.at });
      }
    }).then(async (count) => {
      if (!count) return;
      // Pamja e ruajtur përfshin menjëherë atë që u zbatua: widget-i s'kthehet
      // për një çast te gjendja e vjetër (radha tani është bosh).
      const updated = applyPending(await loadSnapshot(), applied);
      if (updated) await saveSnapshot(updated);
      await reloadWidgets(updated);
    });
  }, []);

  // Para ngarkimit, shënimet do të humbnin nën historikun që po lexohet.
  useEffect(() => {
    if (!hydrated) return;
    drain();
    const appSub = RNAppState.addEventListener("change", (next) => {
      if (next === "active") drain();
    });
    const queueSub = DeviceEventEmitter.addListener(QUEUE_EVENT, drain);
    const timerSub = DeviceEventEmitter.addListener(BREAST_TIMER_EVENT, () => setTimerVersion((v) => v + 1));
    return () => {
      appSub.remove();
      queueSub.remove();
      timerSub.remove();
    };
  }, [hydrated, drain]);

  const { feedingLog, diaperLog, sleepLog } = state.baby;
  const babyName = state.profile.babyName;
  useEffect(() => {
    if (!hydrated) return;
    let alive = true;
    const id = setTimeout(async () => {
      const breastTimer = await loadTimer();
      const next = buildSnapshot({ lang, babyName, feedingLog, diaperLog, sleepLog, breastTimer, now: new Date() });
      if (!alive || sameSnapshot(await loadSnapshot(), next)) return;
      await saveSnapshot(next);
      await reloadWidgets(next);
    }, 300);
    return () => {
      alive = false;
      clearTimeout(id);
    };
  }, [hydrated, lang, babyName, feedingLog, diaperLog, sleepLog, timerVersion]);

  return null;
}
