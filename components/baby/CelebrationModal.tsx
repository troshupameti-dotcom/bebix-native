import { useEffect, useState } from "react";
import { Modal, View, Text, Pressable, useWindowDimensions } from "react-native";
import { MotiView } from "moti";
import { router } from "expo-router";
import { haptics } from "@/lib/haptics";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import type { Celebration } from "@/lib/baby/celebrations";

const COLORS = ["#F08DB6", "#8DBDE8", "#C9A0DD", "#E5B567", "#9CC98A", "#F3A07F"];
const PIECES = 28;

/** Konfeti me Moti: copa që bien me vonesa të ndryshme. Pa librari të re. */
function Confetti() {
  const { width, height } = useWindowDimensions();
  // Vlerat e rastit krijohen një herë (jo në çdo render).
  const [pieces] = useState(() =>
    Array.from({ length: PIECES }, (_, i) => ({
      x: Math.random() * width,
      drift: (Math.random() - 0.5) * 120,
      size: 6 + Math.random() * 8,
      delay: Math.random() * 900,
      duration: 2200 + Math.random() * 1600,
      rotate: Math.random() * 720,
      color: COLORS[i % COLORS.length],
      round: i % 3 === 0,
    }))
  );
  return (
    <View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}>
      {pieces.map((p, i) => (
        <MotiView
          key={i}
          from={{ translateY: -40, translateX: 0, rotate: "0deg", opacity: 1 }}
          animate={{ translateY: height + 40, translateX: p.drift, rotate: `${p.rotate}deg`, opacity: 0.9 }}
          transition={{ type: "timing", duration: p.duration, delay: p.delay }}
          style={{
            position: "absolute",
            left: p.x,
            width: p.size,
            height: p.round ? p.size : p.size * 1.6,
            borderRadius: p.round ? p.size / 2 : 2,
            backgroundColor: p.color,
          }}
        />
      ))}
    </View>
  );
}

/**
 * Karta e madhe e festimit: dita e 100-të, muajt, ditëlindja, arritja e re.
 * Del një herë; "Faleminderit" e mbyll, "Shto një foto" çon te Momentet.
 */
export function CelebrationModal({
  celebration,
  babyName,
  onClose,
  canAddPhoto = true,
}: {
  celebration: Celebration | null;
  babyName: string;
  onClose: () => void;
  /** Gjyshërit (vetëm shikim) s'shtojnë foto. */
  canAddPhoto?: boolean;
}) {
  const { t } = useTranslation();
  useEffect(() => {
    if (celebration) haptics.success();
  }, [celebration]);
  if (!celebration) return null;

  const c = celebration;
  const emoji = c.kind === "milestone" ? "⭐" : c.kind === "day100" ? "💯" : c.kind === "half" ? "🎉" : "🎂";
  const title =
    c.kind === "day100"
      ? t("celebrate_day100", { name: babyName })
      : c.kind === "month"
        ? t(c.months === 1 ? "celebrate_month_one" : "celebrate_month", { name: babyName, n: c.months })
        : c.kind === "half"
          ? t("celebrate_half", { name: babyName })
          : c.kind === "year"
            ? t("celebrate_year", { name: babyName, n: c.years })
            : t("celebrate_milestone");
  const highlight = c.kind === "milestone" ? c.title.trim() || null : null;
  const body =
    c.kind === "milestone"
      ? t("celebrate_milestone_body")
      : c.kind === "day100"
        ? t("celebrate_day100_body")
        : c.kind === "year"
          ? t("celebrate_year_body")
          : t("celebrate_month_body");

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View className="flex-1 items-center justify-center px-6" style={{ backgroundColor: "rgba(23,33,43,0.72)" }}>
        <Confetti />
        <MotiView
          from={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", damping: 14 }}
          className="w-full items-center rounded-[32px] px-6 pb-6 pt-8"
          style={{ backgroundColor: "#FFF8EF", maxWidth: 420 }}
        >
          <MotiView
            from={{ scale: 0.6, rotate: "-12deg" }}
            animate={{ scale: 1, rotate: "0deg" }}
            transition={{ type: "spring", damping: 8, delay: 150 }}
          >
            <Text style={{ fontSize: 64 }}>{emoji}</Text>
          </MotiView>
          <Text className="mt-3 text-center font-display text-[26px] leading-8" style={{ color: "#17212B" }}>
            {title}
          </Text>
          {highlight ? (
            <Text className="mt-2 text-center font-bodySemibold text-[17px]" style={{ color: "#B8336A" }}>
              {highlight}
            </Text>
          ) : null}
          <Text className="mt-2 text-center font-body text-[14.5px] leading-5" style={{ color: "#3B4652" }}>
            {body}
          </Text>

          {canAddPhoto ? (
            <Pressable
              onPress={() => {
                haptics.tap();
                onClose();
                router.push("/(main)/baby/moments");
              }}
              accessibilityRole="button"
              className="mt-6 w-full items-center rounded-2xl py-4"
              style={{ backgroundColor: "#17212B", minHeight: 56 }}
            >
              <Text className="font-bodySemibold text-[15px]" style={{ color: "#FFF8EF" }}>
                {t("celebrate_add_photo")}
              </Text>
            </Pressable>
          ) : null}
          <Pressable onPress={onClose} accessibilityRole="button" className="mt-2 w-full items-center py-3.5" style={{ minHeight: 48 }}>
            <Text className="font-bodyMedium text-[15px]" style={{ color: "#5C6670" }}>
              {t("celebrate_thanks")}
            </Text>
          </Pressable>
        </MotiView>
      </View>
    </Modal>
  );
}
