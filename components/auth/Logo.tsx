import { Image } from "expo-image";
import { MotiView } from "moti";
import { useThemeColors } from "@/lib/theme/useThemeColors";

type LogoProps = {
  tagline?: string;
  /** "xl" = ekrani i hapjes: sa më afër madhësisë së splash-it. */
  size?: "md" | "lg" | "xl";
  /** "full" = shenja "b" me fjalën poshtë, për ekranet e hyrjes. */
  variant?: "wordmark" | "full";
};

/** Logoja e plotë (832×840, e tejdukshme): mjaft e madhe për ekranet 3x. */
const FULL_RATIO = 840 / 832;

/**
 * Fjala "bebix", e njëjta si te webi.
 *
 * Është figurë, jo tekst: shkronjat e logos janë të vizatuara dhe asnjë
 * font nuk ua jep atë trashësi të rrumbullakët. Sfondi është i tejdukshëm,
 * pra fjala rri drejtpërdrejt mbi ngjyrën e ekranit — më parë asetit i
 * vinte pas një drejtkëndësh kremi, i cili dukej si njollë sapo sfondi
 * ndryshonte.
 *
 * Tema e errët merr variantin ku shkronjat janë krem: navy-ja e ditës
 * zhduket mbi sfondin e natës. "x"-i blu mbetet i njëjtë në të dyja.
 */
const ASSET_WIDTH = 804;
const ASSET_HEIGHT = 229;

export function Logo({ size = "lg", variant = "wordmark" }: LogoProps) {
  const { isDark } = useThemeColors();

  if (variant === "full") {
    const fullWidth = size === "xl" ? 240 : size === "lg" ? 150 : 116;
    return (
      <MotiView
        from={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "timing", duration: 600 }}
        className="items-center"
      >
        <Image
          source={isDark ? require("@/assets/images/logo-full-dark.png") : require("@/assets/images/logo-full.png")}
          style={{ width: fullWidth, height: fullWidth * FULL_RATIO }}
          contentFit="contain"
          accessibilityLabel="Bebix"
        />
      </MotiView>
    );
  }

  const width = size === "xl" ? 240 : size === "lg" ? 200 : 160;

  return (
    <MotiView
      from={{ opacity: 0, translateY: 6 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: "timing", duration: 600 }}
      className="items-center"
    >
      <Image
        source={
          isDark
            ? require("@/assets/images/wordmark-dark.png")
            : require("@/assets/images/wordmark.png")
        }
        style={{ width, height: (width * ASSET_HEIGHT) / ASSET_WIDTH }}
        contentFit="contain"
      />
    </MotiView>
  );
}
