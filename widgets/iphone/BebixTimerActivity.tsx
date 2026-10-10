import { HStack, Image, Spacer, Text, VStack } from "@expo/ui/swift-ui";
import { font, foregroundStyle, padding } from "@expo/ui/swift-ui/modifiers";
import { createLiveActivity, type LiveActivityEnvironment } from "expo-widgets";
import type { LiveActivityProps } from "@/lib/widgets/iosProps";

/**
 * Live Activity / Dynamic Island për gjumin dhe gjirin: kohëmatësi numëron
 * vetë në ekranin e kyçur (Text me dateStyle "timer"), pa përditësime nga
 * app-i. Si widget-i, funksioni ekzekutohet jashtë app-it.
 */
const BebixTimer = (props: LiveActivityProps, env: LiveActivityEnvironment) => {
  "widget";
  const dim = env.isLuminanceReduced === true;
  const accent = dim ? "#FFFFFF" : props.kind === "breast" ? "#F08DB6" : "#C9A0DD";
  const icon = props.kind === "breast" ? "drop.fill" : "moon.zzz.fill";
  const started = new Date(props.startedAt);

  return {
    banner: (
      <HStack spacing={12} modifiers={[padding({ all: 14 })]}>
        <Image systemName={icon} size={26} color={accent} />
        <VStack alignment="leading" spacing={2}>
          <Text modifiers={[font({ size: 15, weight: "semibold" })]}>{props.title}</Text>
          <Text modifiers={[font({ size: 13 }), foregroundStyle("#A9B1B8")]}>{props.subtitle}</Text>
        </VStack>
        <Spacer />
        <Text date={started} dateStyle="timer" modifiers={[font({ size: 28, weight: "bold", design: "rounded" }), foregroundStyle(accent)]} />
      </HStack>
    ),
    compactLeading: <Image systemName={icon} color={accent} />,
    compactTrailing: <Text date={started} dateStyle="timer" modifiers={[font({ size: 14, weight: "semibold" }), foregroundStyle(accent)]} />,
    minimal: <Image systemName={icon} color={accent} />,
    expandedLeading: <Image systemName={icon} size={28} color={accent} />,
    expandedTrailing: <Text date={started} dateStyle="timer" modifiers={[font({ size: 24, weight: "bold", design: "rounded" }), foregroundStyle(accent)]} />,
    expandedBottom: <Text modifiers={[font({ size: 14 })]}>{`${props.title} · ${props.subtitle}`}</Text>,
  };
};

export default createLiveActivity("BebixTimer", BebixTimer);
