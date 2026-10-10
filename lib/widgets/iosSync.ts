import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { buildIosWidgetProps, desiredLiveActivity, sameActivity, type LiveActivityProps } from "@/lib/widgets/iosProps";
import type { WidgetSnapshot } from "@/lib/widgets/snapshot";

const ACTIVITY_KEY = "bebix_live_activity_v1";

type Stored = { id: string; props: LiveActivityProps } | null;

/**
 * iPhone: widget-i merr pamjen e re dhe Live Activity ndjek gjumin/gjirin
 * (niset kur nis, mbyllet kur mbaron). Modulet e widget-it ngarkohen vetëm
 * në iOS — në Android s'ekzistojnë.
 */
export async function syncIosWidgets(snapshot: WidgetSnapshot): Promise<void> {
  if (Platform.OS !== "ios") return;
  try {
    /* eslint-disable @typescript-eslint/no-require-imports */
    const Quick = (require("@/widgets/iphone/BebixQuickWidget") as typeof import("@/widgets/iphone/BebixQuickWidget")).default;
    const Timer = (require("@/widgets/iphone/BebixTimerActivity") as typeof import("@/widgets/iphone/BebixTimerActivity")).default;
    /* eslint-enable @typescript-eslint/no-require-imports */

    Quick.updateSnapshot(buildIosWidgetProps(snapshot));

    const want = desiredLiveActivity(snapshot);
    const raw = await AsyncStorage.getItem(ACTIVITY_KEY).catch(() => null);
    const stored: Stored = raw ? (JSON.parse(raw) as Stored) : null;
    const running = Timer.getInstances();
    const current = stored ? running.find((a) => a.getId() === stored.id) : undefined;

    if (want && current && sameActivity(stored?.props ?? null, want)) return;

    // Gjithçka tjetër: mbyll ato që janë, nis të renë (nëse duhet).
    await Promise.all(running.map((a) => a.end("immediate").catch(() => undefined)));
    if (!want) {
      await AsyncStorage.removeItem(ACTIVITY_KEY).catch(() => undefined);
      return;
    }
    const url = want.kind === "breast" ? "bebix://log/feeding" : "bebix://sleep";
    const started = Timer.start(want, url);
    await AsyncStorage.setItem(ACTIVITY_KEY, JSON.stringify({ id: started.getId(), props: want })).catch(() => undefined);
  } catch {
    // Pa expo-widgets në këtë build, ose Live Activities të fikura nga prindi: s'ka çfarë të bëhet.
  }
}
