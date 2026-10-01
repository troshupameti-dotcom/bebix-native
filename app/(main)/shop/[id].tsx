import { useToast } from "@/lib/toast/ToastContext";
import { useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable, Image, ActivityIndicator, FlatList } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAppState } from "@/lib/state/AppStateContext";
import { Icon } from "@/components/ui/Icon";
import { shadows } from "@/lib/shadows";
import { Product } from "@/lib/homeContent";
import { fetchProductById, fetchRelatedProducts } from "@/lib/shopData";
import { ProductCard } from "@/components/ProductCard";
import { BackButton, goBackOr } from "@/components/ui/BackButton";
import { track } from "@/lib/analytics/posthog";
import { ProductReviews, Stars } from "@/components/shop/ProductReviews";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { useContentWidth } from "@/lib/layout";




export default function ProductDetailsScreen() {
  const width = useContentWidth();
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
                  // `contain` mbi të bardhë: fotot e produkteve kanë sfond të bardhë,
                  // dhe me `cover` një shishe e gjatë dilte e prerë lart e poshtë.
                  <View style={{ width, height: 360, backgroundColor: "#FFFFFF", padding: 6 }}>
                    <Image source={{ uri: item }} style={{ width: "100%", height: "100%" }} resizeMode="contain" />
                  </View>
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
              {product.emoji ? (
                <Text
                  style={{
                    fontSize: 150,
                    lineHeight: 176,
                    includeFontPadding: false,
                    textAlignVertical: "center",
                  }}
                >
                  {product.emoji}
                </Text>
              ) : (
                <Icon name={product.icon} size={72} color={fg} />
              )}
            </View>
          )}
        </View>

        {/* Info — shkronjat u rriten: kjo âsht faqja ku klienti vendos, dhe
            emri e çmimi lexoheshin si tekst dytësor. */}
        <View className="mt-5 px-5">
          <Text className="mb-1 font-body text-[13px] text-ink-faint">{product.brand}</Text>
          <Text className="mb-2 font-display text-[26px] leading-8 text-ink">{product.name}</Text>
          {/* Pa vlerësime reale, "5.0 (0 vlerësime)" duket i sajuar. */}
          {(product.reviewCount ?? 0) > 0 && (
            <View className="mb-3 flex-row items-center">
              <Stars rating={avgRating} />
              <Text className="ml-2 font-body text-[13px] text-ink-soft">
                {avgRating.toFixed(1)} · {t("prod_review_count", { n: product.reviewCount ?? 0 })}
              </Text>
            </View>
          )}
          <View className="flex-row items-baseline">
            <Text className="mr-2 font-display text-[30px] text-ink">€{product.price.toFixed(2)}</Text>
            {product.compareAtPrice && (
              <Text className="font-body text-[15px] text-ink-faint line-through">
                €{product.compareAtPrice.toFixed(2)}
              </Text>
            )}
          </View>
        </View>

        {/* Përshkrimi i vërtetë nga paneli — asgjë e gjeneruar */}
        {product.description ? (
          <View className="mt-5 px-5">
            <Text className="font-body text-[15px] leading-7 text-ink-soft">{product.description}</Text>
          </View>
        ) : null}

        <ProductReviews productId={product.id} />

        {/* Produkte të ngjashme, në fund: pasi klienti e ka lexuar këtë,
            jo mes përshkrimit dhe vlerësimeve.

            Këtu rrinin dy blloqe: njëri titullohej "Vlerësime" por tregonte
            produkte, tjetri ishte një shënim i mbetur nga zhvillimi që u
            thoshte klientëve se vlerësimet "ende s'ekzistojnë" — ndërsa
            vlerësimet e vërteta shfaqeshin një rresht më lart. */}
        {related.length > 0 && (
          <>
            <Text className="mb-3 mt-8 px-5 font-bodySemibold text-[17px] text-ink">{t("prod_similar")}</Text>
            {/* E njëjta kartë si në dyqan: kornizë, lartësi dhe foto njësoj.
                Mbushja vertikale lë hijen të duket (ScrollView horizontal e pret). */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 12 }}
            >
              {related.map((p) => (
                <View key={p.id} className="mr-3">
                  <ProductCard product={p} cardWidth={150} onPress={() => router.push(`/shop/${p.id}`)} />
                </View>
              ))}
            </ScrollView>
          </>
        )}
      </ScrollView>

      {/* Sticky bottom actions */}
      <View className="absolute bottom-0 left-0 right-0 bg-cream px-5 pt-3 pb-6 flex-row" style={shadows.softLg}>
        {product.stock === 0 ? (
          // Pa stok: më parë produkti shtohej në shportë dhe gabimi dilte vetëm te arkëtimi.
          <View className="flex-1 bg-cream-soft rounded-xl2 py-3.5 items-center">
            <Text className="font-bodySemibold text-[15px] text-ink-faint">{t("prod_out_of_stock_action")}</Text>
          </View>
        ) : (
        <>
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
            showToast(t("prod_added_to_cart", { name: product.name }));
          }}
          className="flex-1 bg-surface border border-olive rounded-xl2 py-3.5 items-center mr-3"
        >
          <Text className="font-bodyMedium text-[15px] text-olive">{t("prod_add_to_cart")}</Text>
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
          <Text className="font-bodySemibold text-[15px] text-on-accent">{t("prod_buy_now")}</Text>
        </Pressable>
        </>
        )}
      </View>
    </SafeAreaView>
  );
}