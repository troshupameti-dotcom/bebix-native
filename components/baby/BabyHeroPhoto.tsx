import { useState } from "react";
import { Animated, Image, Pressable, Text, View } from "react-native";
import { ImagePlus } from "lucide-react-native";
import { Icon } from "@/components/ui/Icon";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { useThemeColors } from "@/lib/theme/useThemeColors";
import { haptics } from "@/lib/haptics";
import { shadows } from "@/lib/shadows";

/** Sa gjatë mbahet e shtypur fotoja para se të hapen zgjedhjet (si "Haptic Touch" i iPhone-it, por pak më gjatë). */
export const HOLD_MS = 1000;

/**
 * Fotoja e madhe e bebit te faqja kryesore. Kur ka foto: mbaje të shtypur dhe fotoja zvogëlohet ngadalë si në 3D;
 * pas `HOLD_MS` dridhet lehtë dhe hapen zgjedhjet (galeria ose kamera). Pa foto: një prekje mjafton.
 * Me lexuesin e ekranit, prekja e dyfishtë i hap gjithmonë zgjedhjet.
 */
export function BabyHeroPhoto({ uri, onChange }: { uri: string | null | undefined; onChange: () => void }) {
  const { t } = useTranslation();
  const c = useThemeColors();
  const [scale] = useState(() => new Animated.Value(1));
  const [lift] = useState(() => new Animated.Value(0));
  const [shade] = useState(() => lift.interpolate({ inputRange: [0, 1], outputRange: [0, 0.12] }));

  // Pa dridhje këtu: prekja nis edhe kur prindi thjesht rrëshqet faqen. Dridhja vjen vetëm kur hapen zgjedhjet.
  const pressIn = () => {
    Animated.parallel([
      Animated.timing(scale, { toValue: 0.94, duration: HOLD_MS, useNativeDriver: true }),
      Animated.timing(lift, { toValue: 1, duration: HOLD_MS, useNativeDriver: true }),
    ]).start();
  };
  const release = () => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, friction: 4, tension: 120, useNativeDriver: true }),
      Animated.timing(lift, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start();
  };
  const open = () => {
    haptics.success();
    onChange();
  };

  if (!uri) {
    return (
      <Pressable
        onPress={open}
        accessibilityRole="button"
        accessibilityLabel={t("baby_photo_add_hint")}
        style={{ width: "100%", aspectRatio: 2.3, borderRadius: 28 }}
        className="items-center justify-center bg-cream-soft active:opacity-80"
      >
        <Icon name="baby" size={30} color={c.inkFaint} />
        <View className="mt-2.5 flex-row items-center rounded-full bg-surface px-3.5 py-2" style={{ gap: 6 }}>
          <ImagePlus size={16} color={c.ink} />
          <Text className="font-bodySemibold text-[13.5px] text-ink">{t("baby_photo_add_hint")}</Text>
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPressIn={pressIn}
      onPressOut={release}
      onLongPress={open}
      delayLongPress={HOLD_MS}
      accessibilityRole="button"
      accessibilityLabel={t("baby_photo_change_a11y")}
      accessibilityHint={t("baby_photo_hold_hint")}
      accessibilityActions={[{ name: "activate" }]}
      onAccessibilityAction={open}
      style={{ width: "100%" }}
    >
      <Animated.View style={[shadows.softLg, { borderRadius: 28, transform: [{ scale }] }]}>
        <Image source={{ uri }} style={{ width: "100%", aspectRatio: 1.3, borderRadius: 28 }} />
        {/* Hija e lehtë që shtohet gjatë shtypjes: fotoja duket sikur futet brenda ekranit. */}
        <Animated.View
          pointerEvents="none"
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, borderRadius: 28, backgroundColor: "#000000", opacity: shade }}
        />
      </Animated.View>
    </Pressable>
  );
}
