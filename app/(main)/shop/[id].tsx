import { useToast } from "@/lib/toast/ToastContext";
import { useEffect, useMemo, useState } from "react";
import { View, Text, ScrollView, Pressable, Dimensions, Image, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAppState } from "@/lib/state/AppStateContext";
import { Icon, IconName } from "@/components/ui/Icon";
import { shadows } from "@/lib/shadows";
import { Product, CATEGORY_META } from "@/lib/homeContent";
import { fetchProductById, fetchProducts } from "@/lib/shopData";

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
        const [p, all] = await Promise.all([fetchProductById(id), fetchProducts()]);
        if (!active) return;
        setProduct(p);
        if (p) setRelated(all.filter((x) => x.category === p.category && x.id !== p.id).slice(0, 4));
      } catch (e: any) {
        if (active) setLoadError(e.message ?? "Diçka shkoi keq.");
      }
    })();
    return () => {
      active = false;
    };
  }, [id]);

  const avgRating = product?.rating ?? 0;

  // "AI Product Explanation" — përshkrim i gjeneruar nga të dhënat e
  // produktit (jo thirrje reale AI ende).
  const aiExplanation = useMemo(() => {
    if (!product) return "";
    const catLabel = CATEGORY_META[product.category]?.labelKey ?? product.category;
    const dealNote = product.compareAtPrice ? ` Aktualisht në ofertë, kursim prej €${(product.compareAtPrice - product.price).toFixed(2)}.` : "";
    return `${product.name} nga ${product.brand} bën pjesë te kategoria ${catLabel}, me vlerësim mesatar ${avgRating.toFixed(1)}/5 nga ${product.reviewCount ?? 0} blerës.${dealNote} Zgjidhje e mirë nëse kërkon cilësi të qëndrueshme për përdorim të përditshëm.`;
  }, [product, avgRating]);

  if (product === undefined && !loadError) {
    return (
      <SafeAreaView className="flex-1 bg-cream items-center justify-center">
        <ActivityIndicator color="#6E7452" />
      </SafeAreaView>
    );
  }

  if (loadError || !product) {
    return (
      <SafeAreaView className="flex-1 bg-cream items-center justify-center px-8">
        <Icon name="close" size={28} color="#A79D8A" />
        <Text className="font-bodyMedium text-sm text-ink-soft mt-3 text-center">{loadError ?? "Produkti s'u gjet."}</Text>
        <Pressable onPress={() => router.back()} className="mt-4">
          <Text className="font-bodyMedium text-sm text-olive">Kthehu mbrapa</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const bg = product.accent === "olive" ? "bg-olive-bg" : "bg-orange-bg";
  const fg = product.accent === "olive" ? "#6E7452" : "#C9702E";
  const fav = isFavorite(product.id);
  const gallerySlides = [product.imageUrl, product.imageUrl, product.imageUrl]; // vetëm 1 foto ende — galeri e vërtetë vjen kur admin panel mbështet disa foto

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
        {/* Gallery */}
        <View>
          {product.imageUrl ? (
            <Image source={{ uri: product.imageUrl }} style={{ width, height: 288 }} resizeMode="cover" />
          ) : (
            <View style={{ width, height: 288 }} className={`items-center justify-center ${bg}`}>
              <Icon name={product.icon} size={72} color={fg} />
            </View>
          )}
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
              {avgRating.toFixed(1)} ({product.reviewCount ?? 0} vlerësime)
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

        {/* Related products */}
        {related.length > 0 && (
          <>
            <Text className="font-bodySemibold text-lg text-ink px-5 mt-7 mb-3">Vlerësime</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20 }}>
              {related.map((p) => (
                <RelatedCard key={p.id} product={p} onPress={() => router.push(`/shop/${p.id}`)} />
              ))}
            </ScrollView>
          </>
        )}

        {/* Reviews — vijnë kur shtojmë tabelën `reviews` te Supabase */}
        <Text className="font-bodySemibold text-lg text-ink px-5 mt-7 mb-3">Vlerësime</Text>
        <View className="px-5">
          <Text className="font-body text-sm text-ink-soft">
            Ende s'ka vlerësime reale për këtë produkt (kërkon tabelë `reviews` shtesë te Supabase — hap tjetër i mundshëm).
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
            showToast(`${product.name} u shtua në shportë`);
          }}
          className="flex-1 bg-surface border border-olive rounded-xl2 py-3.5 items-center mr-3"
        >
          <Text className="font-bodyMedium text-sm text-olive">Shto në Shportë</Text>
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
            router.push("/shop/cart");
          }}
          className="flex-1 bg-olive rounded-xl2 py-3.5 items-center"
        >
          <Text className="font-bodyMedium text-sm text-white">Bli Tani</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}