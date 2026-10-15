import { useEffect, useRef, useState } from "react";
import { BackHandler, Text, View, useWindowDimensions, type AccessibilityActionEvent, type GestureResponderEvent } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { NIGHT_COLORS as C } from "@/components/baby/NightClock";
import { useKeepScreenOn } from "@/lib/baby/nightScreen";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { haptics } from "@/lib/haptics";

/** Drita fiket vetë pas kaq minutash, që të mos mbetet ndezur gjithë natën nëse prindi fle. */
export const LIGHT_MINUTES = 10;
const STEP = 0.1;

const clamp = (v: number) => Math.max(0, Math.min(1, v));

/** Ndriçimi i ekranit për një fuqi drite (0–1): edhe në minimum ndriçon pak, që të shihet pelena. */
export function lightBrightness(level: number): number {
  return 0.05 + 0.95 * clamp(level);
}

/** Tejdukshmëria e të kuqes: punon edhe kur telefoni s'lejon ndryshimin e ndriçimit. */
const glowOpacity = (level: number) => 0.3 + 0.7 * clamp(level);

/**
 * Drita e kuqe e natës: krejt ekrani ndriçon i kuq, për ndërrimin e pelenës pa dritën e bardhë të llambës së
 * telefonit (që e zgjon bebin). Rrëshqitja lart/poshtë e ndryshon fuqinë, një prekje kthen te pamja e natës.
 * Ekrani s'fiket vetë sa kohë drita është ndezur; pas LIGHT_MINUTES fiket ajo vetë.
 */
export function NightLight({ level, onLevel, onClose }: { level: number; onLevel: (v: number) => void; onClose: () => void }) {
  const { t } = useTranslation();
  const { height } = useWindowDimensions();
  useKeepScreenOn(true);

  // Prekja: ku nisi gishti dhe fuqia në atë çast. onClose lexohet nga ref-i te kohëmatësi.
  const touch = useRef({ x: 0, y: 0, level, moved: false });
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  // Android: butoni fizik "mbrapa" fik dritën, s'del nga app-i.
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      closeRef.current();
      return true;
    });
    return () => sub.remove();
  }, []);

  // Fiket vetë pas LIGHT_MINUTES, pa e shkruar në ekran.
  useEffect(() => {
    const off = setTimeout(() => closeRef.current(), LIGHT_MINUTES * 60_000);
    return () => clearTimeout(off);
  }, []);

  const onGrant = (e: GestureResponderEvent) => {
    touch.current = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY, level, moved: false };
  };
  const onMove = (e: GestureResponderEvent) => {
    const dx = e.nativeEvent.pageX - touch.current.x;
    const dy = e.nativeEvent.pageY - touch.current.y;
    if (Math.abs(dx) > 10 || Math.abs(dy) > 10) touch.current.moved = true;
    // Gjysma e lartësisë së ekranit = nga fikur në fuqinë e plotë.
    if (touch.current.moved) onLevel(clamp(touch.current.level - dy / (height * 0.5)));
  };
  const onRelease = () => {
    if (touch.current.moved) return;
    haptics.tap();
    onClose();
  };

  const onAction = (e: AccessibilityActionEvent) => {
    const name = e.nativeEvent.actionName;
    if (name === "increment") onLevel(clamp(level + STEP));
    else if (name === "decrement") onLevel(clamp(level - STEP));
    else if (name === "activate") onClose();
  };

  // Teksti mbi të kuqe: i errët, që të mos shtojë dritë të bardhë.
  const ink = "rgba(0,0,0,0.62)";

  return (
    <View
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderGrant={onGrant}
      onResponderMove={onMove}
      onResponderRelease={onRelease}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={t("night_light")}
      accessibilityHint={t("night_light_hint")}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(level * 100) }}
      accessibilityActions={[{ name: "increment" }, { name: "decrement" }, { name: "activate" }]}
      onAccessibilityAction={onAction}
      style={{ flex: 1, backgroundColor: C.bg }}
    >
      <View style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: C.glow, opacity: glowOpacity(level) }} />
      {/* Vetëm dy rreshta: lart = më shumë dritë, poshtë = më pak. Prekja kthen te pamja e natës. */}
      <SafeAreaView style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 28 }} edges={["top", "bottom"]}>
        <Text style={{ color: ink, fontSize: 20, fontFamily: "Inter_600SemiBold" }}>{`↑  ${t("night_swipe_up")}`}</Text>
        <Text style={{ color: ink, fontSize: 20, fontFamily: "Inter_600SemiBold" }}>{`↓  ${t("night_swipe_down")}`}</Text>
      </SafeAreaView>
    </View>
  );
}
