import { useMemo, useState } from "react";
import { View, Text, ScrollView, Pressable, Dimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAppState } from "@/lib/state/AppStateContext";
import { Icon, IconName } from "@/components/ui/Icon";
import { shadows } from "@/lib/shadows";
import { productCatalog, reviewCatalog, questionCatalog, Product, CATEGORY_META } from "@/lib/homeContent";

const { width } = Dimensions.get("window");

function StarRow({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <View className="flex-row">
      {[1, 2, 3, 4, 5].map((n) => (
        <Icon key={n} name="sparkle" size={size} color={n <= Math.round(rating) ? "#C9702E" : "#E9DFCC"} />
      ))}
    </View>
  );
}

function ComingSoonRow({ icon, label }: { icon: IconName; label: string }) {
  return (
    <View className="flex-row items-center bg-cream-soft rounded-xl2 p-3 mr-3">
      <Icon name={icon} size={16} color="#A79D8A" />
      <Text className="font-bodyMedium text-xs text-ink-faint ml-2">{label}</Text>
      <View className="bg-surface rounded-full px-2 py-0.5 ml-2">
        <Text className="font-bodySemibold text-[9px] text-ink-faint">SË SHPEJTI</Text>
      </View>
    </View>
  );
}

function RelatedCard({ product, onPress }: { product: Product; onPress: () => void }) {
  const bg = product.accent === "olive" ? "bg-olive-bg" : "bg-orange-bg";
  const fg = product.accent === "olive" ? "#6E7452" : "#C9702E";
  return (
    <Pressable onPress={onPress} style={shadows.soft} className="w-32 bg-surface rounded-xl2 p-3 mr-3">
      <View className={`w-full h-16 rounded-xl items-center justify-center mb-2 ${bg}`}>
        <Icon name={product.icon} size={22} color={fg} />
      </View>
      <Text className="font-bodyMedium text-xs text-ink" numberOfLines={2}>{product.name}</Text>
      <Text className="font-bodySemibold text-xs text-ink mt-1">€{product.price.toFixed(2)}</Text>
    </Pressable>
  );
}

