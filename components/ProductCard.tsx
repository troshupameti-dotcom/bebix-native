import { useState } from "react";
import { View, Text, Pressable, Image, Animated } from "react-native";
import { Minus, Plus, ShoppingCart, Star, Truck } from "lucide-react-native";
import { useThemeColors } from "@/lib/theme/useThemeColors";
import { haptics } from "@/lib/haptics";
import { track } from "@/lib/analytics/posthog";
import { useAppState } from "@/lib/state/AppStateContext";
import { Icon } from "@/components/ui/Icon";
import { shadows } from "@/lib/shadows";
import { Product } from "@/lib/homeContent";
import { productImage } from "@/lib/shop/image";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { formatAgeRange } from "@/lib/shop/age";
import { Price } from "@/components/ui/Price";

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
  const { t, language } = useTranslation();
  const ageLabel = formatAgeRange(product.minAgeMonths, product.maxAgeMonths, language === "en" ? "en" : "sq");
  const { toggleFavorite, isFavorite, addToCart, updateCartQty, removeFromCart, state } = useAppState();
  const inCart = state.cartItems.find((i) => i.id === product.id)?.qty ?? 0;
  // Kufiri i sasisë: stoku kur dihet.
  const canAddMore = product.stock == null || inCart < product.stock;
  const theme = useThemeColors();
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

  const soldOut = product.stock === 0;
  const reviews = product.reviewCount ?? 0;

  function onAddToCart(e: any) {
    e.stopPropagation?.();
    haptics.success();
    addToCart({ id: product.id, name: product.name, price: product.price, imageUrl: product.imageUrl ?? null, icon: product.icon });
    track("added_to_cart", { product_id: product.id, price: product.price, source: "card" });
  }

  function changeQty(e: any, delta: number) {
    e.stopPropagation?.();
    haptics.select();
    const next = inCart + delta;
    if (next <= 0) removeFromCart(product.id);
    else updateCartQty(product.id, next);
  }

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
      {/* Karta si te dyqanet e mëdha online (vlerësimi, çmimi, butoni "Shto në shportë" aty), por pa korniza: vetëm
          fotoja ka qoshe dhe hije të lehtë; teksti rri lirshëm poshtë saj. */}
      <Pressable
        onPress={onPress}
        onPressIn={pressIn}
        onPressOut={pressOut}
        accessibilityRole="button"
        accessibilityLabel={`${product.name}, €${product.price.toFixed(2)}`}
        className="mb-4"
      >
        {/* A. Fotoja: sfond i bardhë edhe në temën e errët, sepse fotot e produkteve janë mbi të bardhë. */}
        <View
          style={[shadows.soft, thumbnail ? { backgroundColor: "#FFFFFF", padding: 6 } : null]}
          className={`relative aspect-square w-full items-center justify-center overflow-hidden rounded-2xl ${thumbnail ? "" : bg}`}
        >
          {thumbnail ? (
            <Image source={{ uri: thumbnail }} className="h-full w-full" resizeMode="contain" style={soldOut ? { opacity: 0.45 } : undefined} />
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

          {/* Lart majtas: zbritja (e kuqe, si çmimi në ofertë) dhe shenja "E re" / "Top". */}
          <View className="absolute left-2 top-2" style={{ gap: 4 }}>
            {discount != null && (
              <View className="self-start rounded-md px-1.5 py-0.5" style={{ backgroundColor: "#D94A4A" }}>
                <Text className="font-bodySemibold text-[11px]" style={{ color: "#FFFFFF" }}>
                  -{discount}%
                </Text>
              </View>
            )}
            {product.badge && product.badge !== "sale" && (
              <View className="self-start rounded-md bg-ink px-1.5 py-0.5">
                <Text className="font-bodySemibold text-[10px] uppercase tracking-wide text-cream">{t(BADGE_LABEL[product.badge])}</Text>
              </View>
            )}
          </View>

          {/* Zemra: lart djathtas, mbi foto. */}
          <Pressable
            onPress={onHeartPress}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={fav ? t("a11y_unfavorite") : t("a11y_favorite")}
            accessibilityState={{ selected: fav }}
            className="absolute right-2 top-2 h-8 w-8 items-center justify-center rounded-full bg-surface"
            style={shadows.press}
          >
            <Animated.View style={{ transform: [{ scale: heartScale }] }}>
              <Icon name="heart" size={16} color={fav ? "#C9702E" : "#A79D8A"} />
            </Animated.View>
          </Pressable>
        </View>

        {/* B. Të dhënat. Marka (1 rresht), emri (2 rreshta), vlerësimi/mosha (1 rresht) zënë gjithmonë të njëjtën
            hapësirë, edhe kur mungojnë: çmimi dhe butoni dalin në të njëjtin nivel te çdo kartë. */}
        <View className="px-0.5 pt-2.5">
          <Text className="font-bodyMedium text-[11.5px] uppercase tracking-wide text-ink-faint" style={{ lineHeight: 15, minHeight: 15 }} numberOfLines={1}>
            {product.brand}
            {product.merchant && product.merchant !== product.brand ? ` · ${product.merchant}` : ""}
          </Text>
          <Text className="mt-0.5 font-bodySemibold text-[14px] text-ink" style={{ lineHeight: 19, minHeight: 38 }} numberOfLines={2} ellipsizeMode="tail">
            {product.name}
          </Text>

          {/* Yjet me numrin e vlerësimeve kur ka; përndryshe mosha e përshtatshme. */}
          <View className="mt-1 flex-row items-center" style={{ minHeight: 16, gap: 4 }}>
            {reviews > 0 ? (
              <>
                <View className="flex-row" accessibilityLabel={t("card_rating_a11y", { rating: product.rating.toFixed(1), n: reviews })}>
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Star key={i} size={12} color="#E8A23B" fill={i <= Math.round(product.rating) ? "#E8A23B" : "transparent"} strokeWidth={1.8} />
                  ))}
                </View>
                <Text className="font-body text-[11.5px] text-ink-faint">({reviews})</Text>
              </>
            ) : ageLabel ? (
              <Text className="font-bodyMedium text-[11.5px] text-olive" numberOfLines={1}>
                {ageLabel}
              </Text>
            ) : null}
          </View>

          <View className="mt-1.5">
            <Price price={product.price} compareAt={product.compareAtPrice} size="md" display />
          </View>

          {/* Një rresht gjendjeje: kursimi, stoku i pakët, ose dërgesa falas. */}
          <View className="mt-0.5 flex-row items-center" style={{ minHeight: 17, gap: 4 }}>
            {soldOut ? null : product.stock != null && product.stock <= 5 ? (
              <Text className="font-bodyMedium text-[11.5px]" style={{ color: "#D94A4A" }} numberOfLines={1}>
                {t("prod_only_left", { n: product.stock })}
              </Text>
            ) : savings != null ? (
              <Text className="font-bodyMedium text-[11.5px] text-olive" numberOfLines={1}>
                {t("prod_save_amount", { amount: savings.toFixed(2) })}
              </Text>
            ) : product.freeDelivery ? (
              <>
                <Truck size={12} color={theme.olive} strokeWidth={2} />
                <Text className="font-bodyMedium text-[11.5px] text-olive" numberOfLines={1}>
                  {t("card_free_delivery")}
                </Text>
              </>
            ) : null}
          </View>

          {soldOut ? (
            <View className="mt-2 items-center justify-center rounded-full bg-cream-soft" style={{ minHeight: 36 }}>
              <Text className="font-bodyMedium text-[12.5px] text-ink-faint">{t("card_out_of_stock")}</Text>
            </View>
          ) : inCart > 0 ? (
            // Tashmë në shportë: sasia ndryshohet këtu, si te dyqanet e mëdha online.
            <View className="mt-2 flex-row items-center justify-between rounded-full bg-olive-bg px-1" style={{ minHeight: 36 }}>
              <Pressable onPress={(e) => changeQty(e, -1)} hitSlop={6} accessibilityRole="button" accessibilityLabel={`${t("card_qty_less")}: ${product.name}`} className="h-7 w-7 items-center justify-center rounded-full bg-surface">
                <Minus size={14} color={theme.ink} strokeWidth={2.4} />
              </Pressable>
              <Text className="font-bodySemibold text-[13px] text-ink" accessibilityLabel={t("card_qty_in_cart", { n: inCart })}>
                {t("card_qty_in_cart", { n: inCart })}
              </Text>
              <Pressable
                onPress={(e) => changeQty(e, 1)}
                disabled={!canAddMore}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel={`${t("card_qty_more")}: ${product.name}`}
                className="h-7 w-7 items-center justify-center rounded-full bg-surface"
                style={canAddMore ? undefined : { opacity: 0.4 }}
              >
                <Plus size={14} color={theme.ink} strokeWidth={2.4} />
              </Pressable>
            </View>
          ) : (
            <Pressable
              onPress={onAddToCart}
              accessibilityRole="button"
              accessibilityLabel={`${t("prod_add_to_cart")}: ${product.name}`}
              className="mt-2 flex-row items-center justify-center rounded-full bg-olive active:opacity-80"
              style={{ minHeight: 36, gap: 6 }}
            >
              <ShoppingCart size={14} color={theme.onAccent} strokeWidth={2.2} />
              <Text className="font-bodySemibold text-[12.5px] text-on-accent" numberOfLines={1}>
                {t("card_add")}
              </Text>
            </Pressable>
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
      <View className="aspect-square w-full rounded-2xl bg-cream-soft" />
      <View className="px-0.5 pt-2.5">
        <View className="mb-2 h-3 w-1/2 rounded bg-cream-soft" />
        <View className="mb-1.5 h-3.5 w-full rounded bg-cream-soft" />
        <View className="mb-3 h-3.5 w-3/4 rounded bg-cream-soft" />
        <View className="mb-3 h-5 w-1/3 rounded bg-cream-soft" />
        <View className="h-9 w-full rounded-full bg-cream-soft" />
      </View>
    </View>
  );
}
