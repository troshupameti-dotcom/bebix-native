import { Image } from "expo-image";
import { MotiView } from "moti";
import { useThemeColors } from "@/lib/theme/useThemeColors";

type LogoProps = {
  tagline?: string;
  size?: "md" | "lg";
};

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

export function Logo({ size = "lg" }: LogoProps) {
  const { isDark } = useThemeColors();
  const width = size === "lg" ? 200 : 160;

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
