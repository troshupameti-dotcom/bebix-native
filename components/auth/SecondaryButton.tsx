import { Pressable, Text, PressableProps } from "react-native";
import { MotiView } from "moti";
import { useState } from "react";

type SecondaryButtonProps = PressableProps & {
  label: string;
};

/** Outlined cream button — "Log In" on the welcome screen. */
export function SecondaryButton({ label, style, ...props }: SecondaryButtonProps) {
  const [pressed, setPressed] = useState(false);

  return (
    <Pressable
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={style as object}
      {...props}
    >
      <MotiView
        animate={{ scale: pressed ? 0.97 : 1 }}
        transition={{ type: "timing", duration: 150 }}
        className="w-full items-center justify-center rounded-2xl border border-ink/15 bg-cream py-4"
      >
        <Text className="font-bodyMedium text-[15px] text-ink">{label}</Text>
      </MotiView>
    </Pressable>
  );
}
