import { useState } from "react";
import { Droplet, Droplets, Layers, SlidersHorizontal } from "lucide-react-native";
import { DeepLinkAction } from "@/components/widgets/DeepLinkAction";
import { QuickChooser, type QuickOption } from "@/components/widgets/QuickChooser";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { useTones } from "@/lib/theme/tone";
import type { DiaperType } from "@/lib/state/babyTypes";

const DIAPER = "/(main)/baby/diaper";

/**
 * bebix://quick/diaper — zgjedhja e shpejtë e pelenës (prekja e gjatë e ikonës, rreshti "Pelena" i widget-it).
 * Zgjedhja shkon në të njëjtën radhë si butonat e widget-it (pa dyfishim, edhe pa internet), pastaj hapet Pelena.
 */
export default function QuickDiaper() {
  const { t } = useTranslation();
  const tones = useTones();
  const [picked, setPicked] = useState<DiaperType | "details" | null>(null);

  if (picked) return <DeepLinkAction action={picked === "details" ? null : { kind: "diaper", type: picked }} to={DIAPER} />;

  const options: QuickOption[] = [
    { key: "wet", label: t("diaper_type_wet"), hint: t("quick_now_hint"), icon: Droplet, tone: tones.blue, onPress: () => setPicked("wet") },
    { key: "dirty", label: t("diaper_type_dirty"), hint: t("quick_now_hint"), icon: Droplets, tone: tones.amber, onPress: () => setPicked("dirty") },
    { key: "both", label: t("diaper_type_both"), hint: t("quick_now_hint"), icon: Layers, tone: tones.purple, onPress: () => setPicked("both") },
    { key: "details", label: t("quick_details"), hint: t("quick_details_hint"), icon: SlidersHorizontal, tone: tones.green, onPress: () => setPicked("details") },
  ];

  return <QuickChooser title={t("quick_diaper_title")} options={options} />;
}
