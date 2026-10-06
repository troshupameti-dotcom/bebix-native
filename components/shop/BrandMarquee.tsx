import { useEffect, useState } from "react";
import { AccessibilityInfo, Animated, Easing, Image, Pressable, Text, View } from "react-native";
import { Icon } from "@/components/ui/Icon";
import type { Brand } from "@/lib/homeContent";

/**
 * Markat si shirit logosh që rrëshqet ngadalë pa pushim, si te webi. Me pak marka (nën 6) qëndron i palëvizshëm,
 * sepse një shirit që ikën me dy logo duket bosh; po ashtu kur pajisja kërkon pak lëvizje.
 * Logot mbeten të prekshme gjatë lëvizjes.
 */
const TILE = 54;
const GAP = 10;
/** Pikselë në sekondë: i ngadaltë, që logot të lexohen. */
const SPEED = 28;

function Tile({ brand, color, onPress }: { brand: Brand; color: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={brand.name} style={{ width: TILE, marginRight: GAP }} className="items-center">
      <View className="h-[52px] w-[52px] items-center justify-center overflow-hidden rounded-xl border border-cream-line bg-surface">
        {brand.logoUrl ? (
          <Image source={{ uri: brand.logoUrl }} className="h-full w-full" resizeMode="cover" />
        ) : (
          <Icon name={brand.icon} size={20} color={color} />
        )}
      </View>
      <Text className="mt-1 text-center font-bodyMedium text-[10px] text-ink-soft" numberOfLines={1}>{brand.name}</Text>
    </Pressable>
  );
}

export function BrandMarquee({ brands, color, onOpen }: { brands: Brand[]; color: string; onOpen: (b: Brand) => void }) {
  const [x] = useState(() => new Animated.Value(0));
  const [rowWidth, setRowWidth] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  const moving = brands.length >= 6 && !reduceMotion;

  useEffect(() => {
    let alive = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((v) => alive && setReduceMotion(v));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!moving || rowWidth <= 0) return;
    x.setValue(0);
    const loop = Animated.loop(
      Animated.timing(x, { toValue: -rowWidth, duration: (rowWidth / SPEED) * 1000, easing: Easing.linear, useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, [moving, rowWidth, x]);

  const row = brands.map((b) => <Tile key={b.id} brand={b} color={color} onPress={() => onOpen(b)} />);

  if (!moving) {
    return <View className="flex-row px-5">{row}</View>;
  }

  return (
    <View style={{ overflow: "hidden" }}>
      <Animated.View style={{ flexDirection: "row", transform: [{ translateX: x }] }}>
        {/* Dy kopje radhazi: kur e para del jashtë, e dyta është saktësisht aty ku nisi e para. */}
        <View style={{ flexDirection: "row", paddingLeft: 20 }} onLayout={(e) => setRowWidth(e.nativeEvent.layout.width)}>{row}</View>
        <View style={{ flexDirection: "row", paddingLeft: 20 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {brands.map((b) => <Tile key={`c-${b.id}`} brand={b} color={color} onPress={() => onOpen(b)} />)}
        </View>
      </Animated.View>
    </View>
  );
}
