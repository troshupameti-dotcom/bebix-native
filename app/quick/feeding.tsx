import { useEffect, useMemo, useState } from "react";
import { View } from "react-native";
import { Redirect } from "expo-router";
import { Apple, Droplet, Milk, SlidersHorizontal, type LucideIcon } from "lucide-react-native";
import { QuickChooser, type QuickOption } from "@/components/widgets/QuickChooser";
import { useAppState, active } from "@/lib/state/AppStateContext";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { useToast } from "@/lib/toast/ToastContext";
import { useTones } from "@/lib/theme/tone";
import { haptics } from "@/lib/haptics";
import { trackRecordLogged } from "@/lib/analytics/babyEvents";
import { loadTimer, saveTimer, startTimer, switchSide, type BreastTimer } from "@/lib/baby/breastTimer";
import type { FeedingEntry } from "@/lib/state/types";

const FEEDING = "/(main)/baby/feeding";

/**
 * bebix://quick/feeding — zgjedhja e shpejtë e ushqimit (butoni "Ushqim" i widget-it dhe prekja e gjatë e ikonës).
 * Gjiri nis kohëmatësin (ose kalon në anën tjetër kur ai po ecën); biberoni, formula dhe ushqimi i ngurtë
 * shënohen menjëherë, me sasinë e fundit të biberonit. Pas zgjedhjes hapet Ushqyerja.
 */
export default function QuickFeeding() {
  const { t } = useTranslation();
  const { state, baby } = useAppState();
  const { showToast } = useToast();
  const tones = useTones();
  const [timer, setTimer] = useState<BreastTimer | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let alive = true;
    void loadTimer().then((v) => alive && setTimer(v));
    return () => {
      alive = false;
    };
  }, []);

  const lastMl = useMemo(() => {
    const log = active(state.baby.feedingLog).sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
    const last = log.find((e) => e.amountMl != null && (e.type === "bottle" || e.type === "formula"));
    return last?.amountMl ?? null;
  }, [state.baby.feedingLog]);

  if (done) return <Redirect href={FEEDING} withAnchor />;

  function breast(side: "left" | "right") {
    haptics.success();
    const next = timer ? switchSide(timer, side) : startTimer(side);
    // Kohëmatësi ruhet para se të hapet Ushqyerja, që ekrani ta gjejë në ecje.
    void saveTimer(next).finally(() => setDone(true));
  }

  function logNow(entry: Partial<FeedingEntry>, what: string) {
    baby.addFeedingEntry(entry);
    trackRecordLogged({ kind: "feeding", source: "quick_button" });
    haptics.success();
    showToast(t("quick_saved_what", { what }));
    setDone(true);
  }

  const ml = lastMl ? `${lastMl} ml` : null;
  const breastHint = timer ? t("quick_breast_switch") : t("quick_breast_hint");
  const option = (key: string, label: string, hint: string, icon: LucideIcon, tone: QuickOption["tone"], onPress: () => void): QuickOption => ({
    key, label, hint, icon, tone, onPress,
  });

  const options: QuickOption[] = [
    option("breast_left", t("quick_breast_left"), breastHint, Droplet, tones.pink, () => breast("left")),
    option("breast_right", t("quick_breast_right"), breastHint, Droplet, tones.pink, () => breast("right")),
    option("bottle", t("feeding_type_bottle"), ml ?? t("quick_now_hint"), Milk, tones.blue, () =>
      logNow({ type: "bottle", amountMl: lastMl }, [t("feeding_type_bottle"), ml].filter(Boolean).join(" · "))
    ),
    option("formula", t("feeding_type_formula"), ml ?? t("quick_now_hint"), Milk, tones.purple, () =>
      logNow({ type: "formula", amountMl: lastMl }, [t("feeding_type_formula"), ml].filter(Boolean).join(" · "))
    ),
    option("solid", t("feeding_type_solid"), t("quick_now_hint"), Apple, tones.green, () =>
      logNow({ type: "solid" }, t("feeding_type_solid"))
    ),
    option("details", t("quick_details"), t("quick_details_hint"), SlidersHorizontal, tones.amber, () => {
      haptics.tap();
      setDone(true);
    }),
  ];

  return (
    <View className="flex-1 bg-cream">
      <QuickChooser title={t("quick_feed_title")} options={options} />
    </View>
  );
}
