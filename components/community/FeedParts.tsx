import { useEffect, useState } from "react";
import { Animated, Pressable, Text, View } from "react-native";
import { ImagePlus, type LucideIcon } from "lucide-react-native";
import { Avatar } from "@/components/community/PostCard";
import { useThemeColors } from "@/lib/theme/useThemeColors";
import { haptics } from "@/lib/haptics";

/**
 * "Ndaj diçka…" në krye të rrjedhës: avatari yt dhe një fushë që hap shkrimin e postimit. Shkrimi është puna kryesore
 * e komunitetit, ndaj rri aty ku nis leximi, jo vetëm te butoni rrethor.
 */
export function ComposerPrompt({ initial, userId, placeholder, photoLabel, onPress }: { initial: string; userId?: string | null; placeholder: string; photoLabel: string; onPress: () => void }) {
  const c = useThemeColors();
  const open = () => {
    haptics.tap();
    onPress();
  };
  return (
    <View className="mx-4 mb-3 flex-row items-center rounded-3xl border border-cream-line bg-surface px-3 py-2.5" style={{ gap: 10 }}>
      <Avatar initial={initial} accent="olive" size={38} userId={userId} />
      <Pressable onPress={open} accessibilityRole="button" accessibilityLabel={placeholder} className="flex-1 justify-center rounded-full bg-cream-soft px-4 active:opacity-80" style={{ minHeight: 42 }}>
        <Text numberOfLines={1} className="font-body text-[14px] text-ink-faint">
          {placeholder}
        </Text>
      </Pressable>
      <Pressable onPress={open} accessibilityRole="button" accessibilityLabel={photoLabel} hitSlop={6} className="h-10 w-10 items-center justify-center rounded-full active:opacity-70">
        <ImagePlus size={21} color={c.olive} strokeWidth={2} />
      </Pressable>
    </View>
  );
}

/** Tri karta bosh që pulsojnë lehtë gjatë ngarkimit: faqja mban formën e vet, pa kërcyer kur vijnë postimet. */
export function FeedSkeleton() {
  const [pulse] = useState(() => new Animated.Value(0.55));
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.55, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return (
    <Animated.View style={{ opacity: pulse }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {[0, 1, 2].map((i) => (
        <View key={i} className="mx-4 mb-3 rounded-3xl border border-cream-line bg-surface p-4">
          <View className="flex-row items-center">
            <View className="h-[42px] w-[42px] rounded-full bg-cream-soft" />
            <View className="ml-3 flex-1" style={{ gap: 7 }}>
              <View className="h-3 w-2/5 rounded-full bg-cream-soft" />
              <View className="h-2.5 w-1/4 rounded-full bg-cream-soft" />
            </View>
          </View>
          <View className="mt-4" style={{ gap: 9 }}>
            <View className="h-3 rounded-full bg-cream-soft" />
            <View className="h-3 w-11/12 rounded-full bg-cream-soft" />
            <View className="h-3 w-3/5 rounded-full bg-cream-soft" />
          </View>
          {i === 0 ? <View className="mt-4 h-40 rounded-2xl bg-cream-soft" /> : null}
        </View>
      ))}
    </Animated.View>
  );
}

/** Gjendje bosh ose gabim: ikonë në rreth, titull, shpjegim dhe një veprim i vetëm. */
export function FeedEmpty({ icon: IconCmp, title, sub, action, onAction }: { icon: LucideIcon; title: string; sub: string; action?: string; onAction?: () => void }) {
  const c = useThemeColors();
  return (
    <View className="items-center px-10 py-10">
      <View className="mb-4 h-16 w-16 items-center justify-center rounded-full bg-cream-soft">
        <IconCmp size={26} color={c.olive} strokeWidth={1.8} />
      </View>
      <Text className="mb-1 text-center font-bodySemibold text-[16px] text-ink">{title}</Text>
      <Text className="mb-5 text-center font-body text-[13.5px] leading-5 text-ink-soft">{sub}</Text>
      {action && onAction ? (
        <Pressable onPress={onAction} accessibilityRole="button" className="justify-center rounded-full bg-ink px-6 active:opacity-80" style={{ minHeight: 44 }}>
          <Text className="font-bodySemibold text-[13.5px] text-cream">{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