export default function ProductDetailsScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { toggleFavorite, isFavorite, bumpCart } = useAppState();
  const [slide, setSlide] = useState(0);

  const product = productCatalog.find((p) => p.id === id);

  const reviews = useMemo(() => reviewCatalog.filter((r) => r.productId === id), [id]);
  const questions = useMemo(() => questionCatalog.filter((q) => q.productId === id), [id]);

  const related = useMemo(() => {
    if (!product) return [];
    const byId = product.relatedIds?.map((rid) => productCatalog.find((p) => p.id === rid)).filter(Boolean) as Product[] | undefined;
    if (byId && byId.length) return byId;
    return productCatalog.filter((p) => p.category === product.category && p.id !== product.id).slice(0, 4);
  }, [product]);

  const boughtTogether = useMemo(() => {
    if (!product) return [];
    const byId = product.boughtWithIds?.map((bid) => productCatalog.find((p) => p.id === bid)).filter(Boolean) as Product[] | undefined;
    if (byId && byId.length) return byId;
    return productCatalog.filter((p) => p.category === product.category && p.id !== product.id).slice(0, 2);
  }, [product]);

  const avgRating = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : product?.rating ?? 0;

  // "AI Product Explanation" — përshkrim i gjeneruar nga të dhënat e produktit
  // (jo thirrje reale AI ende — kërkon backend për çelës të fshehur).
  const aiExplanation = useMemo(() => {
    if (!product) return "";
    const catLabel = CATEGORY_META[product.category]?.labelKey ?? product.category;
    const dealNote = product.compareAtPrice ? ` Aktualisht në ofertë, kursim prej €${(product.compareAtPrice - product.price).toFixed(2)}.` : "";
    return `${product.name} nga ${product.brand} bën pjesë te kategoria ${catLabel}, me vlerësim mesatar ${avgRating.toFixed(1)}/5 nga ${reviews.length || product.reviewCount || 0} blerës.${dealNote} Zgjidhje e mirë nëse kërkon cilësi të qëndrueshme për përdorim të përditshëm.`;
  }, [product, avgRating, reviews.length]);

  if (!product) {
    return (
      <SafeAreaView className="flex-1 bg-cream items-center justify-center px-8">
        <Icon name="close" size={28} color="#A79D8A" />
        <Text className="font-bodyMedium text-sm text-ink-soft mt-3 text-center">Produkti s'u gjet.</Text>
        <Pressable onPress={() => router.back()} className="mt-4">
          <Text className="font-bodySemibold text-sm text-olive">Kthehu mbrapa</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const bg = product.accent === "olive" ? "bg-olive-bg" : "bg-orange-bg";
  const fg = product.accent === "olive" ? "#6E7452" : "#C9702E";
  const fav = isFavorite(product.id);
  const gallerySlides = [product.icon, product.icon, product.icon]; // placeholder — zëvendëso me foto reale kur t'i kesh

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      <View className="flex-row items-center justify-between px-5 pt-2 mb-2">
        <Pressable onPress={() => router.back()} style={shadows.soft} className="w-10 h-10 rounded-full bg-surface items-center justify-center">
          <Icon name="chevronLeft" size={18} color="#2C271F" />
        </Pressable>
        <Pressable
          onPress={() => toggleFavorite({ id: product.id, name: product.name, price: `€${product.price.toFixed(2)}`, icon: product.icon })}
          style={shadows.soft}
          className="w-10 h-10 rounded-full bg-surface items-center justify-center"
        >
          <Icon name="heart" size={18} color={fav ? "#C9702E" : "#2C271F"} />
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 130 }}>
        {/* Large gallery */}
        <View>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) => setSlide(Math.round(e.nativeEvent.contentOffset.x / width))}
          >
            {gallerySlides.map((icon, i) => (
              <View key={i} style={{ width }} className={`h-72 items-center justify-center ${bg}`}>
                <Icon name={icon} size={72} color={fg} />
              </View>
            ))}
          </ScrollView>
          <View className="flex-row justify-center mt-3">
            {gallerySlides.map((_, i) => (
              <View key={i} className={`w-1.5 h-1.5 rounded-full mx-1 ${i === slide ? "bg-olive" : "bg-cream-line"}`} />
            ))}
          </View>
        </View>

        {/* Video / 360 / AR — placeholder deri sa të ketë media reale + development build */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16 }}>
          <ComingSoonRow icon="play" label="Video e Produktit" />
          <ComingSoonRow icon="repeat" label="Pamje 360°" />
          <ComingSoonRow icon="cube" label="Pamje AR" />
        </ScrollView>

        {/* Info */}
        <View className="px-5 mt-5">
          <Text className="font-body text-xs text-ink-faint mb-1">{product.brand}</Text>
          <Text className="font-display text-xl text-ink mb-2">{product.name}</Text>
          <View className="flex-row items-center mb-3">
            <StarRow rating={avgRating} />
            <Text className="font-body text-xs text-ink-soft ml-2">
              {avgRating.toFixed(1)} ({reviews.length || product.reviewCount || 0} vlerësime)
            </Text>
          </View>
          <View className="flex-row items-center">
            <Text className="font-display text-2xl text-ink mr-2">€{product.price.toFixed(2)}</Text>
            {product.compareAtPrice && (
              <Text className="font-body text-sm text-ink-faint line-through">€{product.compareAtPrice.toFixed(2)}</Text>
            )}
          </View>
        </View>

        {/* AI explanation */}
        <View className="mx-5 mt-5 bg-olive-bg rounded-xl3 p-4 flex-row" style={shadows.soft}>
          <View className="w-9 h-9 rounded-full bg-surface items-center justify-center mr-3">
            <Icon name="sparkle" size={18} color="#6E7452" />
          </View>
          <Text className="font-body text-sm text-ink flex-1 leading-5">{aiExplanation}</Text>
        </View>

        {/* Frequently bought together */}
        {boughtTogether.length > 0 && (
          <>
            <Text className="font-display text-lg text-ink px-5 mt-7 mb-3">Blihen shpesh së bashku</Text>
            <View className="px-5 flex-row items-center flex-wrap">
              <View className={`w-16 h-16 rounded-xl2 items-center justify-center mr-2 ${bg}`}>
                <Icon name={product.icon} size={26} color={fg} />
              </View>
              <Icon name="plus" size={16} color="#A79D8A" />
              {boughtTogether.map((p, i) => {
                const pbg = p.accent === "olive" ? "bg-olive-bg" : "bg-orange-bg";
                const pfg = p.accent === "olive" ? "#6E7452" : "#C9702E";
                return (
                  <View key={p.id} className="flex-row items-center ml-2">
                    <View className={`w-16 h-16 rounded-xl2 items-center justify-center ${pbg}`}>
                      <Icon name={p.icon} size={26} color={pfg} />
                    </View>
                    {i < boughtTogether.length - 1 && <Icon name="plus" size={16} color="#A79D8A" style={{ marginLeft: 8 }} />}
                  </View>
                );
              })}
            </View>
            <Pressable
              onPress={() => bumpCart(1 + boughtTogether.length)}
              style={shadows.soft}
              className="mx-5 mt-3 bg-surface rounded-xl2 p-3 flex-row items-center justify-between"
            >
              <Text className="font-bodyMedium text-sm text-ink">
                Shto të {boughtTogether.length + 1} — €
                {(product.price + boughtTogether.reduce((s, p) => s + p.price, 0)).toFixed(2)}
              </Text>
              <Icon name="cart" size={18} color="#6E7452" />
            </Pressable>
          </>
        )}

        {/* Related products */}
        {related.length > 0 && (
          <>
            <Text className="font-display text-lg text-ink px-5 mt-7 mb-3">Produkte të Ngjashme</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20 }}>
              {related.map((p) => (
                <RelatedCard key={p.id} product={p} onPress={() => router.push(`/shop/${p.id}`)} />
              ))}
            </ScrollView>
          </>
        )}

        {/* Reviews */}
        <Text className="font-display text-lg text-ink px-5 mt-7 mb-3">Vlerësime ({reviews.length})</Text>
        <View className="px-5">
          {reviews.length === 0 ? (
            <Text className="font-body text-sm text-ink-soft">Ende s'ka vlerësime për këtë produkt.</Text>
          ) : (
            reviews.map((r) => (
              <View key={r.id} style={shadows.soft} className="bg-surface rounded-xl2 p-4 mb-3">
                <View className="flex-row items-center justify-between mb-1">
                  <Text className="font-bodySemibold text-sm text-ink">{r.author}</Text>
                  <Text className="font-body text-xs text-ink-faint">{r.date}</Text>
                </View>
                <StarRow rating={r.rating} size={12} />
                <Text className="font-body text-sm text-ink-soft mt-2 leading-5">{r.comment}</Text>
              </View>
            ))
          )}
        </View>

        {/* Questions */}
        <Text className="font-display text-lg text-ink px-5 mt-4 mb-3">Pyetje & Përgjigje ({questions.length})</Text>
        <View className="px-5">
          {questions.length === 0 ? (
            <Text className="font-body text-sm text-ink-soft">Ende s'ka pyetje. Bëhu i pari!</Text>
          ) : (
            questions.map((q) => (
              <View key={q.id} style={shadows.soft} className="bg-surface rounded-xl2 p-4 mb-3">
                <Text className="font-bodySemibold text-sm text-ink mb-1">P: {q.question}</Text>
                <Text className="font-body text-xs text-ink-faint mb-2">— {q.author}, {q.date}</Text>
                {q.answer ? (
                  <Text className="font-body text-sm text-ink-soft leading-5">P: {q.answer}</Text>
                ) : (
                  <Text className="font-body text-xs text-ink-faint italic">Pa përgjigje ende.</Text>
                )}
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Sticky bottom actions */}
      <View className="absolute bottom-0 left-0 right-0 bg-cream px-5 pt-3 pb-6 flex-row" style={shadows.softLg}>
        <Pressable
          onPress={() => bumpCart(1)}
          className="flex-1 bg-surface border border-olive rounded-xl2 py-3.5 items-center mr-3"
        >
          <Text className="font-bodySemibold text-sm text-olive">Shto në Shportë</Text>
        </Pressable>
        <Pressable
          onPress={() => {
            bumpCart(1);
            router.push("/shop/cart");
          }}
          className="flex-1 bg-olive rounded-xl2 py-3.5 items-center"
        >
          <Text className="font-bodySemibold text-sm text-white">Bli Tani</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}