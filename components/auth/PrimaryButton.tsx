import { Pressable, Text, ActivityIndicator, PressableProps } from "react-native";
import { MotiView } from "moti";
import { useState } from "react";
import { shadows } from "@/lib/shadows";

type PrimaryButtonProps = PressableProps & {
  label: string;
  loading?: boolean;
};

/** Solid ink-on-cream CTA — "Log In" / "Create Account". */
export function PrimaryButton({ label, loading, disabled, style, ...props }: PrimaryButtonProps) {
  const [pressed, setPressed] = useState(false);

  return (
    <Pressable
      disabled={disabled || loading}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={[{ opacity: disabled ? 0.5 : 1 }, style as object]}
      {...props}
    >
      <MotiView
        animate={{ scale: pressed ? 0.97 : 1 }}
        transition={{ type: "timing", duration: 150 }}
        style={shadows.soft}
        className="w-full items-center justify-center rounded-2xl bg-ink py-4"
      >
        {loading ? (
          <ActivityIndicator color="#FBF6EE" />
        ) : (
          <Text className="font-bodyMedium text-[15px] text-cream">{label}</Text>
        )}
      </MotiView>
    </Pressable>
  );
}
