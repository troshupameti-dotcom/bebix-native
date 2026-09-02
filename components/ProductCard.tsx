import { useRef } from "react";
import { View, Text, Pressable, Image, Animated } from "react-native";
import { useAppState } from "@/lib/state/AppStateContext";
import { Icon } from "@/components/ui/Icon";
import { shadows } from "@/lib/shadows";
import { Product } from "@/lib/homeContent";

type Props = {
  product: Product;
  onPress: () => void;
  cardWidth?: number;
};

const BADGE_LABEL: Record<NonNullable<Product["badge"]>, string> = {
  new: "E RE",
  bestseller: "TOP",
  sale: "OFERTË",
};

function discountPercent(product: Product): number | null {
  if (!product.compareAtPrice || product.compareAtPrice <= product.price) return null;
  return Math.round(100 - (product.price / product.compareAtPrice) * 100);
}

export function ProductCard({ product, onPress, cardWidth }: Props) {
  const { toggleFavorite, isFavorite } = useAppState();
  const fav = isFavorite(product.id);
  const scale = useRef(new Animated.Value(1)).current;
  const heartScale = useRef(new Animated.Value(1)).current;

  const bg = "bg-cream-soft";
  const fg = "#B5A78F";
  const discount = discountPercent(product);
  const savings = product.compareAtPrice != null && product.compareAtPrice > product.price
    ? product.compareAtPrice - product.price
    : null;

  function pressIn() {
    Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, speed: 40 }).start();
  }
  function pressOut() {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 40 }).start();
  }
  function onHeartPress(e: any) {
    e.stopPropagation?.();
    Animated.sequence([
      Animated.spring(heartScale, { toValue: 1.3, useNativeDriver: true, speed: 50 }),
      Animated.spring(heartScale, { toValue: 1, useNativeDriver: true, speed: 40 }),
    ]).start();
    toggleFavorite({ id: product.id, name: product.name, price: `€${product.price.toFixed(2)}`, icon: product.icon });
  }

  return (
    <Animated.View style={[cardWidth ? { width: cardWidth } : { width: "47%" }, { transform: [{ scale }] }]}>
      <Pressable onPress={onPress} onPressIn={pressIn} onPressOut={pressOut} className="mb-4">
        {/* A. Image area — VETËM kjo pjesë ka shadow/rounded/background si "card" */}
        <View
          style={shadows.soft}
          className={`w-full aspect-square items-center justify-center relative rounded-xl2 overflow-hidden ${bg}`}
        >
          {product.imageUrl ? (
            <Image source={{ uri: product.imageUrl }} className="w-full h-full" resizeMode="contain" />
          ) : (
            <Icon name={product.icon} size={36} color={fg} />
          )}

          {/* Top-left: delivery + status badges */}
          <View className="absolute top-2 left-2" style={{ gap: 4 }}>
            {product.freeDelivery && (
              <View className="bg-surface rounded-full px-2 py-1 flex-row items-center self-start" style={shadows.soft}>
                <Icon name="cube" size={10} color="#6E7452" />
                <Text className="font-bodyMedium text-[8px] text-olive ml-1 uppercase">Falas</Text>
              </View>
            )}
            {product.badge && (
              <View className="bg-surface rounded-full px-2 py-0.5 self-start" style={shadows.soft}>
                <Text className="font-bodySemibold text-[9px] text-ink uppercase tracking-wide">
                  {BADGE_LABEL[product.badge]}
                </Text>
              </View>
            )}
          </View>

          {/* Discount badge — top-right */}
          {discount != null && (
            <View className="absolute top-2 right-2 bg-orange rounded-full px-2 py-0.5">
              <Text className="font-bodySemibold text-[9px] text-white">-{discount}%</Text>
            </View>
          )}

          {/* Favorite button — bottom-right, mbi imazhin */}
          <Pressable
            onPress={onHeartPress}
            hitSlop={8}
            className="absolute bottom-2 right-2 w-8 h-8 rounded-full bg-surface items-center justify-center"
            style={shadows.soft}
          >
            <Animated.View style={{ transform: [{ scale: heartScale }] }}>
              <Icon name="heart" size={16} color={fav ? "#C9702E" : "#A79D8A"} />
            </Animated.View>
          </Pressable>
        </View>

        {/* B. Brand / Title / Price — JASHTË kornizës, direkt mbi background, pa shadow/card */}
        <View className="pt-2.5 px-0.5">
          <Text className="font-body text-xs text-ink-faint mb-1" numberOfLines={1}>
            {product.brand}
            {product.merchant && product.merchant !== product.brand ? ` · ${product.merchant}` : ""}
          </Text>
          <Text className="font-bodyMedium text-sm text-ink mb-2 leading-5" numberOfLines={2}>
            {product.name}
          </Text>
          <View className="flex-row items-baseline flex-wrap">
            <Text className="font-bodySemibold text-base text-ink mr-2">€{product.price.toFixed(2)}</Text>
            {product.compareAtPrice != null && (
              <Text className="font-body text-xs text-ink-faint line-through">
                €{product.compareAtPrice.toFixed(2)}
              </Text>
            )}
          </View>
          {savings != null && (
            <Text className="font-bodyMedium text-xs text-olive mt-1">
              Kurse €{savings.toFixed(2)}
            </Text>
          )}
          {product.stock != null && product.stock > 0 && product.stock <= 5 && (
            <Text className="font-bodyMedium text-xs text-orange mt-1">
              Vetëm {product.stock} mbeten
            </Text>
          )}
          {product.stock === 0 && (
            <Text className="font-bodyMedium text-xs text-ink-faint mt-1">
              Jashtë stokut
            </Text>
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
}

/** Skeleton — e njëjta strukturë/madhësi si karta reale. */
export function ProductCardSkeleton({ cardWidth }: { cardWidth?: number }) {
  return (
    <View style={cardWidth ? { width: cardWidth } : { width: "47%" }} className="mb-4">
      <View className="w-full aspect-square bg-cream-soft rounded-xl2" />
      <View className="pt-2.5 px-0.5">
        <View className="w-1/2 h-3 bg-cream-soft rounded mb-2" />
        <View className="w-full h-3.5 bg-cream-soft rounded mb-1.5" />
        <View className="w-3/4 h-3.5 bg-cream-soft rounded mb-3" />
        <View className="w-1/3 h-5 bg-cream-soft rounded" />
      </View>
    </View>
  );
}