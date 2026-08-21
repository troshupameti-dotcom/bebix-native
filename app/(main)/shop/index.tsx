import { useEffect, useMemo, useState } from "react";
import { View, Text, ScrollView, Pressable, TextInput, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAppState } from "@/lib/state/AppStateContext";
import { Icon } from "@/components/ui/Icon";
import { shadows } from "@/lib/shadows";
import { brandCatalog, CATEGORY_META, Product, ProductCategory } from "@/lib/homeContent";
import { fetchProducts } from "@/lib/shopData";
import { ProductCard, ProductCardSkeleton } from "@/components/ProductCard";

type SortMode = "relevant" | "priceAsc" | "priceDesc" | "rating";

const PADDING_X = 20; // px-5
const GRID_GAP = 12;

/** 15. Mobile → 2, Tablet → 3, Desktop → 4 kolona. */
function useGridColumns() {
  const { width } = useWindowDimensions();
  if (width >= 1024) return 4;
  if (width >= 768) return 3;
  return 2;
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      className={`px-4 py-2 rounded-full mr-2 ${active ? "bg-olive" : "bg-surface"}`}
      style={!active ? shadows.soft : undefined}
    >
      <Text className={`font-bodyMedium text-xs ${active ? "text-white" : "text-ink-soft"}`}>{label}</Text>
    </Pressable>
  );
}

