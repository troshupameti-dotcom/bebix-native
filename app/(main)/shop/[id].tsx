import { useToast } from "@/lib/toast/ToastContext";
import { useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable, Dimensions, Image, ActivityIndicator, FlatList } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAppState } from "@/lib/state/AppStateContext";
import { Icon } from "@/components/ui/Icon";
import { shadows } from "@/lib/shadows";
import { Product } from "@/lib/homeContent";
import { fetchProductById, fetchRelatedProducts } from "@/lib/shopData";
import { BackButton, goBackOr } from "@/components/ui/BackButton";
import { track } from "@/lib/analytics/posthog";
import { ProductReviews, Stars } from "@/components/shop/ProductReviews";
import { useTranslation } from "@/lib/i18n/LanguageContext";

const { width } = Dimensions.get("window");


function RelatedCard({ product, onPress }: { product: Product; onPress: () => void }) {
  const bg = product.accent === "olive" ? "bg-olive-bg" : "bg-orange-bg";
  const fg = product.accent === "olive" ? "#6E7452" : "#C9702E";
  return (
    <Pressable onPress={onPress} style={shadows.soft} className="w-32 bg-surface rounded-xl2 p-3 mr-3">
      <View className={`w-full h-16 rounded-xl items-center justify-center mb-2 overflow-hidden ${bg}`}>
        {product.imageUrl ? (
          <Image source={{ uri: product.imageUrl }} className="w-full h-full" resizeMode="cover" />
        ) : (
          <Icon name={product.icon} size={22} color={fg} />
        )}
      </View>
      <Text className="font-bodyMedium text-xs text-ink" numberOfLines={2}>{product.name}</Text>
      <Text className="font-bodySemibold text-xs text-ink mt-1">€{product.price.toFixed(2)}</Text>
    </Pressable>
  );
}

