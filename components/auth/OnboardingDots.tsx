import { Pressable, View } from "react-native";
import { MotiView } from "moti";

type OnboardingDotsProps = {
  count: number;
  activeIndex: number;
  onSelect?: (index: number) => void;
};

export function OnboardingDots({ count, activeIndex, onSelect }: OnboardingDotsProps) {
  return (
    <View className="flex-row items-center justify-center gap-2">
      {Array.from({ length: count }).map((_, i) => {
        const isActive = i === activeIndex;
        return (
          <Pressable key={i} onPress={() => onSelect?.(i)} hitSlop={8}>
            <MotiView
              animate={{ width: isActive ? 20 : 6, opacity: isActive ? 1 : 0.35 }}
              transition={{ type: "timing", duration: 300 }}
              className="h-1.5 rounded-full bg-ink"
            />
          </Pressable>
        );
      })}
    </View>
  );
}