export default function ShopScreen() {
  const router = useRouter();
  const { state } = useAppState();
  const { width } = useWindowDimensions();
  const columns = useGridColumns();
  const cardWidth = (width - PADDING_X * 2 - GRID_GAP * (columns - 1)) / columns;

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<ProductCategory | "all">("all");
  const [sort, setSort] = useState<SortMode>("relevant");
  const [showFilters, setShowFilters] = useState(false);

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await fetchProducts();
      setProducts(data);
    } catch (e: any) {
      setLoadError(e.message ?? "Diçka shkoi keq.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const flashDeals = useMemo(() => products.filter((p) => p.compareAtPrice != null), [products]);
  const trending = useMemo(() => products.filter((p) => p.rating >= 4.6).slice(0, 6), [products]);

  const filtered = useMemo(() => {
    let list = products.slice();
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q));
    }
    if (category !== "all") list = list.filter((p) => p.category === category);
    if (sort === "priceAsc") list.sort((a, b) => a.price - b.price);
    if (sort === "priceDesc") list.sort((a, b) => b.price - a.price);
    if (sort === "rating") list.sort((a, b) => b.rating - a.rating);
    return list;
  }, [products, query, category, sort]);

  const isSearching = query.trim().length > 0 || category !== "all" || sort !== "relevant";

  function ProductGrid({ items }: { items: Product[] }) {
    return (
      <View
        className="px-5 mt-4 flex-row flex-wrap"
        style={{ columnGap: GRID_GAP, rowGap: GRID_GAP, paddingHorizontal: PADDING_X }}
      >
        {items.map((p) => (
          <ProductCard key={p.id} product={p} cardWidth={cardWidth} onPress={() => router.push(`/shop/${p.id}`)} />
        ))}
      </View>
    );
  }

  function SkeletonGrid() {
    return (
      <View
        className="flex-row flex-wrap"
        style={{ columnGap: GRID_GAP, rowGap: GRID_GAP, paddingHorizontal: PADDING_X, paddingTop: 16 }}
      >
        {Array.from({ length: columns * 3 }).map((_, i) => (
          <ProductCardSkeleton key={i} cardWidth={cardWidth} />
        ))}
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-5 pt-2 mb-4">
        <View>
          <Text className="font-display text-2xl text-ink">Dyqani</Text>
          {state.profile.parentName && (
            <Text className="font-body text-xs text-ink-faint mt-0.5">
              Mirë se erdhe, {state.profile.parentName.split(" ")[0]}
            </Text>
          )}
        </View>
        <View className="flex-row items-center">
          <Pressable
            onPress={() => router.push("/shop/wishlist")}
            style={shadows.soft}
            className="w-10 h-10 rounded-full bg-surface items-center justify-center mr-2"
          >
            <Icon name="heart" size={18} color="#2C271F" />
          </Pressable>
          <Pressable
            onPress={() => router.push("/shop/cart")}
            style={shadows.soft}
            className="w-10 h-10 rounded-full bg-surface items-center justify-center"
          >
            <Icon name="cart" size={18} color="#2C271F" />
            {state.cartCount > 0 && (
              <View className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-orange items-center justify-center">
                <Text className="text-white text-[10px] font-bodySemibold">{state.cartCount}</Text>
              </View>
            )}
          </Pressable>
        </View>
      </View>

      {/* Search */}
      <View className="px-5 mb-4">
        <View style={shadows.soft} className="flex-row items-center bg-surface rounded-xl2 px-4 py-3">
          <Icon name="search" size={18} color="#A79D8A" />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Kërko produkte ose marka..."
            placeholderTextColor="#A79D8A"
            className="flex-1 ml-2 font-body text-sm text-ink"
          />
          <Pressable onPress={() => setShowFilters((v) => !v)}>
            <Icon name="chart" size={18} color={showFilters ? "#C9702E" : "#A79D8A"} />
          </Pressable>
        </View>
      </View>

      {showFilters && (
        <View className="px-5 mb-4">
          <Text className="font-bodyMedium text-xs text-ink-soft mb-2">Rendit sipas</Text>
          <View className="flex-row mb-3">
            <Chip label="Relevante" active={sort === "relevant"} onPress={() => setSort("relevant")} />
            <Chip label="Çmimi ↑" active={sort === "priceAsc"} onPress={() => setSort("priceAsc")} />
            <Chip label="Çmimi ↓" active={sort === "priceDesc"} onPress={() => setSort("priceDesc")} />
            <Chip label="Vlerësimi" active={sort === "rating"} onPress={() => setSort("rating")} />
          </View>
        </View>
      )}

      {loading ? (
        <ScrollView showsVerticalScrollIndicator={false}>
          <SkeletonGrid />
        </ScrollView>
      ) : loadError ? (
        <View className="flex-1 items-center justify-center px-8">
          <Icon name="close" size={24} color="#C9702E" />
          <Text className="font-bodyMedium text-sm text-ink mt-3 text-center">S'u ngarkuan produktet.</Text>
          <Text className="font-body text-xs text-ink-faint mt-1 text-center">{loadError}</Text>
          <Pressable onPress={load} className="mt-4 bg-olive rounded-full px-5 py-2.5">
            <Text className="font-bodyMedium text-xs text-white">Provo Përsëri</Text>
          </Pressable>
        </View>
      ) : products.length === 0 ? (
        // 14. Empty state
        <View className="flex-1 items-center justify-center px-8">
          <Icon name="cube" size={24} color="#A79D8A" />
          <Text className="font-bodyMedium text-sm text-ink mt-3 text-center">Ende s'ka produkte.</Text>
          <Text className="font-body text-xs text-ink-faint mt-1 text-center">Shtoi te admin panel: bebix-admin.html</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
          <View className="mb-2">
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20 }}>
              <Chip label="Të gjitha" active={category === "all"} onPress={() => setCategory("all")} />
              {(Object.keys(CATEGORY_META) as ProductCategory[]).map((cat) => (
                <Chip key={cat} label={CATEGORY_META[cat].labelKey} active={category === cat} onPress={() => setCategory(cat)} />
              ))}
            </ScrollView>
          </View>

          {isSearching ? (
            filtered.length === 0 ? (
              // 14. Empty state kur s'ka rezultate
              <View className="items-center justify-center px-8 mt-10">
                <Icon name="search" size={24} color="#A79D8A" />
                <Text className="font-bodyMedium text-sm text-ink mt-3 text-center">S'u gjet asnjë produkt.</Text>
                <Pressable
                  onPress={() => {
                    setQuery("");
                    setCategory("all");
                    setSort("relevant");
                  }}
                  className="mt-4 bg-olive rounded-full px-5 py-2.5"
                >
                  <Text className="font-bodyMedium text-xs text-white">Shiko të gjitha produktet</Text>
                </Pressable>
              </View>
            ) : (
              <ProductGrid items={filtered} />
            )
          ) : (
            <>
              {/* 9. Section header — Markat */}
              <Text className="font-bodySemibold text-lg text-ink px-5 mt-5 mb-3">Markat</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20 }}>
                {brandCatalog.map((b) => {
                  const bg = b.accent === "olive" ? "bg-olive-bg" : "bg-orange-bg";
                  const fg = b.accent === "olive" ? "#6E7452" : "#C9702E";
                  return (
                    <Pressable
                      key={b.id}
                      onPress={() => {
                        const match = products.find((p) => p.brand === b.name);
                        if (match) setCategory(match.category);
                      }}
                      style={shadows.soft}
                      className="items-center bg-surface rounded-xl2 p-3 mr-3 w-24"
                    >
                      <View className={`w-11 h-11 rounded-full items-center justify-center mb-2 ${bg}`}>
                        <Icon name={b.icon} size={20} color={fg} />
                      </View>
                      <Text className="font-bodyMedium text-[11px] text-ink text-center" numberOfLines={1}>
                        {b.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              {flashDeals.length > 0 && (
                <>
                  <View className="flex-row items-center justify-between px-5 mt-6 mb-3">
                    <Text className="font-bodySemibold text-lg text-ink">⚡ Oferta të Menjëhershme</Text>
                  </View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20 }}>
                    {flashDeals.map((p) => (
                      <View key={p.id} className="mr-3">
                        <ProductCard product={p} cardWidth={150} onPress={() => router.push(`/shop/${p.id}`)} />
                      </View>
                    ))}
                  </ScrollView>
                </>
              )}

              {trending.length > 0 && (
                <>
                  <Text className="font-bodySemibold text-lg text-ink px-5 mt-6 mb-3">Në Modë</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20 }}>
                    {trending.map((p) => (
                      <View key={p.id} className="mr-3">
                        <ProductCard product={p} cardWidth={150} onPress={() => router.push(`/shop/${p.id}`)} />
                      </View>
                    ))}
                  </ScrollView>
                </>
              )}

              {/* 9. Section header — grid kryesor, me "Shiko të gjitha" */}
              <View className="flex-row items-center justify-between px-5 mt-6 mb-1">
                <Text className="font-bodySemibold text-lg text-ink">Të Gjitha Produktet</Text>
              </View>
              <ProductGrid items={products} />
            </>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}