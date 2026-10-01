import { useState } from "react";
import { View, Text, Pressable, Image, Animated } from "react-native";
import { useAppState } from "@/lib/state/AppStateContext";
import { Icon } from "@/components/ui/Icon";
import { shadows } from "@/lib/shadows";
import { Product } from "@/lib/homeContent";
import { productImage } from "@/lib/shop/image";
import { useTranslation } from "@/lib/i18n/LanguageContext";

type Props = {
  product: Product;
  onPress: () => void;
  cardWidth?: number;
};

const BADGE_LABEL = {
  new: "prod_badge_new",
  bestseller: "prod_badge_top",
  sale: "prod_badge_sale",
} as const satisfies Record<NonNullable<Product["badge"]>, string>;

function discountPercent(product: Product): number | null {
  if (!product.compareAtPrice || product.compareAtPrice <= product.price) return null;
  return Math.round(100 - (product.price / product.compareAtPrice) * 100);
}

export function ProductCard({ product, onPress, cardWidth }: Props) {
  const { t } = useTranslation();
  const { toggleFavorite, isFavorite } = useAppState();
  const fav = isFavorite(product.id);
  // Inicializues dembel: nje Animated.Value e vetme per gjithe jeten e
  // komponentit, pa lexim ref-i gjate render-it.
  const [scale] = useState(() => new Animated.Value(1));
  const [heartScale] = useState(() => new Animated.Value(1));

  const bg = "bg-cream-soft";
  const fg = "#B5A78F";
  // Vend-mbajtësi ndjek gjerësinë e kartelës, që raporti të mbetet i njëjti
  // në çdo madhësi ekrani; 160 është gjerësia tipike kur nuk jepet.
  const emojiSize = Math.round((cardWidth ?? 160) * 0.5);
  const discount = discountPercent(product);
  // Kartela eshte ~180px; pa kete shkarkohej foto origjinale per secilen.
  const thumbnail = productImage(product.imageUrl, 400);
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
          // Kornizë e bardhë (edhe në temën e errët) kur ka foto: fotot e
          // produkteve kanë sfond të bardhë, dhe mbi krem dilnin si drejtkëndësha.
          style={[shadows.soft, thumbnail ? { backgroundColor: "#FFFFFF", padding: 3 } : null]}
          className={`w-full aspect-square items-center justify-center relative rounded-xl2 overflow-hidden ${thumbnail ? "" : bg}`}
        >
          {thumbnail ? (
            <Image source={{ uri: thumbnail }} className="w-full h-full" resizeMode="contain" />
          ) : product.emoji ? (
            // Pa foto, emoji i kategorise thote te pakten cfare lloji eshte.
            <Text
              style={{
                fontSize: emojiSize,
                lineHeight: Math.round(emojiSize * 1.16),
                includeFontPadding: false,
                textAlignVertical: "center",
              }}
            >
              {product.emoji}
            </Text>
          ) : (
            <Icon name={product.icon} size={36} color={fg} />
          )}

          {/* Top-left: delivery + status badges */}
          <View className="absolute top-2 left-2" style={{ gap: 4 }}>
            {product.freeDelivery && (
              <View className="bg-surface rounded-full px-2 py-1 flex-row items-center self-start" style={shadows.soft}>
                <Icon name="cube" size={10} color="#6E7452" />
                <Text className="font-bodyMedium text-[8px] text-olive ml-1 uppercase">{t("card_free_shipping")}</Text>
              </View>
            )}
            {product.badge && (
              <View className="bg-surface rounded-full px-2 py-0.5 self-start" style={shadows.soft}>
                <Text className="font-bodySemibold text-[9px] text-ink uppercase tracking-wide">
                  {t(BADGE_LABEL[product.badge])}
                </Text>
              </View>
            )}
          </View>

          {/* Discount badge — top-right */}
          {discount != null && (
            <View className="absolute top-2 right-2 bg-orange rounded-full px-2 py-0.5">
              <Text className="font-bodySemibold text-[9px] text-on-accent">-{discount}%</Text>
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
              {t("prod_save_amount", { amount: savings.toFixed(2) })}
            </Text>
          )}
          {product.stock != null && product.stock > 0 && product.stock <= 5 && (
            <Text className="font-bodyMedium text-xs text-orange mt-1">
              {t("prod_only_left", { n: product.stock })}
            </Text>
          )}
          {product.stock === 0 && (
            <Text className="font-bodyMedium text-xs text-ink-faint mt-1">
              {t("card_out_of_stock")}
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