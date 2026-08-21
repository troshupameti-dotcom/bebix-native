import { View, Text } from "react-native";
import { MotiView } from "moti";
import Svg, { Circle, Path } from "react-native-svg";

type LogoProps = {
  tagline?: string;
  size?: "md" | "lg";
};

export function Logo({ tagline = "For every little step.", size = "lg" }: LogoProps) {
  const wordmarkClass = size === "lg" ? "text-5xl" : "text-3xl";

  return (
    <MotiView
      from={{ opacity: 0, translateY: 6 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: "timing", duration: 600 }}
      className="items-center gap-3"
    >
      <Svg width={40} height={48} viewBox="0 0 40 48">
        <Circle cx="20" cy="26" r="14" stroke="#2C271F" strokeWidth={2.4} fill="none" />
        <Circle cx="20" cy="26" r="2.4" fill="#2C271F" />
        <Path
          d="M15 10c0-3 2.2-5.5 5-5.5s5 2.5 5 5.5"
          stroke="#2C271F"
          strokeWidth={2.4}
          strokeLinecap="round"
          fill="none"
        />
      </Svg>

      <Text className={`font-wordmark text-ink ${wordmarkClass}`}>Bebix</Text>

      {tagline ? <Text className="font-body text-sm text-ink-soft tracking-wide">{tagline}</Text> : null}
    </MotiView>
  );
}
