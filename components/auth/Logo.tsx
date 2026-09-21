import { Image } from "expo-image";
import { MotiView } from "moti";
import { useThemeColors } from "@/lib/theme/useThemeColors";

type LogoProps = {
  tagline?: string;
  size?: "md" | "lg";
};

// Permasat e vertetea te asetit. Kutia ndjek ato, qe shenja te mos dale
// me e vogel se sa kerkohet dhe te mos rrije e shtyre nga qendra.
const ASSET_WIDTH = 832;
const ASSET_HEIGHT = 840;

export function Logo({ size = "lg" }: LogoProps) {
  const { isDark } = useThemeColors();
  const width = size === "lg" ? 240 : 180;

  return (
    <MotiView
      from={{ opacity: 0, translateY: 6 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: "timing", duration: 600 }}
      className="items-center"
    >
      <Image
        // Navy-ja e fjales "bebix" zhduket mbi sfondin e erret, ndaj tema e
        // erret merr nje variant ku shkronjat jane krem.
        source={
          isDark
            ? require("@/assets/images/logo-full-dark.png")
            : require("@/assets/images/logo-full.png")
        }
        style={{ width, height: (width * ASSET_HEIGHT) / ASSET_WIDTH }}
        contentFit="contain"
      />
    </MotiView>
  );
}
