import { MotiView } from "moti";
import { ReactNode } from "react";
import { ViewStyle } from "react-native";

type JiggleWrapProps = {
  active: boolean;
  children: ReactNode;
  style?: ViewStyle;
};

/** Subtle iOS-style wiggle applied to cards/tiles/chips while in edit mode. */
export function JiggleWrap({ active, children, style }: JiggleWrapProps) {
  return (
    <MotiView
      style={style}
      animate={{ rotate: active ? ["-1deg", "1deg"] : "0deg" }}
      transition={
        active
          ? { type: "timing", duration: 160, loop: true, repeatReverse: true }
          : { type: "timing", duration: 120 }
      }
    >
      {children}
    </MotiView>
  );
}
