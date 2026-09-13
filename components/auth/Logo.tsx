import { Image } from "expo-image";
import { View } from "react-native";
import { MotiView } from "moti";

type LogoProps = {
  tagline?: string;
  size?: "md" | "lg";
};

export function Logo({ size = "lg" }: LogoProps) {
  const logoWidth = size === "lg" ? 220 : 160;

  return (
    <MotiView
      from={{ opacity: 0, translateY: 6 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: "timing", duration: 600 }}
      className="items-center"
    >
      <Image
        source={require("@/assets/images/logo.png")}
        style={{ width: logoWidth, height: logoWidth * 0.9 }}
        contentFit="contain"
      />
    </MotiView>
  );
}