export default function ProductDetailsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { toggleFavorite, isFavorite, addToCart } = useAppState();
  const { showToast } = useToast();
  const [slide, setSlide] = useState(0);

  const [product, setProduct] = useState<Product | null | undefined>(undefined); // undefined = duke ngarkuar
  const [related, setRelated] = useState<Product[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const p = await fetchProductById(id);
        if (!active) return;
        setProduct(p);
        if (p) {
          // Me pare shkarkohej gjithe katalogu per te mbushur 4 kartela.
          fetchRelatedProducts(p.category, p.id, 4).then((r) => { if (active) setRelated(r); }).catch(() => {});
          track("product_viewed", { product_id: p.id, price: p.price, category: p.category });
        }
      } catch (e: any) {
        if (active) setLoadError(e.message ?? null);
      }
    })();
    return () => {
      active = false;
    };
  }, [id]);

  const avgRating = product?.rating ?? 0;


  if (product === undefined && !loadError) {
    return (
      <SafeAreaView className="flex-1 bg-cream items-center justify-center">
        <ActivityIndicator className="text-olive" />
      </SafeAreaView>
    );
  }

  if (loadError || !product) {
    return (
      <SafeAreaView className="flex-1 bg-cream items-center justify-center px-8">
        <Icon name="close" size={28} color="#A79D8A" />
        <Text className="font-bodyMedium text-sm text-ink-soft mt-3 text-center">{loadError ?? t("prod_not_found")}</Text>
        <Pressable onPress={() => goBackOr("/(main)/shop")} className="mt-4">
          <Text className="font-bodyMedium text-sm text-olive">{t("prod_back")}</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const bg = product.accent === "olive" ? "bg-olive-bg" : "bg-orange-bg";
  const fg = product.accent === "olive" ? "#6E7452" : "#C9702E";
  const fav = isFavorite(product.id);

  // Galeria reale — foto kryesore + fotot shtesë të ngarkuara nga admin
  // panel. Nëse s'ka foto shtesë, mbetet vetëm 1 slide (foto kryesore).
  const gallerySlides = product.imageUrl
    ? [product.imageUrl, ...(product.galleryUrls ?? [])]
    : (product.galleryUrls ?? []);

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      <View className="flex-row items-center justify-between px-5 pt-2 mb-2">
        <BackButton fallback="/(main)/shop" />
        <Pressable
          onPress={() => toggleFavorite({ id: product.id, name: product.name, price: `€${product.price.toFixed(2)}`, icon: product.icon })}
          style={shadows.soft}
          className="w-10 h-10 rounded-full bg-surface items-center justify-center"
        >
          <Icon name="heart" size={18} color={fav ? "#C9702E" : "#2C271F"} />
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 130 }}>
        {/* Gallery — swipe-able nëse ka më shumë se 1 foto */}
        <View>
          {gallerySlides.length > 0 ? (
            <>
              <FlatList
                data={gallerySlides}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                keyExtractor={(uri, i) => `${uri}-${i}`}
                onScroll={(e) => {
                  const i = Math.round(e.nativeEvent.contentOffset.x / width);
                  setSlide(i);
                }}
                scrollEventThrottle={16}
                renderItem={({ item }) => (
                  <Image source={{ uri: item }} style={{ width, height: 288 }} resizeMode="cover" />
                )}
              />
              {gallerySlides.length > 1 && (
                <View className="absolute bottom-3 left-0 right-0 flex-row items-center justify-center">
                  {gallerySlides.map((_, i) => (
                    <View
                      key={i}
                      className={`w-1.5 h-1.5 rounded-full mx-1 ${i === slide ? "bg-white" : "bg-white/50"}`}
                    />
                  ))}
                </View>
              )}
            </>
          ) : (
            <View style={{ width, height: 288 }} className={`items-center justify-center ${bg}`}>
              <Icon name={product.icon} size={72} color={fg} />
            </View>
          )}
        </View>

        {/* Info */}
        <View className="px-5 mt-5">
          <Text className="font-body text-xs text-ink-faint mb-1">{product.brand}</Text>
          <Text className="font-display text-xl text-ink mb-2">{product.name}</Text>
          {/* Pa vlerësime reale, "5.0 (0 vlerësime)" duket i sajuar. */}
          {(product.reviewCount ?? 0) > 0 && (
            <View className="flex-row items-center mb-3">
              <Stars rating={avgRating} />
              <Text className="font-body text-xs text-ink-soft ml-2">
                {avgRating.toFixed(1)} · {product.reviewCount} vlerësime
              </Text>
            </View>
          )}
          <View className="flex-row items-center">
            <Text className="font-display text-2xl text-ink mr-2">€{product.price.toFixed(2)}</Text>
            {product.compareAtPrice && (
              <Text className="font-body text-sm text-ink-faint line-through">€{product.compareAtPrice.toFixed(2)}</Text>
            )}
          </View>
        </View>

        {/* Përshkrimi i vërtetë nga paneli — asgjë e gjeneruar */}
        {product.description ? (
          <View className="px-5 mt-5">
            <Text className="font-body text-sm text-ink-soft leading-6">{product.description}</Text>
          </View>
        ) : null}

        <ProductReviews productId={product.id} />

        {/* Related products */}
        {related.length > 0 && (
          <>
            <Text className="font-bodySemibold text-lg text-ink px-5 mt-7 mb-3">{t("prod_ratings")}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20 }}>
              {related.map((p) => (
                <RelatedCard key={p.id} product={p} onPress={() => router.push(`/shop/${p.id}`)} />
              ))}
            </ScrollView>
          </>
        )}

        {/* Reviews — vijnë kur shtojmë tabelën `reviews` te Supabase */}
        <Text className="font-bodySemibold text-lg text-ink px-5 mt-7 mb-3">{t("prod_ratings")}</Text>
        <View className="px-5">
          <Text className="font-body text-sm text-ink-soft">
            Ende s’ka vlerësime reale për këtë produkt (kërkon tabelë `reviews` shtesë te Supabase — hap tjetër i mundshëm).
          </Text>
        </View>
      </ScrollView>

      {/* Sticky bottom actions */}
      <View className="absolute bottom-0 left-0 right-0 bg-cream px-5 pt-3 pb-6 flex-row" style={shadows.softLg}>
        <Pressable
          onPress={() => {
            addToCart({
              id: product.id,
              name: product.name,
              price: product.price,
              imageUrl: product.imageUrl ?? null,
              icon: product.icon,
            });
            track("added_to_cart", { product_id: product.id, price: product.price });
            showToast(`${product.name} u shtua në shportë`);
          }}
          className="flex-1 bg-surface border border-olive rounded-xl2 py-3.5 items-center mr-3"
        >
          <Text className="font-bodyMedium text-sm text-olive">{t("prod_add_to_cart")}</Text>
        </Pressable>
        <Pressable
          onPress={() => {
            addToCart({
              id: product.id,
              name: product.name,
              price: product.price,
              imageUrl: product.imageUrl ?? null,
              icon: product.icon,
            });
            track("added_to_cart", { product_id: product.id, price: product.price });
            router.push("/shop/cart");
          }}
          className="flex-1 bg-olive rounded-xl2 py-3.5 items-center"
        >
          <Text className="font-bodyMedium text-sm text-on-accent">{t("prod_buy_now")}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}